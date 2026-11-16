function ms(n, l) {
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
const Lh = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), Xh = /* @__PURE__ */ new Set(["not", "is", "where", "has", "nth-child"]), Zh = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...Lh]);
function Io(n) {
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
  return [Io(n.slice(l, o)), o];
}
function Jh(n, l) {
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
function ps(n) {
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
function Wh(n, l) {
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
      o.attrs.push({ name: Io(f[1]).toLowerCase(), op: f[2] ?? null, value: p === void 0 ? null : Io(p) }), l = d + 1, i = !0;
      continue;
    }
    if (s === ":") {
      if (n[l + 1] === ":") {
        const [p, x] = bl(n, l + 2), S = p.toLowerCase();
        if (S !== "before" && S !== "after") throw new re(`::${S} is not supported`);
        if (o.pseudoElement = S, l = x, i = !0, l < n.length && !/[\s>]/.test(n[l])) throw new re(`nothing may follow ::${S} in ${JSON.stringify(n)}`);
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
        if (!Xh.has(f)) throw new re(`:${f}() is not supported`);
        const p = Jh(n, l + 1), x = n.slice(l + 1, p).trim();
        if (l = p + 1, f === "nth-child") {
          if (!/^\d+$/.test(x)) throw new re(`:nth-child(${x}) is not supported (only a number)`);
          o.pseudos.push({ name: f, n: Number(x) });
        } else {
          const S = ps(x).map(hs);
          if (f === "has" && S.some((E) => E.length !== 1)) throw new re(`:has(${x}) is not supported (only a compound selector)`);
          o.pseudos.push({ name: f, list: S });
        }
      } else {
        if (!Zh.has(f)) throw new re(`:${f} is not supported`);
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
function hs(n) {
  const l = [];
  let o = 0, i = null;
  for (n = n.trim(); o < n.length; ) {
    const [s, d] = Wh(n, o);
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
const wd = /* @__PURE__ */ new Map();
function Ir(n) {
  let l = wd.get(n);
  return l || (l = ps(n).map(hs), wd.set(n, l)), l;
}
function gf(n) {
  const l = [0, 0, 0], o = (i) => {
    l[0] += i[0], l[1] += i[1], l[2] += i[2];
  };
  for (const { compound: i } of n) {
    i.id && l[0]++, l[1] += i.classes.length + i.attrs.length, i.tag && i.tag !== "*" && l[2]++, i.pseudoElement && l[2]++;
    for (const s of i.pseudos)
      if (s.name !== "where")
        if (s.list) {
          const d = s.list.map(gf).sort((m, f) => f[0] - m[0] || f[1] - m[1] || f[2] - m[2])[0];
          o(d);
        } else l[1]++;
  }
  return l;
}
function Fh(n, { name: l, op: o, value: i }) {
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
function Nr(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function bf(n, l) {
  for (const o of n.children) if (l(o) || bf(o, l)) return !0;
  return !1;
}
function vf(n, l, o, i) {
  if ((l.pseudoElement ?? null) !== (i ? o.pseudo ?? null : null) || l.tag && l.tag !== "*" && n.tagName !== l.tag || l.id && n.getAttribute("id") !== l.id) return !1;
  if (l.classes.length) {
    const s = n.classList ?? [];
    for (const d of l.classes) if (!s.includes(d)) return !1;
  }
  for (const s of l.attrs) if (!Fh(n, s)) return !1;
  for (const s of l.pseudos)
    switch (s.name) {
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
        if (Nr(n).indexOf(n) !== s.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (s.list.some((d) => qa(n, d, o, i))) return !1;
        break;
      case "has":
        if (n.watchesDescendants = !0, !s.list.some(([{ compound: d }]) => bf(n, (m) => vf(m, d, o, !1)))) return !1;
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
    const { compound: p, combinator: x } = l[m];
    if (!vf(d, p, o, f)) return !1;
    if (m === 0) return !0;
    if (x === ">") return !!d.parentElement && s(d.parentElement, m - 1, !1);
    for (let S = d.parentElement; S; S = S.parentElement) if (s(S, m - 1, !1)) return !0;
    return !1;
  };
  return s(n, l.length - 1, i);
}
function Ih(n, l, o = {}) {
  return (typeof l == "string" ? Ir(l) : l).some((s) => qa(n, s, o));
}
function yf(n, l, o = {}) {
  return qa(n, l, o);
}
function Sl(n, l, o = {}) {
  const i = Ir(l), s = [], d = (m) => {
    for (const f of m.children)
      i.some((p) => qa(f, p, o)) && s.push(f), d(f);
  };
  return d(n), s;
}
function xf(n, l, o = {}) {
  const i = Ir(l);
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
let $h = 1;
class $o {
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
class gs {
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
class $t extends gs {
  constructor(l, o = {}, i = null) {
    super(), this.nodeType = 1, this.id = `n${$h++}`, this.tagName = l.toLowerCase(), this.props = o, this.childNodes = [], this.parentNode = null, this.ownerDocument = i, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
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
    return Ih(this, l);
  }
  closest(l) {
    return xf(this, l);
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
          return f === "setProperty" ? (p, x) => d(o(p), x) : f === "removeProperty" ? (p) => {
            const x = s(o(p));
            return d(o(p), ""), x;
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
    return _d(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(l = []) {
    return _d(this, l);
  }
}
const wf = Symbol("perch.stale-layout"), _f = 3;
let Hr = !1;
function kf(n) {
  return () => {
    let l, o = !1;
    const i = (s) => {
      const d = Hr;
      Hr = s < _f;
      try {
        l = n();
      } catch (m) {
        const f = m?.[wf];
        if (!f) throw m;
        f.retries.push(() => {
          o || i(s + 1);
        });
      } finally {
        Hr = d;
      }
    };
    return i(0), () => {
      o = !0, typeof l == "function" && l();
    };
  };
}
const Po = "perch-dom:", Ph = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), t0 = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function _d(n, l = []) {
  const o = new Set(l.map((s) => t0[s] ?? s)), i = (s) => {
    if (!(s instanceof $t)) return { x: s.data, ...s.hidden ? { h: 1 } : {} };
    const d = {};
    for (const [m, f] of Object.entries(s.props))
      Ph.has(m) || o.has(m) || f == null || typeof f == "function" || typeof f == "symbol" || (d[m] = f);
    return { t: s.tagName, p: d, c: s.childNodes.map(i), ...s.hidden ? { h: 1 } : {} };
  };
  return Po + JSON.stringify(i(n));
}
function e0(n, l) {
  if (typeof n != "string" || !n.startsWith(Po)) return null;
  let o;
  try {
    o = JSON.parse(n.slice(Po.length));
  } catch {
    return null;
  }
  const i = (d) => !!d && typeof d == "object" && !Array.isArray(d), s = (d) => {
    if (!i(d)) throw new Error("not a node");
    let m;
    if (typeof d.x == "string") m = new $r(d.x);
    else {
      if (typeof d.t != "string" || !/^[a-z][a-z0-9-]*$/i.test(d.t) || !i(d.p) || !Array.isArray(d.c)) throw new Error("not an element");
      m = new $t(d.t, d.p, l);
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
function kd(n) {
  for (let l = n; l instanceof $t; l = l.parentElement) l.touch();
}
class l0 extends gs {
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
    if (Hr && (!i || this.stale?.())) throw { [wf]: this };
    return i ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(l) {
    this.activeElement && this.activeElement !== l && this.blur(this.activeElement), this.activeElement = l, l.state.focus = !0, l.state.pointerFocus = !1, kd(l), this.perch?.focused?.(l);
  }
  blur(l) {
    l.state.focus = !1, kd(l), this.activeElement === l && (this.activeElement = this.body);
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
class r0 extends gs {
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
function Sf(n) {
  return {
    setTimeout: (l, o = 0, ...i) => n.setTimeout(() => l(...i), Math.max(0, Number(o) || 0)),
    clearTimeout: (l) => {
      l != null && n.clearTimeout(l);
    }
  };
}
const Sd = Symbol.for("perch.react.globals");
function Ze(n, l, o) {
  Object.defineProperty(n, l, { value: o, configurable: !0, writable: !0, enumerable: !1 });
}
function i0(n, l = globalThis) {
  const o = new l0(n), i = new r0(n, o);
  o.defaultView = i;
  const s = n.storage ?? new a0();
  if (typeof l.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const f = Sf(n);
    Ze(l, "setTimeout", f.setTimeout), Ze(l, "clearTimeout", f.clearTimeout);
  }
  typeof l.queueMicrotask != "function" && Ze(l, "queueMicrotask", (f) => {
    Promise.resolve().then(f);
  }), Ze(l, "requestAnimationFrame", (f) => l.setTimeout(() => f(Date.now()), 0)), Ze(l, "cancelAnimationFrame", (f) => l.clearTimeout(f));
  const d = { document: o, window: i, localStorage: s, HTMLElement: $t, Element: $t };
  for (const f of Object.keys(d))
    Object.defineProperty(l, f, { get: () => l[Sd]?.[f], configurable: !0, enumerable: !1 });
  l[Sd] = d, Ze(l, "DOMRect", $o), Ze(l, "getComputedStyle", o0), typeof l.ResizeObserver != "function" && Ze(l, "ResizeObserver", n0);
  const m = l.navigator && typeof l.navigator == "object" ? l.navigator : {};
  if (!m.clipboard && n.clipboard)
    try {
      Ze(m, "clipboard", n.clipboard);
    } catch {
    }
  return l.navigator || Ze(l, "navigator", m), { document: o, window: i, globals: d };
}
function o0(n) {
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
function ts(n, l = !1) {
  if (!(l ? n?.tagName === "input" && Ef(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let i = n.parentElement; i; i = i.parentElement) if (i.tagName === "form") return i;
  return null;
}
const Ef = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Ed = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Ed?.setTimeout == "function") {
  const n = Sf(Ed);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function bs(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function s0(n) {
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
function c0() {
  if (zd) return pt;
  zd = 1;
  var n = Symbol.for("react.transitional.element"), l = Symbol.for("react.portal"), o = Symbol.for("react.fragment"), i = Symbol.for("react.strict_mode"), s = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), m = Symbol.for("react.context"), f = Symbol.for("react.forward_ref"), p = Symbol.for("react.suspense"), x = Symbol.for("react.memo"), S = Symbol.for("react.lazy"), E = Symbol.for("react.activity"), w = Symbol.iterator;
  function N(T) {
    return T === null || typeof T != "object" ? null : (T = w && T[w] || T["@@iterator"], typeof T == "function" ? T : null);
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
  }, y = Object.assign, z = {};
  function O(T, V, et) {
    this.props = T, this.context = V, this.refs = z, this.updater = et || k;
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
    this.props = T, this.context = V, this.refs = z, this.updater = et || k;
  }
  var L = A.prototype = new D();
  L.constructor = A, y(L, O.prototype), L.isPureReactComponent = !0;
  var q = Array.isArray;
  function R() {
  }
  var g = { H: null, A: null, T: null, S: null }, v = Object.prototype.hasOwnProperty;
  function h(T, V, et) {
    var ot = et.ref;
    return {
      $$typeof: n,
      type: T,
      key: V,
      ref: ot !== void 0 ? ot : null,
      props: et
    };
  }
  function _(T, V) {
    return h(T.type, V, T.props);
  }
  function M(T) {
    return typeof T == "object" && T !== null && T.$$typeof === n;
  }
  function H(T) {
    var V = { "=": "=0", ":": "=2" };
    return "$" + T.replace(/[=:]/g, function(et) {
      return V[et];
    });
  }
  var X = /\/+/g;
  function I(T, V) {
    return typeof T == "object" && T !== null && T.key != null ? H("" + T.key) : V.toString(36);
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
  function Q(T, V, et, ot, st) {
    var ut = typeof T;
    (ut === "undefined" || ut === "boolean") && (T = null);
    var St = !1;
    if (T === null) St = !0;
    else
      switch (ut) {
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
            case S:
              return St = T._init, Q(
                St(T._payload),
                V,
                et,
                ot,
                st
              );
          }
      }
    if (St)
      return st = st(T), St = ot === "" ? "." + I(T, 0) : ot, q(st) ? (et = "", St != null && (et = St.replace(X, "$&/") + "/"), Q(st, V, et, "", function(Kn) {
        return Kn;
      })) : st != null && (M(st) && (st = _(
        st,
        et + (st.key == null || T && T.key === st.key ? "" : ("" + st.key).replace(
          X,
          "$&/"
        ) + "/") + St
      )), V.push(st)), 1;
    St = 0;
    var Jt = ot === "" ? "." : ot + ":";
    if (q(T))
      for (var ht = 0; ht < T.length; ht++)
        ot = T[ht], ut = Jt + I(ot, ht), St += Q(
          ot,
          V,
          et,
          ut,
          st
        );
    else if (ht = N(T), typeof ht == "function")
      for (T = ht.call(T), ht = 0; !(ot = T.next()).done; )
        ot = ot.value, ut = Jt + I(ot, ht++), St += Q(
          ot,
          V,
          et,
          ut,
          st
        );
    else if (ut === "object") {
      if (typeof T.then == "function")
        return Q(
          $(T),
          V,
          et,
          ot,
          st
        );
      throw V = String(T), Error(
        "Objects are not valid as a React child (found: " + (V === "[object Object]" ? "object with keys {" + Object.keys(T).join(", ") + "}" : V) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return St;
  }
  function Z(T, V, et) {
    if (T == null) return T;
    var ot = [], st = 0;
    return Q(T, ot, "", "", function(ut) {
      return V.call(et, ut, st++);
    }), ot;
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
  return pt.Activity = E, pt.Children = K, pt.Component = O, pt.Fragment = o, pt.Profiler = s, pt.PureComponent = A, pt.StrictMode = i, pt.Suspense = p, pt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = g, pt.__COMPILER_RUNTIME = {
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
    var ot = y({}, T.props), st = T.key;
    if (V != null)
      for (ut in V.key !== void 0 && (st = "" + V.key), V)
        !v.call(V, ut) || ut === "key" || ut === "__self" || ut === "__source" || ut === "ref" && V.ref === void 0 || (ot[ut] = V[ut]);
    var ut = arguments.length - 2;
    if (ut === 1) ot.children = et;
    else if (1 < ut) {
      for (var St = Array(ut), Jt = 0; Jt < ut; Jt++)
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
      $$typeof: d,
      _context: T
    }, T;
  }, pt.createElement = function(T, V, et) {
    var ot, st = {}, ut = null;
    if (V != null)
      for (ot in V.key !== void 0 && (ut = "" + V.key), V)
        v.call(V, ot) && ot !== "key" && ot !== "__self" && ot !== "__source" && (st[ot] = V[ot]);
    var St = arguments.length - 2;
    if (St === 1) st.children = et;
    else if (1 < St) {
      for (var Jt = Array(St), ht = 0; ht < St; ht++)
        Jt[ht] = arguments[ht + 2];
      st.children = Jt;
    }
    if (T && T.defaultProps)
      for (ot in St = T.defaultProps, St)
        st[ot] === void 0 && (st[ot] = St[ot]);
    return h(T, ut, st);
  }, pt.createRef = function() {
    return { current: null };
  }, pt.forwardRef = function(T) {
    return { $$typeof: f, render: T };
  }, pt.isValidElement = M, pt.lazy = function(T) {
    return {
      $$typeof: S,
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
      var ot = T(), st = g.S;
      st !== null && st(et, ot), typeof ot == "object" && ot !== null && typeof ot.then == "function" && ot.then(R, G);
    } catch (ut) {
      G(ut);
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
function u0() {
  return Nd || (Nd = 1, Yo.exports = c0()), Yo.exports;
}
var ct = u0();
const zf = /* @__PURE__ */ bs(ct), d0 = /* @__PURE__ */ ms({
  __proto__: null,
  default: zf
}, [ct]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const f0 = zf ?? d0;
function Fe(n, l) {
  return ct.useEffect(kf(n), l);
}
function es(n, l) {
  return ct.useLayoutEffect(kf(n), l);
}
const m0 = /* @__PURE__ */ ms({
  __proto__: null,
  default: f0,
  useEffect: Fe,
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
var Td;
function p0() {
  if (Td) return vl;
  Td = 1;
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
var Cd;
function h0() {
  return Cd || (Cd = 1, Go.exports = p0()), Go.exports;
}
var lt = h0();
const g0 = /* @__PURE__ */ bs(lt), _y = /* @__PURE__ */ ms({
  __proto__: null,
  default: g0
}, [lt]);
var Ko = { exports: {} }, Qo = { exports: {} };
const b0 = /* @__PURE__ */ s0(m0);
var Vo = { exports: {} }, Lo = {};
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
function v0() {
  return Md || (Md = 1, (function(n) {
    function l(Q, Z) {
      var P = Q.length;
      Q.push(Z);
      t: for (; 0 < P; ) {
        var G = P - 1 >>> 1, K = Q[G];
        if (0 < s(K, Z))
          Q[G] = Z, Q[P] = K, P = G;
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
        t: for (var G = 0, K = Q.length, T = K >>> 1; G < T; ) {
          var V = 2 * (G + 1) - 1, et = Q[V], ot = V + 1, st = Q[ot];
          if (0 > s(et, P))
            ot < K && 0 > s(st, et) ? (Q[G] = st, Q[ot] = P, G = ot) : (Q[G] = et, Q[V] = P, G = V);
          else if (ot < K && 0 > s(st, P))
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
    var p = [], x = [], S = 1, E = null, w = 3, N = !1, k = !1, y = !1, z = !1, O = typeof setTimeout == "function" ? setTimeout : null, D = typeof clearTimeout == "function" ? clearTimeout : null, A = typeof setImmediate < "u" ? setImmediate : null;
    function L(Q) {
      for (var Z = o(x); Z !== null; ) {
        if (Z.callback === null) i(x);
        else if (Z.startTime <= Q)
          i(x), Z.sortIndex = Z.expirationTime, l(p, Z);
        else break;
        Z = o(x);
      }
    }
    function q(Q) {
      if (y = !1, L(Q), !k)
        if (o(p) !== null)
          k = !0, R || (R = !0, H());
        else {
          var Z = o(x);
          Z !== null && $(q, Z.startTime - Q);
        }
    }
    var R = !1, g = -1, v = 5, h = -1;
    function _() {
      return z ? !0 : !(n.unstable_now() - h < v);
    }
    function M() {
      if (z = !1, R) {
        var Q = n.unstable_now();
        h = Q;
        var Z = !0;
        try {
          t: {
            k = !1, y && (y = !1, D(g), g = -1), N = !0;
            var P = w;
            try {
              e: {
                for (L(Q), E = o(p); E !== null && !(E.expirationTime > Q && _()); ) {
                  var G = E.callback;
                  if (typeof G == "function") {
                    E.callback = null, w = E.priorityLevel;
                    var K = G(
                      E.expirationTime <= Q
                    );
                    if (Q = n.unstable_now(), typeof K == "function") {
                      E.callback = K, L(Q), Z = !0;
                      break e;
                    }
                    E === o(p) && i(p), L(Q);
                  } else i(p);
                  E = o(p);
                }
                if (E !== null) Z = !0;
                else {
                  var T = o(x);
                  T !== null && $(
                    q,
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
          Z ? H() : R = !1;
        }
      }
    }
    var H;
    if (typeof A == "function")
      H = function() {
        A(M);
      };
    else if (typeof MessageChannel < "u") {
      var X = new MessageChannel(), I = X.port2;
      X.port1.onmessage = M, H = function() {
        I.postMessage(null);
      };
    } else
      H = function() {
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
      z = !0;
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
        id: S++,
        callback: Z,
        priorityLevel: Q,
        startTime: P,
        expirationTime: K,
        sortIndex: -1
      }, P > G ? (Q.sortIndex = P, l(x, Q), o(p) === null && Q === o(x) && (y ? (D(g), g = -1) : y = !0, $(q, P - G))) : (Q.sortIndex = K, l(p, Q), k || N || (k = !0, R || (R = !0, H()))), Q;
    }, n.unstable_shouldYield = _, n.unstable_wrapCallback = function(Q) {
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
  })(Lo)), Lo;
}
var Ad;
function y0() {
  return Ad || (Ad = 1, Vo.exports = v0()), Vo.exports;
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
function x0() {
  return jd || (jd = 1, (function(n) {
    n.exports = function(l) {
      function o(t, e, a, r) {
        return new Fm(t, e, a, r);
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
            for (var b = !1, C = c.child; C; ) {
              if (C === a) {
                b = !0, a = c, r = u;
                break;
              }
              if (C === r) {
                b = !0, r = c, a = u;
                break;
              }
              C = C.sibling;
            }
            if (!b) {
              for (C = u.child; C; ) {
                if (C === a) {
                  b = !0, a = u, r = c;
                  break;
                }
                if (C === r) {
                  b = !0, r = u, a = c;
                  break;
                }
                C = C.sibling;
              }
              if (!b) throw Error(s(189));
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
        return t === null || typeof t != "object" ? null : (t = Yu && t[Yu] || t["@@iterator"], typeof t == "function" ? t : null);
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
            case kn:
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
      function k(t, e) {
        _a++, bo[_a] = t.current, t.current = e;
      }
      function y(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (Ch(t) / Mh | 0) | 0;
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
      function O(t, e, a) {
        var r = t.pendingLanes;
        if (r === 0) return 0;
        var c = 0, u = t.suspendedLanes, b = t.pingedLanes;
        t = t.warmLanes;
        var C = r & 134217727;
        return C !== 0 ? (r = C & ~u, r !== 0 ? c = z(r) : (b &= C, b !== 0 ? c = z(b) : a || (a = C & ~t, a !== 0 && (c = z(a))))) : (C = r & ~u, C !== 0 ? c = z(C) : b !== 0 ? c = z(b) : a || (a = r & ~t, a !== 0 && (c = z(a)))), c === 0 ? 0 : e !== 0 && e !== c && (e & u) === 0 && (u = c & -c, a = e & -e, u >= a || u === 32 && (a & 4194048) !== 0) ? e : c;
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
      function L() {
        var t = sr;
        return sr <<= 1, (sr & 62914560) === 0 && (sr = 4194304), t;
      }
      function q(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function R(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function g(t, e, a, r, c, u) {
        var b = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var C = t.entanglements, Y = t.expirationTimes, J = t.hiddenUpdates;
        for (a = b & ~a; 0 < a; ) {
          var tt = 31 - xe(a), W = 1 << tt;
          C[tt] = 0, Y[tt] = -1;
          var nt = J[tt];
          if (nt !== null)
            for (J[tt] = null, tt = 0; tt < nt.length; tt++) {
              var gt = nt[tt];
              gt !== null && (gt.lane &= -536870913);
            }
          a &= ~W;
        }
        r !== 0 && v(t, r, 0), u !== 0 && c === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(b & ~e));
      }
      function v(t, e, a) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var r = 31 - xe(e);
        t.entangledLanes |= e, t.entanglements[r] = t.entanglements[r] | 1073741824 | a & 261930;
      }
      function h(t, e) {
        var a = t.entangledLanes |= e;
        for (t = t.entanglements; a; ) {
          var r = 31 - xe(a), c = 1 << r;
          c & e | t[r] & e && (t[r] |= e), a &= ~c;
        }
      }
      function _(t, e) {
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
      function H(t) {
        return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function X(t) {
        if (typeof Dh == "function" && Hh(t), we && typeof we.setStrictMode == "function")
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
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            xo = e && e[1] || "", fd = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + xo + t + fd;
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
          wo = !1, Error.prepareStackTrace = a;
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
        } catch (r) {
          return `
Error generating stack: ` + r.message + `
` + r.stack;
        }
      }
      function G(t, e) {
        if (typeof t == "object" && t !== null) {
          var a = md.get(t);
          return a !== void 0 ? a : (e = {
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
        Sa[Ea++] = il, Sa[Ea++] = ur, ur = t, il = e;
      }
      function T(t, e, a) {
        Te[Ce++] = Le, Te[Ce++] = Xe, Te[Ce++] = Sn, Sn = t;
        var r = Le;
        t = Xe;
        var c = 32 - xe(r) - 1;
        r &= ~(1 << c), a += 1;
        var u = 32 - xe(e) + c;
        if (30 < u) {
          var b = c - c % 5;
          u = (r & (1 << b) - 1).toString(32), r >>= b, c -= b, Le = 1 << 32 - xe(e) + c | a << c | r, Xe = u + t;
        } else
          Le = 1 << u | a << c | r, Xe = t;
      }
      function V(t) {
        t.return !== null && (K(t, 1), T(t, 1, 0));
      }
      function et(t) {
        for (; t === ur; )
          ur = Sa[--Ea], Sa[Ea] = null, il = Sa[--Ea], Sa[Ea] = null;
        for (; t === Sn; )
          Sn = Te[--Ce], Te[Ce] = null, Xe = Te[--Ce], Te[Ce] = null, Le = Te[--Ce], Te[Ce] = null;
      }
      function ot(t, e) {
        Te[Ce++] = Le, Te[Ce++] = Xe, Te[Ce++] = Sn, Le = e.id, Xe = e.overflow, Sn = t;
      }
      function st(t, e) {
        k(En, e), k(ol, t), k(ne, null), t = lp(e), N(ne), k(ne, t);
      }
      function ut() {
        N(ne), N(ol), N(En);
      }
      function St(t) {
        t.memoizedState !== null && k(dr, t);
        var e = ne.current, a = rp(e, t.type);
        e !== a && (k(ol, t), k(ne, a));
      }
      function Jt(t) {
        ol.current === t && (N(ne), N(ol)), dr.current === t && (N(dr), an ? $n._currentValue = xa : $n._currentValue2 = xa);
      }
      function ht(t) {
        var e = Error(
          s(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Ga(G(e, t)), _o;
      }
      function Kn(t, e) {
        if (!ce) throw Error(s(175));
        rh(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || ht(t, !0);
      }
      function Qn(t) {
        for (ae = t.return; ae; )
          switch (ae.tag) {
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
              ae = ae.return;
          }
      }
      function Re(t) {
        if (!ce || t !== ae) return !1;
        if (!kt) return Qn(t), kt = !0, !1;
        var e = t.tag;
        if (Vt ? e !== 3 && e !== 27 && (e !== 5 || Pu(t.type) && !rr(t.type, t.memoizedProps)) && Ot && ht(t) : e !== 3 && (e !== 5 || Pu(t.type) && !rr(t.type, t.memoizedProps)) && Ot && ht(t), Qn(t), e === 13) {
          if (!ce) throw Error(s(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Ot = uh(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Ot = ch(t);
        } else
          Ot = Vt && e === 27 ? Wp(
            t.type,
            Ot
          ) : ae ? $u(t.stateNode) : null;
        return !0;
      }
      function De() {
        ce && (Ot = ae = null, kt = !1);
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
        an ? (k(fr, e._currentValue), e._currentValue = a) : (k(fr, e._currentValue2), e._currentValue2 = a);
      }
      function Ie(t) {
        var e = fr.current;
        an ? t._currentValue = e : t._currentValue2 = e, N(fr);
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
            var b = c.child;
            u = u.firstContext;
            t: for (; u !== null; ) {
              var C = u;
              u = c;
              for (var Y = 0; Y < e.length; Y++)
                if (C.context === e[Y]) {
                  u.lanes |= a, C = u.alternate, C !== null && (C.lanes |= a), ni(
                    u.return,
                    a,
                    t
                  ), r || (b = null);
                  break t;
                }
              u = C.next;
            }
          } else if (c.tag === 18) {
            if (b = c.return, b === null) throw Error(s(341));
            b.lanes |= a, u = b.alternate, u !== null && (u.lanes |= a), ni(b, a, t), b = null;
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
      function fa(t, e, a, r) {
        t = null;
        for (var c = e, u = !1; c !== null; ) {
          if (!u) {
            if ((c.flags & 524288) !== 0) u = !0;
            else if ((c.flags & 262144) !== 0) break;
          }
          if (c.tag === 10) {
            var b = c.alternate;
            if (b === null) throw Error(s(387));
            if (b = b.memoizedProps, b !== null) {
              var C = c.type;
              _e(c.pendingProps.value, b.value) || (t !== null ? t.push(C) : t = [C]);
            }
          } else if (c === dr.current) {
            if (b = c.alternate, b === null) throw Error(s(387));
            b.memoizedState.memoizedState !== c.memoizedState.memoizedState && (t !== null ? t.push($n) : t = [$n]);
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
      function Vn(t) {
        Pn = t, rn = null, t = t.dependencies, t !== null && (t.firstContext = null);
      }
      function te(t) {
        return zs(Pn, t);
      }
      function Cl(t, e) {
        return Pn === null && Vn(t), zs(t, e);
      }
      function zs(t, e) {
        var a = an ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, rn === null) {
          if (t === null) throw Error(s(308));
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
      function Ke(t) {
        t !== za && t.next === null && (za === null ? mr = za = t : za = za.next = t), pr = !0, ko || (ko = !0, zm());
      }
      function ma(t, e) {
        if (!So && pr) {
          So = !0;
          do
            for (var a = !1, r = mr; r !== null; ) {
              if (t !== 0) {
                var c = r.pendingLanes;
                if (c === 0) var u = 0;
                else {
                  var b = r.suspendedLanes, C = r.pingedLanes;
                  u = (1 << 31 - xe(42 | t) + 1) - 1, u &= c & ~(b & ~C), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
                }
                u !== 0 && (a = !0, As(r, u));
              } else
                u = _t, u = O(
                  r,
                  r === At ? u : 0,
                  r.cancelPendingCommit !== null || r.timeoutHandle !== In
                ), (u & 3) === 0 || D(r, u) || (a = !0, As(r, u));
              r = r.next;
            }
          while (a);
          So = !1;
        }
      }
      function Ns() {
        Ts();
      }
      function Ts() {
        pr = ko = !1;
        var t = 0;
        ta !== 0 && pp() && (t = ta);
        for (var e = pe(), a = null, r = mr; r !== null; ) {
          var c = r.next, u = Cs(r, e);
          u === 0 ? (r.next = null, a === null ? mr = c : a.next = c, c === null && (za = a)) : (a = r, (t !== 0 || (u & 3) !== 0) && (pr = !0)), r = c;
        }
        Lt !== 0 && Lt !== 5 || ma(t), ta !== 0 && (ta = 0);
      }
      function Cs(t, e) {
        for (var a = t.suspendedLanes, r = t.pingedLanes, c = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
          var b = 31 - xe(u), C = 1 << b, Y = c[b];
          Y === -1 ? ((C & a) === 0 || (C & r) !== 0) && (c[b] = A(C, e)) : Y <= e && (t.expiredLanes |= C), u &= ~C;
        }
        if (e = At, a = _t, a = O(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== In
        ), r = t.callbackNode, a === 0 || t === e && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null)
          return r !== null && r !== null && vo(r), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || D(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (r !== null && vo(r), H(a)) {
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
          return r = Ms.bind(null, t), a = cr(a, r), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return r !== null && r !== null && vo(r), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function Ms(t, e) {
        if (Lt !== 0 && Lt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (el() && t.callbackNode !== a)
          return null;
        var r = _t;
        return r = O(
          t,
          t === At ? r : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== In
        ), r === 0 ? null : (mu(t, r, e), Cs(t, pe()), t.callbackNode != null && t.callbackNode === a ? Ms.bind(null, t) : null);
      }
      function As(t, e) {
        if (el()) return null;
        mu(t, e, !0);
      }
      function zm() {
        wp ? _p(function() {
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
        var t = ea.current;
        return t !== null ? t : At.pooledCache;
      }
      function Al(t, e) {
        e === null ? k(ea, ea.current) : k(ea, e.pool);
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
        var a = Object.keys(t), r = Object.keys(e);
        if (a.length !== r.length) return !1;
        for (r = 0; r < a.length; r++) {
          var c = a[r];
          if (!Bh.call(e, c) || !_e(t[c], e[c]))
            return !1;
        }
        return !0;
      }
      function Rs(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function Ds(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(Ml, Ml), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, Bs(t), t;
          default:
            if (typeof e.status == "string") e.then(Ml, Ml);
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
                throw t = e.reason, Bs(t), t;
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
      function Hs() {
        if (na === null) throw Error(s(459));
        var t = na;
        return na = null, t;
      }
      function Bs(t) {
        if (t === Ca || t === hr)
          throw Error(s(483));
      }
      function Ol(t) {
        var e = cl;
        return cl += 1, Ma === null && (Ma = []), Ds(Ma, t, e);
      }
      function Qa(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function Rl(t, e) {
        throw e.$$typeof === Pm ? Error(s(525)) : (t = Object.prototype.toString.call(e), Error(
          s(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function Us(t) {
        function e(B, j) {
          if (t) {
            var U = B.deletions;
            U === null ? (B.deletions = [j], B.flags |= 16) : U.push(j);
          }
        }
        function a(B, j) {
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
          return j === null || j.tag !== 6 ? (j = eo(U, B.mode, F), j.return = B, j) : (j = c(j, U), j.return = B, j);
        }
        function Y(B, j, U, F) {
          var ft = U.type;
          return ft === ya ? tt(
            B,
            j,
            U.props.children,
            F,
            U.key
          ) : j !== null && (j.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === kn && Ln(ft) === j.type) ? (j = c(j, U.props), Qa(j, U), j.return = B, j) : (j = nr(
            U.type,
            U.key,
            U.props,
            null,
            B.mode,
            F
          ), Qa(j, U), j.return = B, j);
        }
        function J(B, j, U, F) {
          return j === null || j.tag !== 4 || j.stateNode.containerInfo !== U.containerInfo || j.stateNode.implementation !== U.implementation ? (j = no(U, B.mode, F), j.return = B, j) : (j = c(j, U.children || []), j.return = B, j);
        }
        function tt(B, j, U, F, ft) {
          return j === null || j.tag !== 7 ? (j = Fn(
            U,
            B.mode,
            F,
            ft
          ), j.return = B, j) : (j = c(j, U), j.return = B, j);
        }
        function W(B, j, U) {
          if (typeof j == "string" && j !== "" || typeof j == "number" || typeof j == "bigint")
            return j = eo(
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
                return j = no(
                  j,
                  B.mode,
                  U
                ), j.return = B, j;
              case kn:
                return j = Ln(j), W(B, j, U);
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
          var ft = j !== null ? j.key : null;
          if (typeof U == "string" && U !== "" || typeof U == "number" || typeof U == "bigint")
            return ft !== null ? null : C(B, j, "" + U, F);
          if (typeof U == "object" && U !== null) {
            switch (U.$$typeof) {
              case ar:
                return U.key === ft ? Y(B, j, U, F) : null;
              case va:
                return U.key === ft ? J(B, j, U, F) : null;
              case kn:
                return U = Ln(U), nt(B, j, U, F);
            }
            if (lr(U) || S(U))
              return ft !== null ? null : tt(B, j, U, F, null);
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
        function gt(B, j, U, F, ft) {
          if (typeof F == "string" && F !== "" || typeof F == "number" || typeof F == "bigint")
            return B = B.get(U) || null, C(j, B, "" + F, ft);
          if (typeof F == "object" && F !== null) {
            switch (F.$$typeof) {
              case ar:
                return B = B.get(
                  F.key === null ? U : F.key
                ) || null, Y(j, B, F, ft);
              case va:
                return B = B.get(
                  F.key === null ? U : F.key
                ) || null, J(j, B, F, ft);
              case kn:
                return F = Ln(F), gt(
                  B,
                  j,
                  U,
                  F,
                  ft
                );
            }
            if (lr(F) || S(F))
              return B = B.get(U) || null, tt(j, B, F, ft, null);
            if (typeof F.then == "function")
              return gt(
                B,
                j,
                U,
                Ol(F),
                ft
              );
            if (F.$$typeof === _n)
              return gt(
                B,
                j,
                U,
                Cl(j, F),
                ft
              );
            Rl(j, F);
          }
          return null;
        }
        function le(B, j, U, F) {
          for (var ft = null, Dt = null, mt = j, Nt = j = 0, It = null; mt !== null && Nt < U.length; Nt++) {
            mt.index > Nt ? (It = mt, mt = null) : It = mt.sibling;
            var Tt = nt(
              B,
              mt,
              U[Nt],
              F
            );
            if (Tt === null) {
              mt === null && (mt = It);
              break;
            }
            t && mt && Tt.alternate === null && e(B, mt), j = u(Tt, j, Nt), Dt === null ? ft = Tt : Dt.sibling = Tt, Dt = Tt, mt = It;
          }
          if (Nt === U.length)
            return a(B, mt), kt && K(B, Nt), ft;
          if (mt === null) {
            for (; Nt < U.length; Nt++)
              mt = W(B, U[Nt], F), mt !== null && (j = u(
                mt,
                j,
                Nt
              ), Dt === null ? ft = mt : Dt.sibling = mt, Dt = mt);
            return kt && K(B, Nt), ft;
          }
          for (mt = r(mt); Nt < U.length; Nt++)
            It = gt(
              mt,
              B,
              Nt,
              U[Nt],
              F
            ), It !== null && (t && It.alternate !== null && mt.delete(
              It.key === null ? Nt : It.key
            ), j = u(
              It,
              j,
              Nt
            ), Dt === null ? ft = It : Dt.sibling = It, Dt = It);
          return t && mt.forEach(function(jn) {
            return e(B, jn);
          }), kt && K(B, Nt), ft;
        }
        function gl(B, j, U, F) {
          if (U == null) throw Error(s(151));
          for (var ft = null, Dt = null, mt = j, Nt = j = 0, It = null, Tt = U.next(); mt !== null && !Tt.done; Nt++, Tt = U.next()) {
            mt.index > Nt ? (It = mt, mt = null) : It = mt.sibling;
            var jn = nt(B, mt, Tt.value, F);
            if (jn === null) {
              mt === null && (mt = It);
              break;
            }
            t && mt && jn.alternate === null && e(B, mt), j = u(jn, j, Nt), Dt === null ? ft = jn : Dt.sibling = jn, Dt = jn, mt = It;
          }
          if (Tt.done)
            return a(B, mt), kt && K(B, Nt), ft;
          if (mt === null) {
            for (; !Tt.done; Nt++, Tt = U.next())
              Tt = W(B, Tt.value, F), Tt !== null && (j = u(
                Tt,
                j,
                Nt
              ), Dt === null ? ft = Tt : Dt.sibling = Tt, Dt = Tt);
            return kt && K(B, Nt), ft;
          }
          for (mt = r(mt); !Tt.done; Nt++, Tt = U.next())
            Tt = gt(
              mt,
              B,
              Nt,
              Tt.value,
              F
            ), Tt !== null && (t && Tt.alternate !== null && mt.delete(Tt.key === null ? Nt : Tt.key), j = u(Tt, j, Nt), Dt === null ? ft = Tt : Dt.sibling = Tt, Dt = Tt);
          return t && mt.forEach(function(Vh) {
            return e(B, Vh);
          }), kt && K(B, Nt), ft;
        }
        function ia(B, j, U, F) {
          if (typeof U == "object" && U !== null && U.type === ya && U.key === null && (U = U.props.children), typeof U == "object" && U !== null) {
            switch (U.$$typeof) {
              case ar:
                t: {
                  for (var ft = U.key; j !== null; ) {
                    if (j.key === ft) {
                      if (ft = U.type, ft === ya) {
                        if (j.tag === 7) {
                          a(
                            B,
                            j.sibling
                          ), F = c(
                            j,
                            U.props.children
                          ), F.return = B, B = F;
                          break t;
                        }
                      } else if (j.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === kn && Ln(ft) === j.type) {
                        a(
                          B,
                          j.sibling
                        ), F = c(j, U.props), Qa(F, U), F.return = B, B = F;
                        break t;
                      }
                      a(B, j);
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
                  for (ft = U.key; j !== null; ) {
                    if (j.key === ft)
                      if (j.tag === 4 && j.stateNode.containerInfo === U.containerInfo && j.stateNode.implementation === U.implementation) {
                        a(
                          B,
                          j.sibling
                        ), F = c(
                          j,
                          U.children || []
                        ), F.return = B, B = F;
                        break t;
                      } else {
                        a(B, j);
                        break;
                      }
                    else e(B, j);
                    j = j.sibling;
                  }
                  F = no(U, B.mode, F), F.return = B, B = F;
                }
                return b(B);
              case kn:
                return U = Ln(U), ia(
                  B,
                  j,
                  U,
                  F
                );
            }
            if (lr(U))
              return le(
                B,
                j,
                U,
                F
              );
            if (S(U)) {
              if (ft = S(U), typeof ft != "function")
                throw Error(s(150));
              return U = ft.call(U), gl(
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
          return typeof U == "string" && U !== "" || typeof U == "number" || typeof U == "bigint" ? (U = "" + U, j !== null && j.tag === 6 ? (a(B, j.sibling), F = c(j, U), F.return = B, B = F) : (a(B, j), F = eo(U, B.mode, F), F.return = B, B = F), b(B)) : a(B, j);
        }
        return function(B, j, U, F) {
          try {
            cl = 0;
            var ft = ia(
              B,
              j,
              U,
              F
            );
            return Ma = null, ft;
          } catch (mt) {
            if (mt === Ca || mt === hr) throw mt;
            var Dt = o(29, mt, null, B.mode);
            return Dt.lanes = F, Dt.return = B, Dt;
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
            var b = r.pending;
            b === null ? c.next = c : (c.next = b.next, b.next = c), r.pending = c;
          }
          u !== 0 && qs(a, c, u);
        }
      }
      function Hl(t, e, a, r) {
        Ae[Aa++] = t, Ae[Aa++] = e, Ae[Aa++] = a, Ae[Aa++] = r, No |= r, t.lanes |= r, t = t.alternate, t !== null && (t.lanes |= r);
      }
      function oi(t, e, a, r) {
        return Hl(t, e, a, r), Bl(t);
      }
      function Xn(t, e) {
        return Hl(t, null, null, e), Bl(t);
      }
      function qs(t, e, a) {
        t.lanes |= a;
        var r = t.alternate;
        r !== null && (r.lanes |= a);
        for (var c = !1, u = t.return; u !== null; )
          u.childLanes |= a, r = u.alternate, r !== null && (r.childLanes |= a), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (c = !0)), t = u, u = u.return;
        return t.tag === 3 ? (u = t.stateNode, c && e !== null && (c = 31 - xe(a), t = u.hiddenUpdates, r = t[c], r === null ? t[c] = [e] : r.push(e), e.lane = a | 536870912), u) : null;
      }
      function Bl(t) {
        if (50 < hl)
          throw hl = 0, qo = null, Error(s(185));
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
          return c === null ? e.next = e : (e.next = c.next, c.next = e), r.pending = e, e = Bl(t), qs(t, null, a), e;
        }
        return Hl(t, r, e, a), Bl(t);
      }
      function Va(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var r = e.lanes;
          r &= t.pendingLanes, a |= r, e.lanes = a, h(t, a);
        }
      }
      function ui(t, e) {
        var a = t.updateQueue, r = t.alternate;
        if (r !== null && (r = r.updateQueue, a === r)) {
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
      function La() {
        if (To) {
          var t = Ta;
          if (t !== null) throw t;
        }
      }
      function Xa(t, e, a, r) {
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
                var le = t, gl = C;
                nt = e;
                var ia = a;
                switch (gl.tag) {
                  case 1:
                    if (le = gl.payload, typeof le == "function") {
                      W = le.call(
                        ia,
                        W,
                        nt
                      );
                      break t;
                    }
                    W = le;
                    break t;
                  case 3:
                    le.flags = le.flags & -65537 | 128;
                  case 0:
                    if (le = gl.payload, nt = typeof le == "function" ? le.call(ia, W, nt) : le, nt == null) break t;
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
          throw Error(s(191, t));
        t.call(e);
      }
      function Gs(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            Ys(a[t], e);
      }
      function Ks(t, e) {
        t = cn, k(br, t), k(ja, e), cn = t | e.baseLanes;
      }
      function di() {
        k(br, cn), k(ja, ja.current);
      }
      function fi() {
        cn = br.current, N(ja), N(br);
      }
      function vn(t) {
        var e = t.alternate;
        k(qt, qt.current & 1), k(ke, t), je === null && (e === null || ja.current !== null || e.memoizedState !== null) && (je = t);
      }
      function mi(t) {
        k(qt, qt.current), k(ke, t), je === null && (je = t);
      }
      function Qs(t) {
        t.tag === 22 ? (k(qt, qt.current), k(ke, t), je === null && (je = t)) : yn();
      }
      function yn() {
        k(qt, qt.current), k(ke, ke.current);
      }
      function be(t) {
        N(ke), je === t && (je = null), N(qt);
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
      function Ht() {
        throw Error(s(321));
      }
      function pi(t, e) {
        if (e === null) return !1;
        for (var a = 0; a < e.length && a < t.length; a++)
          if (!_e(t[a], e[a])) return !1;
        return !0;
      }
      function hi(t, e, a, r, c, u) {
        return on = u, bt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, dt.H = t === null || t.memoizedState === null ? gd : Co, la = !1, u = a(r, c), la = !1, Oa && (u = Ls(
          e,
          a,
          r,
          c
        )), Vs(t), u;
      }
      function Vs(t) {
        dt.H = dl;
        var e = Mt !== null && Mt.next !== null;
        if (on = 0, Yt = Mt = bt = null, vr = !1, ul = 0, Ra = null, e) throw Error(s(300));
        t === null || Gt || (t = t.dependencies, t !== null && Tl(t) && (Gt = !0));
      }
      function Ls(t, e, a, r) {
        bt = t;
        var c = 0;
        do {
          if (Oa && (Ra = null), ul = 0, Oa = !1, 25 <= c) throw Error(s(301));
          if (c += 1, Yt = Mt = null, t.updateQueue != null) {
            var u = t.updateQueue;
            u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
          }
          dt.H = bd, u = e(a, r);
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
            throw bt.alternate === null ? Error(s(467)) : Error(s(310));
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
        return ul += 1, Ra === null && (Ra = []), t = Ds(Ra, t, e), e = bt, (Yt === null ? e.memoizedState : Yt.next) === null && (e = e.alternate, dt.H = e === null || e.memoizedState === null ? gd : Co), t;
      }
      function Yl(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Za(t);
          if (t.$$typeof === _n) return te(t);
        }
        throw Error(s(438, String(t)));
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
        if (r === null) throw Error(s(311));
        r.lastRenderedReducer = a;
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
              W = J.action, la && a(u, W), u = J.hasEagerState ? J.eagerState : a(u, W);
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
          if (Y === null ? b = u : Y.next = C, !_e(u, t.memoizedState) && (Gt = !0, tt && (a = Ta, a !== null)))
            throw a;
          t.memoizedState = u, t.baseState = b, t.baseQueue = Y, r.lastRenderedState = u;
        }
        return c === null && (r.lanes = 0), [t.memoizedState, r.dispatch];
      }
      function wi(t) {
        var e = Ut(), a = e.queue;
        if (a === null) throw Error(s(311));
        a.lastRenderedReducer = t;
        var r = a.dispatch, c = a.pending, u = e.memoizedState;
        if (c !== null) {
          a.pending = null;
          var b = c = c.next;
          do
            u = t(u, b.action), b = b.next;
          while (b !== c);
          _e(u, e.memoizedState) || (Gt = !0), e.memoizedState = u, e.baseQueue === null && (e.baseState = u), a.lastRenderedState = u;
        }
        return [u, r];
      }
      function Xs(t, e, a) {
        var r = bt, c = Ut(), u = kt;
        if (u) {
          if (a === void 0)
            throw Error(s(407));
          a = a();
        } else a = e();
        var b = !_e(
          (Mt || c).memoizedState,
          a
        );
        if (b && (c.memoizedState = a, Gt = !0), c = c.queue, Si(Ws.bind(null, r, c, t), [
          t
        ]), c.getSnapshot !== e || b || Yt !== null && Yt.memoizedState.tag & 1) {
          if (r.flags |= 2048, pa(
            9,
            { destroy: void 0 },
            Js.bind(
              null,
              r,
              c,
              a,
              e
            ),
            null
          ), At === null) throw Error(s(349));
          u || (on & 127) !== 0 || Zs(r, e, a);
        }
        return a;
      }
      function Zs(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = bt.updateQueue, e === null ? (e = ql(), bt.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function Js(t, e, a, r) {
        e.value = a, e.getSnapshot = r, Fs(e) && Is(t);
      }
      function Ws(t, e, a) {
        return a(function() {
          Fs(e) && Is(t);
        });
      }
      function Fs(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var a = e();
          return !_e(t, a);
        } catch {
          return !0;
        }
      }
      function Is(t) {
        var e = Xn(t, 2);
        e !== null && me(e, t, 2);
      }
      function _i(t) {
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
      function $s(t, e, a, r) {
        return t.baseState = a, xi(
          t,
          Mt,
          typeof r == "function" ? r : $e
        );
      }
      function Mm(t, e, a, r, c) {
        if (Vl(t)) throw Error(s(485));
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
          dt.T !== null ? a(!0) : u.isTransition = !1, r(u), a = e.pending, a === null ? (u.next = e.pending = u, Ps(e, u)) : (u.next = a.next, e.pending = a.next = u);
        }
      }
      function Ps(t, e) {
        var a = e.action, r = e.payload, c = t.state;
        if (e.isTransition) {
          var u = dt.T, b = {};
          dt.T = b;
          try {
            var C = a(c, r), Y = dt.S;
            Y !== null && Y(b, C), tc(t, e, C);
          } catch (J) {
            ki(t, e, J);
          } finally {
            u !== null && b.types !== null && (u.types = b.types), dt.T = u;
          }
        } else
          try {
            u = a(c, r), tc(t, e, u);
          } catch (J) {
            ki(t, e, J);
          }
      }
      function tc(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(r) {
            ec(t, e, r);
          },
          function(r) {
            return ki(t, e, r);
          }
        ) : ec(t, e, a);
      }
      function ec(t, e, a) {
        e.status = "fulfilled", e.value = a, nc(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, Ps(t, a)));
      }
      function ki(t, e, a) {
        var r = t.pending;
        if (t.pending = null, r !== null) {
          r = r.next;
          do
            e.status = "rejected", e.reason = a, nc(e), e = e.next;
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
        if (kt) {
          var a = At.formState;
          if (a !== null) {
            t: {
              var r = bt;
              if (kt) {
                if (Ot) {
                  var c = Zp(
                    Ot,
                    Me
                  );
                  if (c) {
                    Ot = $u(c), r = Jp(c);
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
          lastRenderedReducer: ac,
          lastRenderedState: e
        }, a.queue = r, a = _c.bind(
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
      function rc(t) {
        var e = Ut();
        return ic(e, Mt, t);
      }
      function ic(t, e, a) {
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
      function oc(t) {
        var e = Ut(), a = Mt;
        if (a !== null)
          return ic(e, a, t);
        Ut(), e = e.memoizedState, a = Ut();
        var r = a.queue.dispatch;
        return a.memoizedState = t, [e, r, !1];
      }
      function pa(t, e, a, r) {
        return t = { tag: t, create: a, deps: r, inst: e, next: null }, e = bt.updateQueue, e === null && (e = ql(), bt.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (r = a.next, a.next = t, t.next = r, e.lastEffect = t), t;
      }
      function sc() {
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
      function cc(t, e) {
        Kl(8390656, 8, t, e);
      }
      function Si(t, e) {
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
      function uc(t) {
        var e = Ut().memoizedState;
        return jm({ ref: e, nextImpl: t }), function() {
          if ((xt & 2) !== 0)
            throw Error(s(440));
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
      function pc(t, e, a) {
        a = a != null ? a.concat([t]) : null, Ql(
          4,
          4,
          mc.bind(null, e, t),
          a
        );
      }
      function Ei() {
      }
      function hc(t, e) {
        var a = Ut();
        e = e === void 0 ? null : e;
        var r = a.memoizedState;
        return e !== null && pi(e, r[1]) ? r[0] : (a.memoizedState = [t, e], t);
      }
      function gc(t, e) {
        var a = Ut();
        e = e === void 0 ? null : e;
        var r = a.memoizedState;
        if (e !== null && pi(e, r[1]))
          return r[0];
        if (r = t(), la) {
          X(!0);
          try {
            t();
          } finally {
            X(!1);
          }
        }
        return a.memoizedState = [r, e], r;
      }
      function zi(t, e, a) {
        return a === void 0 || (on & 1073741824) !== 0 && (_t & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = fu(), bt.lanes |= t, Cn |= t, a);
      }
      function bc(t, e, a, r) {
        return _e(a, e) ? a : ja.current !== null ? (t = zi(t, a, r), _e(t, e) || (Gt = !0), t) : (on & 42) === 0 || (on & 1073741824) !== 0 && (_t & 261930) === 0 ? (Gt = !0, t.memoizedState = a) : (t = fu(), bt.lanes |= t, Cn |= t, e);
      }
      function vc(t, e, a, r, c) {
        var u = ln();
        Wt(
          u !== 0 && 8 > u ? u : 8
        );
        var b = dt.T, C = {};
        dt.T = C, Ti(t, !1, e, a);
        try {
          var Y = c(), J = dt.S;
          if (J !== null && J(C, Y), Y !== null && typeof Y == "object" && typeof Y.then == "function") {
            var tt = Tm(
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
          Wt(u), b !== null && C.types !== null && (b.types = C.types), dt.T = b;
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
        return te($n);
      }
      function xc() {
        return Ut().memoizedState;
      }
      function wc() {
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
        }, Vl(t) ? kc(e, a) : (a = oi(t, e, a, r), a !== null && (me(a, t, r), Sc(a, e, r)));
      }
      function _c(t, e, a) {
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
        if (Vl(t)) kc(e, c);
        else {
          var u = t.alternate;
          if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null))
            try {
              var b = e.lastRenderedState, C = u(b, a);
              if (c.hasEagerState = !0, c.eagerState = C, _e(C, b))
                return Hl(t, e, c, 0), At === null && Dl(), !1;
            } catch {
            } finally {
            }
          if (a = oi(t, e, c, r), a !== null)
            return me(a, t, r), Sc(a, e, r), !0;
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
          if (e) throw Error(s(479));
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
      function kc(t, e) {
        Oa = vr = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function Sc(t, e, a) {
        if ((a & 4194048) !== 0) {
          var r = e.lanes;
          r &= t.pendingLanes, a |= r, e.lanes = a, h(t, a);
        }
      }
      function Ci(t, e, a, r) {
        e = t.memoizedState, a = a(r, e), a = a == null ? e : lo({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function Ec(t, e, a, r, c, u, b) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(r, u, b) : e.prototype && e.prototype.isPureReactComponent ? !jl(a, r) || !jl(c, u) : !0;
      }
      function zc(t, e, a, r) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, r), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, r), e.state !== t && Mo.enqueueReplaceState(e, e.state, null);
      }
      function Zn(t, e) {
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
      function Ll(t, e) {
        try {
          var a = t.onUncaughtError;
          a(e.value, { componentStack: e.stack });
        } catch (r) {
          setTimeout(function() {
            throw r;
          });
        }
      }
      function Nc(t, e, a) {
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
          Ll(t, e);
        }, a;
      }
      function Tc(t) {
        return t = gn(t), t.tag = 3, t;
      }
      function Cc(t, e, a, r) {
        var c = a.type.getDerivedStateFromError;
        if (typeof c == "function") {
          var u = r.value;
          t.payload = function() {
            return c(u);
          }, t.callback = function() {
            Nc(e, a, r);
          };
        }
        var b = a.stateNode;
        b !== null && typeof b.componentDidCatch == "function" && (t.callback = function() {
          Nc(e, a, r), typeof c != "function" && (Mn === null ? Mn = /* @__PURE__ */ new Set([this]) : Mn.add(this));
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
          ), a = ke.current, a !== null) {
            switch (a.tag) {
              case 31:
              case 13:
                return je === null ? tr() : a.alternate === null && Bt === 0 && (Bt = 3), a.flags &= -257, a.flags |= 65536, a.lanes = c, r === gr ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([r]) : e.add(r), Pi(t, r, c)), !1;
              case 22:
                return a.flags |= 65536, r === gr ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([r])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([r]) : a.add(r)), Pi(t, r, c)), !1;
            }
            throw Error(s(435, a.tag));
          }
          return Pi(t, r, c), tr(), !1;
        }
        if (kt)
          return e = ke.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = c, r !== _o && (t = Error(s(422), { cause: r }), Ga(
            G(t, a)
          ))) : (r !== _o && (e = Error(s(423), {
            cause: r
          }), Ga(
            G(e, a)
          )), t = t.current.alternate, t.flags |= 65536, c &= -c, t.lanes |= c, r = G(r, a), c = Mi(
            t.stateNode,
            r,
            c
          ), ui(t, c), Bt !== 4 && (Bt = 2)), !1;
        var u = Error(s(520), { cause: r });
        if (u = G(u, a), ml === null ? ml = [u] : ml.push(u), Bt !== 4 && (Bt = 2), e === null) return !0;
        r = G(r, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = c & -c, a.lanes |= t, t = Mi(a.stateNode, r, t), ui(a, t), !1;
            case 1:
              if (e = a.type, u = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (Mn === null || !Mn.has(
                u
              ))))
                return a.flags |= 65536, c &= -c, a.lanes |= c, c = Tc(c), Cc(
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
      function ee(t, e, a, r) {
        e.child = t === null ? hd(e, null, a, r) : aa(
          e,
          t.child,
          a,
          r
        );
      }
      function Mc(t, e, a, r, c) {
        a = a.render;
        var u = e.ref;
        if ("ref" in r) {
          var b = {};
          for (var C in r)
            C !== "ref" && (b[C] = r[C]);
        } else b = r;
        return Vn(e), r = hi(
          t,
          e,
          a,
          b,
          u,
          c
        ), C = gi(), t !== null && !Gt ? (bi(t, e, c), Pe(t, e, c)) : (kt && C && V(e), e.flags |= 1, ee(t, e, r, c), e.child);
      }
      function Ac(t, e, a, r, c) {
        if (t === null) {
          var u = a.type;
          return typeof u == "function" && !to(u) && u.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = u, jc(
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
        if (u = t.child, !Bi(t, c)) {
          var b = u.memoizedProps;
          if (a = a.compare, a = a !== null ? a : jl, a(b, r) && t.ref === e.ref)
            return Pe(
              t,
              e,
              c
            );
        }
        return e.flags |= 1, t = nn(u, r), t.ref = e.ref, t.return = e, e.child = t;
      }
      function jc(t, e, a, r, c) {
        if (t !== null) {
          var u = t.memoizedProps;
          if (jl(u, r) && t.ref === e.ref)
            if (Gt = !1, e.pendingProps = r = u, Bi(t, c))
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
      function Oc(t, e, a, r) {
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
            return Rc(
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
            ), u !== null ? Ks(e, u) : di(), Qs(e);
          else
            return r = e.lanes = 536870912, Rc(
              t,
              e,
              u !== null ? u.baseLanes | a : a,
              a,
              r
            );
        } else
          u !== null ? (Al(e, u.cachePool), Ks(e, u), yn(), e.memoizedState = null) : (t !== null && Al(e, null), di(), yn());
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
      function Rc(t, e, a, r, c) {
        var u = ii();
        return u = u === null ? null : {
          parent: an ? Rt._currentValue : Rt._currentValue2,
          pool: u
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: u
        }, t !== null && Al(e, null), di(), Qs(e), t !== null && fa(t, e, r, !0), e.childLanes = c, null;
      }
      function Xl(t, e) {
        return e = Jl(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function Dc(t, e, a) {
        return aa(e, t.child, null, a), t = Xl(
          e,
          e.pendingProps
        ), t.flags |= 2, be(e), e.memoizedState = null, t;
      }
      function Hm(t, e, a) {
        var r = e.pendingProps, c = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (kt) {
            if (r.mode === "hidden")
              return t = Xl(e, r), e.lanes = 536870912, Wa(null, t);
            if (mi(e), (t = Ot) ? (t = ah(
              t,
              Me
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: Sn !== null ? { id: Le, overflow: Xe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = ju(t), a.return = e, e.child = a, ae = e, Ot = null)) : t = null, t === null) throw ht(e);
            return e.lanes = 536870912, null;
          }
          return Xl(e, r);
        }
        var u = t.memoizedState;
        if (u !== null) {
          var b = u.dehydrated;
          if (mi(e), c)
            if (e.flags & 256)
              e.flags &= -257, e = Dc(
                t,
                e,
                a
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(s(558));
          else if (Gt || fa(
            t,
            e,
            a,
            !1
          ), c = (a & t.childLanes) !== 0, Gt || c) {
            if (r = At, r !== null && (b = _(r, a), b !== 0 && b !== u.retryLane))
              throw u.retryLane = b, Xn(t, b), me(r, t, b), Ao;
            tr(), e = Dc(
              t,
              e,
              a
            );
          } else
            t = u.treeContext, ce && (Ot = $p(b), ae = e, kt = !0, zn = null, Me = !1, t !== null && ot(e, t)), e = Xl(e, r), e.flags |= 4096;
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
            throw Error(s(284));
          (t === null || t.ref !== a) && (e.flags |= 4194816);
        }
      }
      function Ai(t, e, a, r, c) {
        return Vn(e), a = hi(
          t,
          e,
          a,
          r,
          void 0,
          c
        ), r = gi(), t !== null && !Gt ? (bi(t, e, c), Pe(t, e, c)) : (kt && r && V(e), e.flags |= 1, ee(t, e, a, c), e.child);
      }
      function Hc(t, e, a, r, c, u) {
        return Vn(e), e.updateQueue = null, a = Ls(
          e,
          r,
          a,
          c
        ), Vs(t), r = gi(), t !== null && !Gt ? (bi(t, e, u), Pe(t, e, u)) : (kt && r && V(e), e.flags |= 1, ee(t, e, a, u), e.child);
      }
      function Bc(t, e, a, r, c) {
        if (Vn(e), e.stateNode === null) {
          var u = ka, b = a.contextType;
          typeof b == "object" && b !== null && (u = te(b)), u = new a(r, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = Mo, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = r, u.state = e.memoizedState, u.refs = {}, si(e), b = a.contextType, u.context = typeof b == "object" && b !== null ? te(b) : ka, u.state = e.memoizedState, b = a.getDerivedStateFromProps, typeof b == "function" && (Ci(
            e,
            a,
            b,
            r
          ), u.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (b = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), b !== u.state && Mo.enqueueReplaceState(
            u,
            u.state,
            null
          ), Xa(e, r, u, c), La(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), r = !0;
        } else if (t === null) {
          u = e.stateNode;
          var C = e.memoizedProps, Y = Zn(a, C);
          u.props = Y;
          var J = u.context, tt = a.contextType;
          b = ka, typeof tt == "object" && tt !== null && (b = te(tt));
          var W = a.getDerivedStateFromProps;
          tt = typeof W == "function" || typeof u.getSnapshotBeforeUpdate == "function", C = e.pendingProps !== C, tt || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (C || J !== b) && zc(
            e,
            u,
            r,
            b
          ), Nn = !1;
          var nt = e.memoizedState;
          u.state = nt, Xa(e, r, u, c), La(), J = e.memoizedState, C || nt !== J || Nn ? (typeof W == "function" && (Ci(
            e,
            a,
            W,
            r
          ), J = e.memoizedState), (Y = Nn || Ec(
            e,
            a,
            Y,
            r,
            nt,
            J,
            b
          )) ? (tt || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = r, e.memoizedState = J), u.props = r, u.state = J, u.context = b, r = Y) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), r = !1);
        } else {
          u = e.stateNode, ci(t, e), b = e.memoizedProps, tt = Zn(a, b), u.props = tt, W = e.pendingProps, nt = u.context, J = a.contextType, Y = ka, typeof J == "object" && J !== null && (Y = te(J)), C = a.getDerivedStateFromProps, (J = typeof C == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (b !== W || nt !== Y) && zc(
            e,
            u,
            r,
            Y
          ), Nn = !1, nt = e.memoizedState, u.state = nt, Xa(e, r, u, c), La();
          var gt = e.memoizedState;
          b !== W || nt !== gt || Nn || t !== null && t.dependencies !== null && Tl(t.dependencies) ? (typeof C == "function" && (Ci(
            e,
            a,
            C,
            r
          ), gt = e.memoizedState), (tt = Nn || Ec(
            e,
            a,
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
        return u = r, Zl(t, e), r = (e.flags & 128) !== 0, u || r ? (u = e.stateNode, a = r && typeof a.getDerivedStateFromError != "function" ? null : u.render(), e.flags |= 1, t !== null && r ? (e.child = aa(
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
      function Uc(t, e, a, r) {
        return De(), e.flags |= 256, ee(t, e, a, r), e.child;
      }
      function ji(t) {
        return { baseLanes: t, cachePool: Os() };
      }
      function Oi(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= Ee), t;
      }
      function qc(t, e, a) {
        var r = e.pendingProps, c = !1, u = (e.flags & 128) !== 0, b;
        if ((b = u) || (b = t !== null && t.memoizedState === null ? !1 : (qt.current & 2) !== 0), b && (c = !0, e.flags &= -129), b = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (kt) {
            if (c ? vn(e) : yn(), (t = Ot) ? (t = lh(
              t,
              Me
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: Sn !== null ? { id: Le, overflow: Xe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = ju(t), a.return = e, e.child = a, ae = e, Ot = null)) : t = null, t === null) throw ht(e);
            return ho(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var C = r.children;
          return r = r.fallback, c ? (yn(), c = e.mode, C = Jl(
            { mode: "hidden", children: C },
            c
          ), r = Fn(
            r,
            c,
            a,
            null
          ), C.return = e, r.return = e, C.sibling = r, e.child = C, r = e.child, r.memoizedState = ji(a), r.childLanes = Oi(
            t,
            b,
            a
          ), e.memoizedState = jo, Wa(null, r)) : (vn(e), Ri(e, C));
        }
        var Y = t.memoizedState;
        if (Y !== null && (C = Y.dehydrated, C !== null)) {
          if (u)
            e.flags & 256 ? (vn(e), e.flags &= -257, e = Di(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (yn(), e.child = t.child, e.flags |= 128, e = null) : (yn(), C = r.fallback, c = e.mode, r = Jl(
              { mode: "visible", children: r.children },
              c
            ), C = Fn(
              C,
              c,
              a,
              null
            ), C.flags |= 2, r.return = e, C.return = e, r.sibling = C, e.child = r, aa(
              e,
              t.child,
              null,
              a
            ), r = e.child, r.memoizedState = ji(a), r.childLanes = Oi(
              t,
              b,
              a
            ), e.memoizedState = jo, e = Wa(null, r));
          else if (vn(e), ho(C))
            b = Lp(C).digest, r = Error(s(419)), r.stack = "", r.digest = b, Ga({ value: r, source: null, stack: null }), e = Di(
              t,
              e,
              a
            );
          else if (Gt || fa(
            t,
            e,
            a,
            !1
          ), b = (a & t.childLanes) !== 0, Gt || b) {
            if (b = At, b !== null && (r = _(
              b,
              a
            ), r !== 0 && r !== Y.retryLane))
              throw Y.retryLane = r, Xn(t, r), me(b, t, r), Ao;
            po(C) || tr(), e = Di(
              t,
              e,
              a
            );
          } else
            po(C) ? (e.flags |= 192, e.child = t.child, e = null) : (t = Y.treeContext, ce && (Ot = Pp(
              C
            ), ae = e, kt = !0, zn = null, Me = !1, t !== null && ot(e, t)), e = Ri(
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
          a,
          null
        ), C.flags |= 2), C.return = e, r.return = e, r.sibling = C, e.child = r, Wa(null, r), r = e.child, C = t.child.memoizedState, C === null ? C = ji(a) : (c = C.cachePool, c !== null ? (Y = an ? Rt._currentValue : Rt._currentValue2, c = c.parent !== Y ? { parent: Y, pool: Y } : c) : c = Os(), C = {
          baseLanes: C.baseLanes | a,
          cachePool: c
        }), r.memoizedState = C, r.childLanes = Oi(
          t,
          b,
          a
        ), e.memoizedState = jo, Wa(t.child, r)) : (vn(e), a = t.child, t = a.sibling, a = nn(a, {
          mode: "visible",
          children: r.children
        }), a.return = e, a.sibling = null, t !== null && (b = e.deletions, b === null ? (e.deletions = [t], e.flags |= 16) : b.push(t)), e.child = a, e.memoizedState = null, a);
      }
      function Ri(t, e) {
        return e = Jl(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Jl(t, e) {
        return t = o(22, t, null, e), t.lanes = 0, t;
      }
      function Di(t, e, a) {
        return aa(e, t.child, null, a), t = Ri(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function Yc(t, e, a) {
        t.lanes |= e;
        var r = t.alternate;
        r !== null && (r.lanes |= e), ni(t.return, e, a);
      }
      function Hi(t, e, a, r, c, u) {
        var b = t.memoizedState;
        b === null ? t.memoizedState = {
          isBackwards: e,
          rendering: null,
          renderingStartTime: 0,
          last: r,
          tail: a,
          tailMode: c,
          treeForkCount: u
        } : (b.isBackwards = e, b.rendering = null, b.renderingStartTime = 0, b.last = r, b.tail = a, b.tailMode = c, b.treeForkCount = u);
      }
      function Gc(t, e, a) {
        var r = e.pendingProps, c = r.revealOrder, u = r.tail;
        r = r.children;
        var b = qt.current, C = (b & 2) !== 0;
        if (C ? (b = b & 1 | 2, e.flags |= 128) : b &= 1, k(qt, b), ee(t, e, r, a), r = kt ? il : 0, !C && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && Yc(t, a, e);
            else if (t.tag === 19)
              Yc(t, a, e);
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
            a = c, a === null ? (c = e.child, e.child = null) : (c = a.sibling, a.sibling = null), Hi(
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
            Hi(
              e,
              !0,
              a,
              null,
              u,
              r
            );
            break;
          case "together":
            Hi(
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
      function Bi(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && Tl(t)));
      }
      function Bm(t, e, a) {
        switch (e.tag) {
          case 3:
            st(
              e,
              e.stateNode.containerInfo
            ), hn(e, Rt, t.memoizedState.cache), De();
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
              return e.flags |= 128, mi(e), null;
            break;
          case 13:
            var r = e.memoizedState;
            if (r !== null)
              return r.dehydrated !== null ? (vn(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? qc(
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
                return Gc(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (c = e.memoizedState, c !== null && (c.rendering = null, c.tail = null, c.lastEffect = null), k(qt, qt.current), r) break;
            return null;
          case 22:
            return e.lanes = 0, Oc(
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
      function Kc(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Gt = !0;
          else {
            if (!Bi(t, a) && (e.flags & 128) === 0)
              return Gt = !1, Bm(
                t,
                e,
                a
              );
            Gt = (t.flags & 131072) !== 0;
          }
        else
          Gt = !1, kt && (e.flags & 1048576) !== 0 && T(e, il, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var r = e.pendingProps;
              if (t = Ln(e.elementType), e.type = t, typeof t == "function")
                to(t) ? (r = Zn(t, r), e.tag = 1, e = Bc(
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
                    e.tag = 11, e = Mc(
                      null,
                      e,
                      t,
                      r,
                      a
                    );
                    break t;
                  } else if (c === co) {
                    e.tag = 14, e = Ac(
                      null,
                      e,
                      t,
                      r,
                      a
                    );
                    break t;
                  }
                }
                throw e = E(t) || t, Error(s(306, e, ""));
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
            return r = e.type, c = Zn(
              r,
              e.pendingProps
            ), Bc(
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
              c = e.memoizedState, r = c.element, ci(t, e), Xa(e, u, null, a);
              var b = e.memoizedState;
              if (u = b.cache, hn(e, Rt, u), u !== c.cache && ai(
                e,
                [Rt],
                a,
                !0
              ), La(), u = b.element, ce && c.isDehydrated)
                if (c = {
                  element: u,
                  isDehydrated: !1,
                  cache: b.cache
                }, e.updateQueue.baseState = c, e.memoizedState = c, e.flags & 256) {
                  e = Uc(
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
                  ), Ga(r), e = Uc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else
                  for (ce && (Ot = Ip(
                    e.stateNode.containerInfo
                  ), ae = e, kt = !0, zn = null, Me = !0), a = hd(
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
                ee(t, e, u, a);
              }
              e = e.child;
            }
            return e;
          case 26:
            if (qe)
              return Zl(t, e), t === null ? (a = ed(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : kt || (e.stateNode = Sh(
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
              return St(e), t === null && Vt && kt && (r = e.stateNode = od(
                e.type,
                e.pendingProps,
                En.current,
                ne.current,
                !1
              ), ae = e, Me = !0, Ot = th(
                e.type,
                r,
                Ot
              )), ee(
                t,
                e,
                e.pendingProps.children,
                a
              ), Zl(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && kt && (wh(
              e.type,
              e.pendingProps,
              ne.current
            ), (c = r = Ot) && (r = eh(
              r,
              e.type,
              e.pendingProps,
              Me
            ), r !== null ? (e.stateNode = r, ae = e, Ot = Fp(r), Me = !1, c = !0) : c = !1), c || ht(e)), St(e), c = e.type, u = e.pendingProps, b = t !== null ? t.memoizedProps : null, r = u.children, rr(c, u) ? r = null : b !== null && rr(c, b) && (e.flags |= 32), e.memoizedState !== null && (c = hi(
              t,
              e,
              Cm,
              null,
              null,
              a
            ), an ? $n._currentValue = c : $n._currentValue2 = c), Zl(t, e), ee(t, e, r, a), e.child;
          case 6:
            return t === null && kt && (_h(
              e.pendingProps,
              ne.current
            ), (t = a = Ot) && (a = nh(
              a,
              e.pendingProps,
              Me
            ), a !== null ? (e.stateNode = a, ae = e, Ot = null, t = !0) : t = !1), t || ht(e)), null;
          case 13:
            return qc(t, e, a);
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
            return Mc(
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
            return Ac(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return jc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 19:
            return Gc(
              t,
              e,
              a
            );
          case 31:
            return Hm(t, e, a);
          case 22:
            return Oc(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Vn(e), r = te(Rt), t === null ? (c = ii(), c === null && (c = At, u = li(), c.pooledCache = u, u.refCount++, u !== null && (c.pooledCacheLanes |= a), c = u), e.memoizedState = {
              parent: r,
              cache: c
            }, si(e), hn(e, Rt, c)) : ((t.lanes & a) !== 0 && (ci(t, e), Xa(e, null, null, a), La()), c = t.memoizedState, u = e.memoizedState, c.parent !== r ? (c = { parent: r, cache: r }, e.memoizedState = c, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = c), hn(e, Rt, r)) : (r = u.cache, hn(e, Rt, r), r !== c.cache && ai(
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
        else if (Ve)
          for (var c = e.child; c !== null; ) {
            if (c.tag === 5) {
              var u = c.stateNode;
              a && r && (u = Fu(
                u,
                c.type,
                c.memoizedProps
              )), fo(t, u);
            } else if (c.tag === 6)
              u = c.stateNode, a && r && (u = Iu(
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
      function Vc(t, e, a, r) {
        var c = !1;
        if (Ve)
          for (var u = e.child; u !== null; ) {
            if (u.tag === 5) {
              var b = u.stateNode;
              a && r && (b = Fu(
                b,
                u.type,
                u.memoizedProps
              )), Ju(t, b);
            } else if (u.tag === 6)
              b = u.stateNode, a && r && (b = Iu(
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
      function Lc(t, e) {
        if (Ve && Qc(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, r = Zu();
          Vc(r, e, !1, !1), t.pendingChildren = r, He(e), Vp(a, r);
        }
      }
      function qi(t, e, a, r) {
        if (se)
          t.memoizedProps !== r && He(e);
        else if (Ve) {
          var c = t.stateNode, u = t.memoizedProps;
          if ((t = Qc(t, e)) || u !== r) {
            var b = ne.current;
            u = Qp(
              c,
              a,
              u,
              r,
              !t,
              null
            ), u === c ? e.stateNode = c : (Wl(e), Ku(
              u,
              a,
              r,
              b
            ) && He(e), e.stateNode = u, t && Ui(u, e, !1, !1));
          } else e.stateNode = c;
        }
      }
      function Yi(t, e, a, r, c) {
        if ((t.mode & 32) !== 0 && (a === null ? gp(e, r) : bp(e, a, r))) {
          if (t.flags |= 16777216, (c & 335544128) === c || mo(e, r))
            if (Vu(t.stateNode, e, r))
              t.flags |= 8192;
            else if (bu()) t.flags |= 8192;
            else
              throw na = gr, zo;
        } else t.flags &= -16777217;
      }
      function Xc(t, e) {
        if (zh(e)) {
          if (t.flags |= 16777216, !id(e))
            if (bu()) t.flags |= 8192;
            else
              throw na = gr, zo;
        } else t.flags &= -16777217;
      }
      function Fl(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? L() : 536870912, t.lanes |= e, Ba |= e);
      }
      function Fa(t, e) {
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
            return a = e.stateNode, r = null, t !== null && (r = t.memoizedState.cache), e.memoizedState.cache !== r && (e.flags |= 2048), Ie(Rt), ut(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (Re(e) ? He(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, pn())), Lc(t, e), jt(e), null;
          case 26:
            if (qe) {
              var c = e.type, u = e.memoizedState;
              return t === null ? (He(e), u !== null ? (jt(e), Xc(
                e,
                u
              )) : (jt(e), Yi(
                e,
                c,
                null,
                r,
                a
              ))) : u ? u !== t.memoizedState ? (He(e), jt(e), Xc(
                e,
                u
              )) : (jt(e), e.flags &= -16777217) : (u = t.memoizedProps, se ? u !== r && He(e) : qi(
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
              if (Jt(e), a = En.current, c = e.type, t !== null && e.stateNode != null)
                se ? t.memoizedProps !== r && He(e) : qi(t, e, c, r);
              else {
                if (!r) {
                  if (e.stateNode === null)
                    throw Error(s(166));
                  return jt(e), null;
                }
                t = ne.current, Re(e) ? Kn(e, t) : (t = od(
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
              qi(t, e, c, r);
            else {
              if (!r) {
                if (e.stateNode === null)
                  throw Error(s(166));
                return jt(e), null;
              }
              if (u = ne.current, Re(e))
                Kn(e, u), hh(
                  e.stateNode,
                  c,
                  r,
                  u
                ) && (e.flags |= 64);
              else {
                var b = sp(
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
                ) && He(e);
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
              a = t.memoizedProps, se ? a !== r && He(e) : Ve && (a !== r ? (t = En.current, a = ne.current, Wl(e), e.stateNode = Qu(
                r,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof r != "string" && e.stateNode === null)
                throw Error(s(166));
              if (t = En.current, a = ne.current, Re(e)) {
                if (!ce) throw Error(s(176));
                if (t = e.stateNode, a = e.memoizedProps, r = null, c = ae, c !== null)
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
                Wl(e), e.stateNode = Qu(
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
                  if (!r) throw Error(s(318));
                  if (!ce) throw Error(s(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(557));
                  oh(t, e);
                } else
                  De(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), t = !1;
              } else
                a = pn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = !0;
              if (!t)
                return e.flags & 256 ? (be(e), e) : (be(e), null);
              if ((e.flags & 128) !== 0)
                throw Error(s(558));
            }
            return jt(e), null;
          case 13:
            if (r = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (c = Re(e), r !== null && r.dehydrated !== null) {
                if (t === null) {
                  if (!c) throw Error(s(318));
                  if (!ce) throw Error(s(344));
                  if (c = e.memoizedState, c = c !== null ? c.dehydrated : null, !c) throw Error(s(317));
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
            return ut(), Lc(t, e), t === null && fp(e.stateNode.containerInfo), jt(e), null;
          case 10:
            return Ie(e.type), jt(e), null;
          case 19:
            if (N(qt), r = e.memoizedState, r === null) return jt(e), null;
            if (c = (e.flags & 128) !== 0, u = r.rendering, u === null)
              if (c) Fa(r, !1);
              else {
                if (Bt !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (u = Ul(t), u !== null) {
                      for (e.flags |= 128, Fa(r, !1), t = u.updateQueue, e.updateQueue = t, Fl(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        Au(a, t), a = a.sibling;
                      return k(
                        qt,
                        qt.current & 1 | 2
                      ), kt && K(e, r.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                r.tail !== null && pe() > pl && (e.flags |= 128, c = !0, Fa(r, !1), e.lanes = 4194304);
              }
            else {
              if (!c)
                if (t = Ul(u), t !== null) {
                  if (e.flags |= 128, c = !0, t = t.updateQueue, e.updateQueue = t, Fl(e, t), Fa(r, !0), r.tail === null && r.tailMode === "hidden" && !u.alternate && !kt)
                    return jt(e), null;
                } else
                  2 * pe() - r.renderingStartTime > pl && a !== 536870912 && (e.flags |= 128, c = !0, Fa(r, !1), e.lanes = 4194304);
              r.isBackwards ? (u.sibling = e.child, e.child = u) : (t = r.last, t !== null ? t.sibling = u : e.child = u, r.last = u);
            }
            return r.tail !== null ? (t = r.tail, r.rendering = t, r.tail = t.sibling, r.renderingStartTime = pe(), t.sibling = null, a = qt.current, k(
              qt,
              c ? a & 1 | 2 : a & 1
            ), kt && K(e, r.treeForkCount), t) : (jt(e), null);
          case 22:
          case 23:
            return be(e), fi(), r = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== r && (e.flags |= 8192) : r && (e.flags |= 8192), r ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (jt(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : jt(e), a = e.updateQueue, a !== null && Fl(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), r = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (r = e.memoizedState.cachePool.pool), r !== a && (e.flags |= 2048), t !== null && N(ea), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Ie(Rt), jt(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(s(156, e.tag));
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
            return Jt(e), null;
          case 31:
            if (e.memoizedState !== null) {
              if (be(e), e.alternate === null)
                throw Error(s(340));
              De();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (be(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(s(340));
              De();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 19:
            return N(qt), null;
          case 4:
            return ut(), null;
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
          var a = e.updateQueue, r = a !== null ? a.lastEffect : null;
          if (r !== null) {
            var c = r.next;
            a = c;
            do {
              if ((a.tag & t) === t) {
                r = void 0;
                var u = a.create, b = a.inst;
                r = u(), b.destroy = r;
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
                var b = r.inst, C = b.destroy;
                if (C !== void 0) {
                  b.destroy = void 0, c = e;
                  var Y = a, J = C;
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
      function Jc(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            Gs(e, a);
          } catch (r) {
            zt(t, t.return, r);
          }
        }
      }
      function Wc(t, e, a) {
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
      function Qe(t, e) {
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
      function Fc(t) {
        var e = t.type, a = t.memoizedProps, r = t.stateNode;
        try {
          jp(r, e, a, t);
        } catch (c) {
          zt(t, t.return, c);
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
          zt(t, t.return, r);
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
      function $c(t, e, a) {
        t = t.containerInfo;
        try {
          Wu(t, a);
        } catch (r) {
          zt(e, e.return, r);
        }
      }
      function Pc(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          Th(
            t.type,
            a,
            e,
            t
          );
        } catch (r) {
          zt(t, t.return, r);
        }
      }
      function Ym(t, e) {
        for (ip(t.containerInfo), Ft = e; Ft !== null; )
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
                      var b = Zn(
                        r.type,
                        c
                      );
                      e = u.getSnapshotBeforeUpdate(
                        b,
                        a
                      ), u.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (C) {
                      zt(r, r.return, C);
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
                    throw Error(s(163));
              }
              if (e = t.sibling, e !== null) {
                e.return = t.return, Ft = e;
                break;
              }
              Ft = t.return;
            }
      }
      function tu(t, e, a) {
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
            r & 64 && Jc(a), r & 512 && $a(a, a.return);
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
                Gs(r, t);
              } catch (b) {
                zt(a, a.return, b);
              }
            }
            break;
          case 27:
            Vt && e === null && r & 4 && Pc(a);
          case 26:
          case 5:
            if (tn(t, a), e === null) {
              if (r & 4) Fc(a);
              else if (r & 64) {
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
            r & 512 && $a(a, a.return);
            break;
          case 12:
            tn(t, a);
            break;
          case 31:
            tn(t, a), r & 4 && nu(t, a);
            break;
          case 13:
            tn(t, a), r & 4 && au(t, a), r & 64 && (r = a.memoizedState, r !== null && (r = r.dehydrated, r !== null && (a = Zm.bind(
              null,
              a
            ), Xp(r, a))));
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
      function eu(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, eu(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && hp(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function Be(t, e, a) {
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
              Kt || Qe(a, e), Be(
                t,
                e,
                a
              ), a.memoizedState ? ad(a.memoizedState) : a.stateNode && rd(a.stateNode);
              break;
            }
          case 27:
            if (Vt) {
              Kt || Qe(a, e);
              var r = Qt, c = he;
              wa(a.type) && (Qt = a.stateNode, he = !1), Be(
                t,
                e,
                a
              ), sd(a.stateNode), Qt = r, he = c;
              break;
            }
          case 5:
            Kt || Qe(a, e);
          case 6:
            if (se) {
              if (r = Qt, c = he, Qt = null, Be(
                t,
                e,
                a
              ), Qt = r, he = c, Qt !== null)
                if (he)
                  try {
                    Bp(Qt, a.stateNode);
                  } catch (u) {
                    zt(
                      a,
                      e,
                      u
                    );
                  }
                else
                  try {
                    Hp(Qt, a.stateNode);
                  } catch (u) {
                    zt(
                      a,
                      e,
                      u
                    );
                  }
            } else
              Be(
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
            se ? (r = Qt, c = he, Qt = a.stateNode.containerInfo, he = !0, Be(
              t,
              e,
              a
            ), Qt = r, he = c) : (Ve && $c(
              a.stateNode,
              a,
              Zu()
            ), Be(
              t,
              e,
              a
            ));
            break;
          case 0:
          case 11:
          case 14:
          case 15:
            xn(2, a, e), Kt || xn(4, a, e), Be(
              t,
              e,
              a
            );
            break;
          case 1:
            Kt || (Qe(a, e), r = a.stateNode, typeof r.componentWillUnmount == "function" && Wc(
              a,
              e,
              r
            )), Be(
              t,
              e,
              a
            );
            break;
          case 21:
            Be(
              t,
              e,
              a
            );
            break;
          case 22:
            Kt = (r = Kt) || a.memoizedState !== null, Be(
              t,
              e,
              a
            ), Kt = r;
            break;
          default:
            Be(
              t,
              e,
              a
            );
        }
      }
      function nu(t, e) {
        if (ce && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            mh(t);
          } catch (a) {
            zt(e, e.return, a);
          }
        }
      }
      function au(t, e) {
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
            return e === null && (e = t.stateNode = new vd()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new vd()), e;
          default:
            throw Error(s(435, t.tag));
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
            var c = a[r], u = t, b = e;
            if (se) {
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
              if (Qt === null) throw Error(s(160));
              Vi(u, b, c), Qt = null, he = !1;
            } else Vi(u, b, c);
            u = c.alternate, u !== null && (u.return = null), c.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            lu(e, t), e = e.sibling;
      }
      function lu(t, e) {
        var a = t.alternate, r = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            oe(e, t), fe(t), r & 4 && (xn(3, t, t.return), Ia(3, t), xn(5, t, t.return));
            break;
          case 1:
            oe(e, t), fe(t), r & 512 && (Kt || a === null || Qe(a, a.return)), r & 64 && sn && (t = t.updateQueue, t !== null && (r = t.callbacks, r !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? r : a.concat(r))));
            break;
          case 26:
            if (qe) {
              var c = Ye;
              if (oe(e, t), fe(t), r & 512 && (Kt || a === null || Qe(a, a.return)), r & 4) {
                r = a !== null ? a.memoizedState : null;
                var u = t.memoizedState;
                a === null ? u === null ? t.stateNode === null ? t.stateNode = kh(
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
                ) : r !== u ? (r === null ? a.stateNode !== null && rd(a.stateNode) : ad(r), u === null ? ld(
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
                  a.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Vt) {
              oe(e, t), fe(t), r & 512 && (Kt || a === null || Qe(a, a.return)), a !== null && r & 4 && Gi(
                t,
                t.memoizedProps,
                a.memoizedProps
              );
              break;
            }
          case 5:
            if (oe(e, t), fe(t), r & 512 && (Kt || a === null || Qe(a, a.return)), se) {
              if (t.flags & 32) {
                c = t.stateNode;
                try {
                  Xu(c);
                } catch (W) {
                  zt(t, t.return, W);
                }
              }
              r & 4 && t.stateNode != null && (c = t.memoizedProps, Gi(
                t,
                c,
                a !== null ? a.memoizedProps : c
              )), r & 1024 && (Oo = !0);
            } else
              Ve && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (oe(e, t), fe(t), r & 4 && se) {
              if (t.stateNode === null)
                throw Error(s(162));
              r = t.memoizedProps, a = a !== null ? a.memoizedProps : r, c = t.stateNode;
              try {
                Ap(c, a, r);
              } catch (W) {
                zt(t, t.return, W);
              }
            }
            break;
          case 3:
            if (qe ? (Eh(), c = Ye, Ye = go(e.containerInfo), oe(e, t), Ye = c) : oe(e, t), fe(t), r & 4) {
              if (se && ce && a !== null && a.memoizedState.isDehydrated)
                try {
                  fh(e.containerInfo);
                } catch (W) {
                  zt(t, t.return, W);
                }
              if (Ve) {
                r = e.containerInfo, a = e.pendingChildren;
                try {
                  Wu(r, a);
                } catch (W) {
                  zt(t, t.return, W);
                }
              }
            }
            Oo && (Oo = !1, ru(t));
            break;
          case 4:
            qe ? (a = Ye, Ye = go(
              t.stateNode.containerInfo
            ), oe(e, t), fe(t), Ye = a) : (oe(e, t), fe(t)), r & 4 && Ve && $c(
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
            var b = a !== null && a.memoizedState !== null, C = sn, Y = Kt;
            if (sn = C || c, Kt = Y || b, oe(e, t), Kt = Y, sn = C, fe(t), r & 8192 && (e = t.stateNode, e._visibility = c ? e._visibility & -2 : e._visibility | 1, c && (a === null || b || sn || Kt || Jn(t)), se)) {
              t: if (a = null, se)
                for (e = t; ; ) {
                  if (e.tag === 5 || qe && e.tag === 26) {
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
                        var tt = b.stateNode;
                        c ? yh(tt) : xh(b.stateNode);
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
              if (Ic(r)) {
                a = r;
                break;
              }
              r = r.return;
            }
            if (se) {
              if (a == null) throw Error(s(160));
              switch (a.tag) {
                case 27:
                  if (Vt) {
                    var c = a.stateNode, u = Ki(t);
                    Il(t, u, c);
                    break;
                  }
                case 5:
                  var b = a.stateNode;
                  a.flags & 32 && (Xu(b), a.flags &= -33);
                  var C = Ki(t);
                  Il(t, C, b);
                  break;
                case 3:
                case 4:
                  var Y = a.stateNode.containerInfo, J = Ki(t);
                  Qi(
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
      function ru(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            ru(e), e.tag === 5 && e.flags & 1024 && xp(e.stateNode), t = t.sibling;
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
              var a = e.stateNode;
              typeof a.componentWillUnmount == "function" && Wc(
                e,
                e.return,
                a
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
      function en(t, e, a) {
        for (a = a && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
          var r = e.alternate, c = t, u = e, b = u.flags;
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
                } catch (J) {
                  zt(r, r.return, J);
                }
              if (r = u, c = r.updateQueue, c !== null) {
                var C = r.stateNode;
                try {
                  var Y = c.shared.hiddenCallbacks;
                  if (Y !== null)
                    for (c.shared.hiddenCallbacks = null, c = 0; c < Y.length; c++)
                      Ys(Y[c], C);
                } catch (J) {
                  zt(r, r.return, J);
                }
              }
              a && b & 64 && Jc(u), $a(u, u.return);
              break;
            case 27:
              Vt && Pc(u);
            case 26:
            case 5:
              en(
                c,
                u,
                a
              ), a && r === null && b & 4 && Fc(u), $a(u, u.return);
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
              ), a && b & 4 && nu(c, u);
              break;
            case 13:
              en(
                c,
                u,
                a
              ), a && b & 4 && au(c, u);
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
      function Li(t, e) {
        var a = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && Ka(a));
      }
      function Xi(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Ka(t));
      }
      function Ue(t, e, a, r) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            iu(
              t,
              e,
              a,
              r
            ), e = e.sibling;
      }
      function iu(t, e, a, r) {
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
            u = e.stateNode, b = e.alternate, e.memoizedState !== null ? u._visibility & 2 ? Ue(
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
            )), c & 2048 && Li(b, e);
            break;
          case 24:
            Ue(
              t,
              e,
              a,
              r
            ), c & 2048 && Xi(e.alternate, e);
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
          var u = t, b = e, C = a, Y = r, J = b.flags;
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
              )), c && J & 2048 && Li(
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
              ), c && J & 2048 && Xi(b.alternate, b);
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
            var a = t, r = e, c = r.flags;
            switch (r.tag) {
              case 22:
                Pa(a, r), c & 2048 && Li(
                  r.alternate,
                  r
                );
                break;
              case 24:
                Pa(a, r), c & 2048 && Xi(
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
      function Wn(t, e, a) {
        if (t.subtreeFlags & Da)
          for (t = t.child; t !== null; )
            ou(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function ou(t, e, a) {
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
                  Ye,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var r = t.stateNode, c = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || mo(c, t)) && Lu(a, r, c, t);
              }
            break;
          case 5:
            Wn(
              t,
              e,
              a
            ), t.flags & Da && (r = t.stateNode, c = t.type, t = t.memoizedProps, ((e & 335544128) === e || mo(c, t)) && Lu(a, r, c, t));
            break;
          case 3:
          case 4:
            qe ? (r = Ye, Ye = go(
              t.stateNode.containerInfo
            ), Wn(
              t,
              e,
              a
            ), Ye = r) : Wn(
              t,
              e,
              a
            );
            break;
          case 22:
            t.memoizedState === null && (r = t.alternate, r !== null && r.memoizedState !== null ? (r = Da, Da = 16777216, Wn(
              t,
              e,
              a
            ), Da = r) : Wn(
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
            for (var a = 0; a < e.length; a++) {
              var r = e[a];
              Ft = r, uu(
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
            for (var a = 0; a < e.length; a++) {
              var r = e[a];
              Ft = r, uu(
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
              a = e.stateNode, a._visibility & 2 && (a._visibility &= -3, Pl(e));
              break;
            default:
              Pl(e);
          }
          t = t.sibling;
        }
      }
      function uu(t, e) {
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
              Ka(a.memoizedState.cache);
          }
          if (r = a.child, r !== null) r.return = a, Ft = r;
          else
            t: for (a = t; Ft !== null; ) {
              r = Ft;
              var c = r.sibling, u = r.return;
              if (eu(r), r === a) {
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
      function Zi(t) {
        var e = dp(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(s(364));
          return e;
        }
        if (t = kp(t), t === null) throw Error(s(362));
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
                var r = t[a++], c = r.tag, u = t[a++], b = e[u];
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
            if ((a === 5 || a === 26 || a === 27) && zp(t.stateNode, e.value))
              return !0;
            break;
          case Sr:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = Ep(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case kr:
            if ((a === 5 || a === 26 || a === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(s(365));
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
          case Sr:
            return '"' + t.value + '"';
          case kr:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(s(365));
        }
      }
      function du(t, e) {
        var a = [];
        t = [t, 0];
        for (var r = 0; r < t.length; ) {
          var c = t[r++], u = c.tag, b = t[r++], C = e[b];
          if (u !== 5 && u !== 26 && u !== 27 || !ll(c)) {
            for (; C != null && Ji(c, C); )
              b++, C = e[b];
            if (b === e.length) a.push(c);
            else
              for (c = c.child; c !== null; )
                t.push(c, b), c = c.sibling;
          }
        }
        return a;
      }
      function Fi(t, e) {
        if (!al) throw Error(s(363));
        t = Zi(t), t = du(t, e), e = [], t = Array.from(t);
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
      function fu() {
        if (Ee === 0)
          if ((_t & 536870912) === 0 || kt) {
            var t = or;
            or <<= 1, (or & 3932160) === 0 && (or = 262144), Ee = t;
          } else Ee = 536870912;
        return t = ke.current, t !== null && (t.flags |= 32), Ee;
      }
      function me(t, e, a) {
        (t === At && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null) && (ga(t, 0), wn(
          t,
          _t,
          Ee,
          !1
        )), R(t, a), ((xt & 2) === 0 || t !== At) && (t === At && ((xt & 2) === 0 && (ra |= a), Bt === 4 && wn(
          t,
          _t,
          Ee,
          !1
        )), Ke(t));
      }
      function mu(t, e, a) {
        if ((xt & 6) !== 0) throw Error(s(327));
        var r = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || D(t, e), c = r ? Vm(t, e) : $i(t, e, !0), u = r;
        do {
          if (c === 0) {
            Ha && !r && wn(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, u && !Km(a)) {
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
                  var Y = ce && C.current.memoizedState.isDehydrated;
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
                  throw Error(s(345));
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
                  throw Error(s(329));
              }
              if ((e & 62914560) === e && (c = Er + 300 - pe(), 10 < c)) {
                if (wn(
                  r,
                  e,
                  Ee,
                  !Tn
                ), O(r, 0, !0) !== 0) break t;
                un = e, r.timeoutHandle = cp(
                  pu.bind(
                    null,
                    r,
                    a,
                    ge,
                    zr,
                    Ho,
                    e,
                    Ee,
                    ra,
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
              pu(
                r,
                a,
                ge,
                zr,
                Ho,
                e,
                Ee,
                ra,
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
      function pu(t, e, a, r, c, u, b, C, Y, J, tt, W, nt, gt) {
        if (t.timeoutHandle = In, W = e.subtreeFlags, W & 8192 || (W & 16785408) === 16785408) {
          W = vp(), ou(
            e,
            u,
            W
          );
          var le = (u & 62914560) === u ? Er - pe() : (u & 4194048) === u ? yd - pe() : 0;
          if (le = yp(
            W,
            le
          ), le !== null) {
            un = u, t.cancelPendingCommit = le(
              ku.bind(
                null,
                t,
                e,
                u,
                a,
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
        ku(
          t,
          e,
          u,
          a,
          r,
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
        e &= ~Do, e &= ~ra, t.suspendedLanes |= e, t.pingedLanes &= ~e, r && (t.warmLanes |= e), r = t.expirationTimes;
        for (var c = e; 0 < c; ) {
          var u = 31 - xe(c), b = 1 << u;
          r[u] = -1, c &= ~b;
        }
        a !== 0 && v(t, a, e);
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
        var a = t.timeoutHandle;
        a !== In && (t.timeoutHandle = In, up(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), un = 0, Ii(), At = t, wt = a = nn(t.current, null), _t = e, Ct = 0, Se = null, Tn = !1, Ha = D(t, e), Ro = !1, Ba = Ee = Do = ra = Cn = Bt = 0, ge = ml = null, Ho = !1, (e & 8) !== 0 && (e |= e & 32);
        var r = t.entangledLanes;
        if (r !== 0)
          for (t = t.entanglements, r &= e; 0 < r; ) {
            var c = 31 - xe(r), u = 1 << c;
            e |= t[c], r &= ~u;
          }
        return cn = e, Dl(), a;
      }
      function gu(t, e) {
        bt = null, dt.H = dl, e === Ca || e === hr ? (e = Hs(), Ct = 3) : e === zo ? (e = Hs(), Ct = 4) : Ct = e === Ao ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, Se = e, wt === null && (Bt = 1, Ll(
          t,
          G(e, t.current)
        ));
      }
      function bu() {
        var t = ke.current;
        return t === null ? !0 : (_t & 4194048) === _t ? je === null : (_t & 62914560) === _t || (_t & 536870912) !== 0 ? t === je : !1;
      }
      function vu() {
        var t = dt.H;
        return dt.H = dl, t === null ? dl : t;
      }
      function yu() {
        var t = dt.A;
        return dt.A = Kh, t;
      }
      function tr() {
        Bt = 4, Tn || (_t & 4194048) !== _t && ke.current !== null || (Ha = !0), (Cn & 134217727) === 0 && (ra & 134217727) === 0 || At === null || wn(
          At,
          _t,
          Ee,
          !1
        );
      }
      function $i(t, e, a) {
        var r = xt;
        xt |= 2;
        var c = vu(), u = yu();
        (At !== t || _t !== e) && (zr = null, ga(t, e)), e = !1;
        var b = Bt;
        t: do
          try {
            if (Ct !== 0 && wt !== null) {
              var C = wt, Y = Se;
              switch (Ct) {
                case 8:
                  Ii(), b = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  ke.current === null && (e = !0);
                  var J = Ct;
                  if (Ct = 0, Se = null, ba(t, C, Y, J), a && Ha) {
                    b = 0;
                    break t;
                  }
                  break;
                default:
                  J = Ct, Ct = 0, Se = null, ba(t, C, Y, J);
              }
            }
            Qm(), b = Bt;
            break;
          } catch (tt) {
            gu(t, tt);
          }
        while (!0);
        return e && t.shellSuspendCounter++, rn = Pn = null, xt = r, dt.H = c, dt.A = u, wt === null && (At = null, _t = 0, Dl()), b;
      }
      function Qm() {
        for (; wt !== null; ) xu(wt);
      }
      function Vm(t, e) {
        var a = xt;
        xt |= 2;
        var r = vu(), c = yu();
        At !== t || _t !== e ? (zr = null, pl = pe() + 500, ga(t, e)) : Ha = D(
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
                  if (Rs(u)) {
                    Ct = 0, Se = null, wu(e);
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
                  Rs(u) ? (Ct = 0, Se = null, wu(e)) : (Ct = 0, Se = null, ba(t, e, u, 7));
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
                        Ct = 0, Se = null;
                        var tt = C.sibling;
                        if (tt !== null) wt = tt;
                        else {
                          var W = C.return;
                          W !== null ? (wt = W, er(W)) : wt = null;
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
                  Ii(), Bt = 6;
                  break t;
                default:
                  throw Error(s(462));
              }
            }
            Lm();
            break;
          } catch (nt) {
            gu(t, nt);
          }
        while (!0);
        return rn = Pn = null, dt.H = r, dt.A = c, xt = a, wt !== null ? 0 : (At = null, _t = 0, Dl(), Bt);
      }
      function Lm() {
        for (; wt !== null && !Ah(); )
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
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = Hc(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              _t
            );
            break;
          case 11:
            e = Hc(
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
            Zc(a, e), e = wt = Au(e, cn), e = Kc(a, e, cn);
        }
        t.memoizedProps = t.pendingProps, e === null ? er(t) : wt = e;
      }
      function ba(t, e, a, r) {
        rn = Pn = null, vi(e), Ma = null, cl = 0;
        var c = e.return;
        try {
          if (Dm(
            t,
            c,
            e,
            a,
            _t
          )) {
            Bt = 1, Ll(
              t,
              G(a, t.current)
            ), wt = null;
            return;
          }
        } catch (u) {
          if (c !== null) throw wt = c, u;
          Bt = 1, Ll(
            t,
            G(a, t.current)
          ), wt = null;
          return;
        }
        e.flags & 32768 ? (kt || r === 1 ? t = !0 : Ha || (_t & 536870912) !== 0 ? t = !1 : (Tn = t = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = ke.current, r !== null && r.tag === 13 && (r.flags |= 16384))), _u(e, t)) : er(e);
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
        Bt === 0 && (Bt = 5);
      }
      function _u(t, e) {
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
        Bt = 6, wt = null;
      }
      function ku(t, e, a, r, c, u, b, C, Y) {
        t.cancelPendingCommit = null;
        do
          el();
        while (Lt !== 0);
        if ((xt & 6) !== 0) throw Error(s(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(s(177));
          if (u = e.lanes | e.childLanes, u |= No, g(
            t,
            a,
            u,
            b,
            C,
            Y
          ), t === At && (wt = At = null, _t = 0), Ua = e, An = t, un = a, Bo = u, Uo = c, xd = r, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, Wm(yo, function() {
            return Tu(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), r = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || r) {
            r = dt.T, dt.T = null, c = ln(), Wt(2), b = xt, xt |= 4;
            try {
              Ym(t, e, a);
            } finally {
              xt = b, Wt(c), dt.T = r;
            }
          }
          Lt = 1, Su(), Eu(), zu();
        }
      }
      function Su() {
        if (Lt === 1) {
          Lt = 0;
          var t = An, e = Ua, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = dt.T, dt.T = null;
            var r = ln();
            Wt(2);
            var c = xt;
            xt |= 4;
            try {
              lu(e, t), op(t.containerInfo);
            } finally {
              xt = c, Wt(r), dt.T = a;
            }
          }
          t.current = e, Lt = 2;
        }
      }
      function Eu() {
        if (Lt === 2) {
          Lt = 0;
          var t = An, e = Ua, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = dt.T, dt.T = null;
            var r = ln();
            Wt(2);
            var c = xt;
            xt |= 4;
            try {
              tu(t, e.alternate, e);
            } finally {
              xt = c, Wt(r), dt.T = a;
            }
          }
          Lt = 3;
        }
      }
      function zu() {
        if (Lt === 4 || Lt === 3) {
          Lt = 0, jh();
          var t = An, e = Ua, a = un, r = xd;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Lt = 5 : (Lt = 0, Ua = An = null, Nu(t, t.pendingLanes));
          var c = t.pendingLanes;
          if (c === 0 && (Mn = null), H(a), e = e.stateNode, we && typeof we.onCommitFiberRoot == "function")
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
            e = dt.T, c = ln(), Wt(2), dt.T = null;
            try {
              for (var u = t.onRecoverableError, b = 0; b < r.length; b++) {
                var C = r[b];
                u(C.value, {
                  componentStack: C.stack
                });
              }
            } finally {
              dt.T = e, Wt(c);
            }
          }
          (un & 3) !== 0 && el(), Ke(t), c = t.pendingLanes, (a & 261930) !== 0 && (c & 42) !== 0 ? t === qo ? hl++ : (hl = 0, qo = t) : hl = 0, ce && gh(), ma(0);
        }
      }
      function Nu(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Ka(e)));
      }
      function el() {
        return Su(), Eu(), zu(), Tu();
      }
      function Tu() {
        if (Lt !== 5) return !1;
        var t = An, e = Bo;
        Bo = 0;
        var a = H(un), r = 32 > a ? 32 : a;
        a = dt.T;
        var c = ln();
        try {
          Wt(r), dt.T = null, r = Uo, Uo = null;
          var u = An, b = un;
          if (Lt = 0, Ua = An = null, un = 0, (xt & 6) !== 0)
            throw Error(s(331));
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
          Wt(c), dt.T = a, Nu(t, e);
        }
      }
      function Cu(t, e, a) {
        e = G(a, e), e = Mi(t.stateNode, e, 2), t = bn(t, e, 2), t !== null && (R(t, 2), Ke(t));
      }
      function zt(t, e, a) {
        if (t.tag === 3)
          Cu(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              Cu(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var r = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (Mn === null || !Mn.has(r))) {
                t = G(a, t), a = Tc(2), r = bn(e, a, 2), r !== null && (Cc(
                  a,
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
      function Pi(t, e, a) {
        var r = t.pingCache;
        if (r === null) {
          r = t.pingCache = new Qh();
          var c = /* @__PURE__ */ new Set();
          r.set(e, c);
        } else
          c = r.get(e), c === void 0 && (c = /* @__PURE__ */ new Set(), r.set(e, c));
        c.has(a) || (Ro = !0, c.add(a), t = Xm.bind(null, t, e, a), e.then(t, t));
      }
      function Xm(t, e, a) {
        var r = t.pingCache;
        r !== null && r.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, At === t && (_t & a) === a && (Bt === 4 || Bt === 3 && (_t & 62914560) === _t && 300 > pe() - Er ? (xt & 2) === 0 && ga(t, 0) : Do |= a, Ba === _t && (Ba = 0)), Ke(t);
      }
      function Mu(t, e) {
        e === 0 && (e = L()), t = Xn(t, e), t !== null && (R(t, e), Ke(t));
      }
      function Zm(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), Mu(t, a);
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
            throw Error(s(314));
        }
        r !== null && r.delete(e), Mu(t, a);
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
      function Au(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function nr(t, e, a, r, c, u) {
        var b = 0;
        if (r = t, typeof t == "function") to(t) && (b = 1);
        else if (typeof t == "string")
          b = qe && Vt ? td(t, a, ne.current) ? 26 : cd(t) ? 27 : 5 : qe ? td(
            t,
            a,
            ne.current
          ) ? 26 : 5 : Vt && cd(t) ? 27 : 5;
        else
          t: switch (t) {
            case uo:
              return t = o(31, a, e, c), t.elementType = uo, t.lanes = u, t;
            case ya:
              return Fn(
                a.children,
                c,
                u,
                e
              );
            case Uu:
              b = 8, c |= 24;
              break;
            case ro:
              return t = o(12, a, e, c | 2), t.elementType = ro, t.lanes = u, t;
            case oo:
              return t = o(13, a, e, c), t.elementType = oo, t.lanes = u, t;
            case so:
              return t = o(19, a, e, c), t.elementType = so, t.lanes = u, t;
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
                  case kn:
                    b = 16, r = null;
                    break t;
                }
              b = 29, a = Error(
                s(
                  130,
                  t === null ? "null" : typeof t,
                  ""
                )
              ), r = null;
          }
        return e = o(b, a, e, c), e.elementType = t, e.type = r, e.lanes = u, e;
      }
      function Fn(t, e, a, r) {
        return t = o(7, t, r, e), t.lanes = a, t;
      }
      function eo(t, e, a) {
        return t = o(6, t, null, e), t.lanes = a, t;
      }
      function ju(t) {
        var e = o(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function no(t, e, a) {
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
      function Im(t, e, a, r, c, u, b, C, Y) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = In, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = q(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = q(0), this.hiddenUpdates = q(null), this.identifierPrefix = r, this.onUncaughtError = c, this.onCaughtError = u, this.onRecoverableError = b, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = Y, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function Ou(t, e, a, r, c, u, b, C, Y, J, tt, W) {
        return t = new Im(
          t,
          e,
          a,
          b,
          Y,
          J,
          tt,
          W,
          C
        ), e = 1, u === !0 && (e |= 24), u = o(3, null, null, e), t.current = u, u.stateNode = t, e = li(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
          element: r,
          isDehydrated: a,
          cache: e
        }, si(u), t;
      }
      function Ru(t) {
        return t ? (t = ka, t) : ka;
      }
      function Du(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(s(188)) : (t = Object.keys(t).join(","), Error(s(268, t)));
        return t = f(e), t = t !== null ? p(t) : null, t === null ? null : nl(t.stateNode);
      }
      function Hu(t, e, a, r, c, u) {
        c = Ru(c), r.context === null ? r.context = c : r.pendingContext = c, r = gn(e), r.payload = { element: a }, u = u === void 0 ? null : u, u !== null && (r.callback = u), a = bn(t, r, e), a !== null && (me(a, t, e), Va(a, t, e));
      }
      function Bu(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function ao(t, e) {
        Bu(t, e), (t = t.alternate) && Bu(t, e);
      }
      var yt = {}, $m = b0, ye = y0(), lo = Object.assign, Pm = Symbol.for("react.element"), ar = Symbol.for("react.transitional.element"), va = Symbol.for("react.portal"), ya = Symbol.for("react.fragment"), Uu = Symbol.for("react.strict_mode"), ro = Symbol.for("react.profiler"), qu = Symbol.for("react.consumer"), _n = Symbol.for("react.context"), io = Symbol.for("react.forward_ref"), oo = Symbol.for("react.suspense"), so = Symbol.for("react.suspense_list"), co = Symbol.for("react.memo"), kn = Symbol.for("react.lazy"), uo = Symbol.for("react.activity"), tp = Symbol.for("react.memo_cache_sentinel"), Yu = Symbol.iterator, ep = Symbol.for("react.client.reference"), lr = Array.isArray, dt = $m.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, np = l.rendererVersion, ap = l.rendererPackageName, Gu = l.extraDevToolsConfig, nl = l.getPublicInstance, lp = l.getRootHostContext, rp = l.getChildHostContext, ip = l.prepareForCommit, op = l.resetAfterCommit, sp = l.createInstance;
      l.cloneMutableInstance;
      var fo = l.appendInitialChild, Ku = l.finalizeInitialChildren, rr = l.shouldSetTextContent, Qu = l.createTextInstance;
      l.cloneMutableTextInstance;
      var cp = l.scheduleTimeout, up = l.cancelTimeout, In = l.noTimeout, an = l.isPrimaryRenderer;
      l.warnsIfNotActing;
      var se = l.supportsMutation, Ve = l.supportsPersistence, ce = l.supportsHydration, dp = l.getInstanceFromNode;
      l.beforeActiveInstanceBlur;
      var fp = l.preparePortalMount;
      l.prepareScopeUpdate, l.getInstanceFromScope;
      var Wt = l.setCurrentUpdatePriority, ln = l.getCurrentUpdatePriority, mp = l.resolveUpdatePriority;
      l.trackSchedulerEvent, l.resolveEventType, l.resolveEventTimeStamp;
      var pp = l.shouldAttemptEagerTransition, hp = l.detachDeletedInstance;
      l.requestPostPaintCallback;
      var gp = l.maySuspendCommit, bp = l.maySuspendCommitOnUpdate, mo = l.maySuspendCommitInSyncRender, Vu = l.preloadInstance, vp = l.startSuspendingCommit, Lu = l.suspendInstance;
      l.suspendOnActiveViewTransition;
      var yp = l.waitForCommitToBeReady;
      l.getSuspendedCommitReason;
      var xa = l.NotPendingTransition, $n = l.HostTransitionContext, xp = l.resetFormInstance;
      l.bindToConsole;
      var wp = l.supportsMicrotasks, _p = l.scheduleMicrotask, al = l.supportsTestSelectors, kp = l.findFiberRoot, Sp = l.getBoundingRect, Ep = l.getTextContent, ll = l.isHiddenSubtree, zp = l.matchAccessibilityRole, Np = l.setFocusIfFocusable, Tp = l.setupIntersectionObserver, Cp = l.appendChild, Mp = l.appendChildToContainer, Ap = l.commitTextUpdate, jp = l.commitMount, Op = l.commitUpdate, Rp = l.insertBefore, Dp = l.insertInContainerBefore, Hp = l.removeChild, Bp = l.removeChildFromContainer, Xu = l.resetTextContent, Up = l.hideInstance, qp = l.hideTextInstance, Yp = l.unhideInstance, Gp = l.unhideTextInstance;
      l.cancelViewTransitionName, l.cancelRootViewTransitionName, l.restoreRootViewTransitionName, l.cloneRootViewTransitionContainer, l.removeRootViewTransitionClone, l.measureClonedInstance, l.hasInstanceChanged, l.hasInstanceAffectedParent, l.startViewTransition, l.startGestureTransition, l.stopViewTransition, l.getCurrentGestureOffset, l.createViewTransitionInstance;
      var Kp = l.clearContainer;
      l.createFragmentInstance, l.updateFragmentInstanceFiber, l.commitNewChildToFragmentInstance, l.deleteChildFromFragmentInstance;
      var Qp = l.cloneInstance, Zu = l.createContainerChildSet, Ju = l.appendChildToContainerChildSet, Vp = l.finalizeContainerChildren, Wu = l.replaceContainerChildren, Fu = l.cloneHiddenInstance, Iu = l.cloneHiddenTextInstance, po = l.isSuspenseInstancePending, ho = l.isSuspenseInstanceFallback, Lp = l.getSuspenseInstanceFallbackErrorDetails, Xp = l.registerSuspenseInstanceRetry, Zp = l.canHydrateFormStateMarker, Jp = l.isFormStateMarkerMatching, $u = l.getNextHydratableSibling, Wp = l.getNextHydratableSiblingAfterSingleton, Fp = l.getFirstHydratableChild, Ip = l.getFirstHydratableChildWithinContainer, $p = l.getFirstHydratableChildWithinActivityInstance, Pp = l.getFirstHydratableChildWithinSuspenseInstance, th = l.getFirstHydratableChildWithinSingleton, eh = l.canHydrateInstance, nh = l.canHydrateTextInstance, ah = l.canHydrateActivityInstance, lh = l.canHydrateSuspenseInstance, rh = l.hydrateInstance, ih = l.hydrateTextInstance, oh = l.hydrateActivityInstance, sh = l.hydrateSuspenseInstance, ch = l.getNextHydratableInstanceAfterActivityInstance, uh = l.getNextHydratableInstanceAfterSuspenseInstance, dh = l.commitHydratedInstance, fh = l.commitHydratedContainer, mh = l.commitHydratedActivityInstance, ph = l.commitHydratedSuspenseInstance, hh = l.finalizeHydratedChildren, gh = l.flushHydrationEvents;
      l.clearActivityBoundary;
      var bh = l.clearSuspenseBoundary;
      l.clearActivityBoundaryFromContainer;
      var vh = l.clearSuspenseBoundaryFromContainer, yh = l.hideDehydratedBoundary, xh = l.unhideDehydratedBoundary, Pu = l.shouldDeleteUnhydratedTailInstances;
      l.diffHydratedPropsForDevWarnings, l.diffHydratedTextForDevWarnings, l.describeHydratableInstanceForDevWarnings;
      var wh = l.validateHydratableInstance, _h = l.validateHydratableTextInstance, qe = l.supportsResources, td = l.isHostHoistableType, go = l.getHoistableRoot, ed = l.getResource, nd = l.acquireResource, ad = l.releaseResource, kh = l.hydrateHoistable, ld = l.mountHoistable, rd = l.unmountHoistable, Sh = l.createHoistableInstance, Eh = l.prepareToCommitHoistables, zh = l.mayResourceSuspendCommit, id = l.preloadResource, Nh = l.suspendResource, Vt = l.supportsSingletons, od = l.resolveSingletonInstance, Th = l.acquireSingletonInstance, sd = l.releaseSingletonInstance, cd = l.isHostSingletonType, wa = l.isSingletonScope, bo = [], _a = -1, ka = {}, xe = Math.clz32 ? Math.clz32 : y, Ch = Math.log, Mh = Math.LN2, ir = 256, or = 262144, sr = 4194304, cr = ye.unstable_scheduleCallback, vo = ye.unstable_cancelCallback, Ah = ye.unstable_shouldYield, jh = ye.unstable_requestPaint, pe = ye.unstable_now, ud = ye.unstable_ImmediatePriority, Oh = ye.unstable_UserBlockingPriority, yo = ye.unstable_NormalPriority, Rh = ye.unstable_IdlePriority, Dh = ye.log, Hh = ye.unstable_setDisableYieldValue, rl = null, we = null, _e = typeof Object.is == "function" ? Object.is : I, dd = typeof reportError == "function" ? reportError : function(t) {
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
      }, Bh = Object.prototype.hasOwnProperty, xo, fd, wo = !1, md = /* @__PURE__ */ new WeakMap(), Sa = [], Ea = 0, ur = null, il = 0, Te = [], Ce = 0, Sn = null, Le = 1, Xe = "", ne = w(null), ol = w(null), En = w(null), dr = w(null), ae = null, Ot = null, kt = !1, zn = null, Me = !1, _o = Error(s(519)), fr = w(null), Pn = null, rn = null, Uh = typeof AbortController < "u" ? AbortController : function() {
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
      }, mr = null, za = null, ko = !1, pr = !1, So = !1, ta = 0, sl = null, Eo = 0, Na = 0, Ta = null, pd = dt.S;
      dt.S = function(t, e) {
        yd = pe(), typeof e == "object" && e !== null && typeof e.then == "function" && Nm(t, e), pd !== null && pd(t, e);
      };
      var ea = w(null), Ca = Error(s(460)), zo = Error(s(474)), hr = Error(s(542)), gr = { then: function() {
      } }, na = null, Ma = null, cl = 0, aa = Us(!0), hd = Us(!1), Ae = [], Aa = 0, No = 0, Nn = !1, To = !1, ja = w(null), br = w(0), ke = w(null), je = null, qt = w(0), on = 0, bt = null, Mt = null, Yt = null, vr = !1, Oa = !1, la = !1, yr = 0, ul = 0, Ra = null, Gh = 0, dl = {
        readContext: te,
        use: Yl,
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
      var gd = {
        readContext: te,
        use: Yl,
        useCallback: function(t, e) {
          return de().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: te,
        useEffect: cc,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, Kl(
            4194308,
            4,
            mc.bind(null, e, t),
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
          if (la) {
            X(!0);
            try {
              t();
            } finally {
              X(!1);
            }
          }
          return a.memoizedState = [r, e], r;
        },
        useReducer: function(t, e, a) {
          var r = de();
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
          var e = t.queue, a = _c.bind(
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
          return t = vc.bind(
            null,
            bt,
            t.queue,
            !0,
            !1
          ), de().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, a) {
          var r = bt, c = de();
          if (kt) {
            if (a === void 0)
              throw Error(s(407));
            a = a();
          } else {
            if (a = e(), At === null)
              throw Error(s(349));
            (_t & 127) !== 0 || Zs(r, e, a);
          }
          c.memoizedState = a;
          var u = { value: a, getSnapshot: e };
          return c.queue = u, cc(Ws.bind(null, r, u, t), [
            t
          ]), r.flags |= 2048, pa(
            9,
            { destroy: void 0 },
            Js.bind(
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
          if (kt) {
            var a = Xe, r = Le;
            a = (r & ~(1 << 32 - xe(r) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = yr++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = Gh++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: Ni,
        useFormState: lc,
        useActionState: lc,
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
              throw Error(s(440));
            return a.impl.apply(void 0, arguments);
          };
        }
      }, Co = {
        readContext: te,
        use: Yl,
        useCallback: hc,
        useContext: te,
        useEffect: Si,
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
          var a = Ut();
          return bc(
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
        useSyncExternalStore: Xs,
        useId: xc,
        useHostTransitionStatus: Ni,
        useFormState: rc,
        useActionState: rc,
        useOptimistic: function(t, e) {
          var a = Ut();
          return $s(a, Mt, t, e);
        },
        useMemoCache: yi,
        useCacheRefresh: wc
      };
      Co.useEffectEvent = uc;
      var bd = {
        readContext: te,
        use: Yl,
        useCallback: hc,
        useContext: te,
        useEffect: Si,
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
          var a = Ut();
          return Mt === null ? zi(a, t, e) : bc(
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
        useSyncExternalStore: Xs,
        useId: xc,
        useHostTransitionStatus: Ni,
        useFormState: oc,
        useActionState: oc,
        useOptimistic: function(t, e) {
          var a = Ut();
          return Mt !== null ? $s(a, Mt, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: yi,
        useCacheRefresh: wc
      };
      bd.useEffectEvent = uc;
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
      }, Ao = Error(s(461)), Gt = !1, jo = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, sn = !1, Kt = !1, Oo = !1, vd = typeof WeakSet == "function" ? WeakSet : Set, Ft = null, Qt = null, he = !1, Ye = null, Da = 8192, Kh = {
        getCacheForType: function(t) {
          var e = te(Rt), a = e.data.get(t);
          return a === void 0 && (a = t(), e.data.set(t, a)), a;
        },
        cacheSignal: function() {
          return te(Rt).controller.signal;
        }
      }, xr = 0, wr = 1, _r = 2, kr = 3, Sr = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var fl = Symbol.for;
        xr = fl("selector.component"), wr = fl("selector.has_pseudo_class"), _r = fl("selector.role"), kr = fl("selector.test_id"), Sr = fl("selector.text");
      }
      var Qh = typeof WeakMap == "function" ? WeakMap : Map, xt = 0, At = null, wt = null, _t = 0, Ct = 0, Se = null, Tn = !1, Ha = !1, Ro = !1, cn = 0, Bt = 0, Cn = 0, ra = 0, Do = 0, Ee = 0, Ba = 0, ml = null, ge = null, Ho = !1, Er = 0, yd = 0, pl = 1 / 0, zr = null, Mn = null, Lt = 0, An = null, Ua = null, un = 0, Bo = 0, Uo = null, xd = null, hl = 0, qo = null;
      return yt.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Xn(t, 67108864);
          e !== null && me(e, t, 67108864), ao(t, 67108864);
        }
      }, yt.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = ve();
          e = M(e);
          var a = Xn(t, e);
          a !== null && me(a, t, e), ao(t, e);
        }
      }, yt.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = z(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var a = 1 << 31 - xe(e);
                  t.entanglements[1] |= a, e &= ~a;
                }
                Ke(t), (xt & 6) === 0 && (pl = pe() + 500, ma(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Xn(t, 2), e !== null && me(e, t, 2), hu(), ao(t, 2);
        }
      }, yt.batchedUpdates = function(t, e) {
        return t(e);
      }, yt.createComponentSelector = function(t) {
        return { $$typeof: xr, value: t };
      }, yt.createContainer = function(t, e, a, r, c, u, b, C, Y, J) {
        return Ou(
          t,
          e,
          !1,
          null,
          a,
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
      }, yt.createHydrationContainer = function(t, e, a, r, c, u, b, C, Y, J, tt, W, nt, gt) {
        return t = Ou(
          a,
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
        ), t.context = Ru(null), a = t.current, r = ve(), r = M(r), c = gn(r), c.callback = e ?? null, bn(a, c, r), e = r, t.current.lanes = e, R(t, e), Ke(t), t;
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
        return { $$typeof: kr, value: t };
      }, yt.createTextSelector = function(t) {
        return { $$typeof: Sr, value: t };
      }, yt.defaultOnCaughtError = function(t) {
        console.error(t);
      }, yt.defaultOnRecoverableError = function(t) {
        dd(t);
      }, yt.defaultOnUncaughtError = function(t) {
        dd(t);
      }, yt.deferredUpdates = function(t) {
        var e = dt.T, a = ln();
        try {
          return Wt(32), dt.T = null, t();
        } finally {
          Wt(a), dt.T = e;
        }
      }, yt.discreteUpdates = function(t, e, a, r, c) {
        var u = dt.T, b = ln();
        try {
          return Wt(2), dt.T = null, t(e, a, r, c);
        } finally {
          Wt(b), dt.T = u, xt === 0 && (pl = pe() + 500);
        }
      }, yt.findAllNodes = Fi, yt.findBoundingRects = function(t, e) {
        if (!al) throw Error(s(363));
        e = Fi(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(Sp(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var r = a.x, c = r + a.width, u = a.y, b = u + a.height, C = e - 1; 0 <= C; C--)
            if (e !== C) {
              var Y = t[C], J = Y.x, tt = J + Y.width, W = Y.y, nt = W + Y.height;
              if (r >= J && u >= W && c <= tt && b <= nt) {
                t.splice(e, 1);
                break;
              } else if (r !== J || a.width !== Y.width || nt < u || W > b) {
                if (!(u !== W || a.height !== Y.height || tt < r || J > c)) {
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
        var a = dt.T, r = ln();
        try {
          if (Wt(2), dt.T = null, t)
            return t();
        } finally {
          Wt(r), dt.T = a, xt = e, (xt & 6) === 0 && ma(0);
        }
      }, yt.flushSyncWork = hu, yt.focusWithin = function(t, e) {
        if (!al) throw Error(s(363));
        for (t = Zi(t), e = du(t, e), e = Array.from(e), t = 0; t < e.length; ) {
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
        if (!al) throw Error(s(363));
        var a = 0, r = [];
        t = [Zi(t), 0];
        for (var c = 0; c < t.length; ) {
          var u = t[c++], b = u.tag, C = t[c++], Y = e[C];
          if ((b !== 5 && b !== 26 && b !== 27 || !ll(u)) && (Ji(u, Y) && (r.push(Wi(Y)), C++, C > a && (a = C)), C < e.length))
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
      }, yt.observeVisibleRects = function(t, e, a, r) {
        if (!al) throw Error(s(363));
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
        if (t.tag !== 5) throw Error(s(476));
        var c = yc(t).queue;
        vc(
          t,
          c,
          e,
          xa,
          a === null ? i : function() {
            var u = yc(t);
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
        return Hu(
          c,
          u,
          t,
          e,
          a,
          r
        ), u;
      }, yt.updateContainerSync = function(t, e, a, r) {
        return Hu(
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
var Od;
function w0() {
  return Od || (Od = 1, Ko.exports = x0()), Ko.exports;
}
var _0 = w0();
const k0 = /* @__PURE__ */ bs(_0);
var Xo = { exports: {} }, dn = {};
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
function S0() {
  return Rd || (Rd = 1, dn.ConcurrentRoot = 1, dn.ContinuousEventPriority = 8, dn.DefaultEventPriority = 32, dn.DiscreteEventPriority = 2, dn.IdleEventPriority = 268435456, dn.LegacyRoot = 0, dn.NoEventPriority = 0), dn;
}
var Dd;
function E0() {
  return Dd || (Dd = 1, Xo.exports = S0()), Xo.exports;
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
const Nf = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], ns = 16, Tf = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), z0 = [
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
], Hd = {
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
]), Cf = {
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
}, Mf = {
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
}, as = ["font-size", "color", ...new Set([...Object.keys(Cf), ...Object.keys(Mf)].filter((n) => n !== "font-size" && n !== "color"))], T0 = new Set(as);
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
function ls(n, l, o = 0) {
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
    const p = n.slice(d + 4, f - 1), x = ie(p, ","), S = x[0].trim(), E = x.length > 1 ? p.slice(p.indexOf(",") + 1).trim() : null;
    let w = l(S);
    if ((w == null || w === "initial") && (w = E), w == null) return null;
    const N = ls(w, l, o + 1);
    if (N === null) return null;
    i += N, s = f;
  }
}
function C0(n) {
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
  const o = C0(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!o) return null;
  let i = 0;
  const s = ({ num: w, unit: N }) => {
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
  }, d = (w, N, k) => w && N ? { px: w.px + k * N.px, pct: w.pct + k * N.pct, num: w.num + k * N.num, unitless: w.unitless && N.unitless } : null, m = (w, N) => w ? { px: w.px * N, pct: w.pct * N, num: w.num * N, unitless: w.unitless } : null, f = (w) => w && w.unitless;
  function p() {
    const w = o[i++];
    if (!w) return null;
    if (w.num !== void 0) return s(w);
    if (w.op === "(") {
      const N = S();
      return o[i]?.op !== ")" ? null : (i++, N);
    }
    if (w.op === "-" || w.op === "+") {
      const N = p();
      return w.op === "-" ? m(N, -1) : N;
    }
    if (w.fn) {
      const N = [];
      for (; ; ) {
        N.push(S());
        const z = o[i++];
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
    for (; o[i] && (o[i].op === "*" || o[i].op === "/"); ) {
      const N = o[i++].op, k = p();
      if (!w || !k) return null;
      N === "*" ? w = f(k) ? m(w, k.num) : f(w) ? m(k, w.num) : null : w = f(k) && k.num !== 0 ? m(w, 1 / k.num) : null;
    }
    return w;
  }
  function S() {
    let w = x();
    for (; o[i] && (o[i].op === "+" || o[i].op === "-"); ) {
      const N = o[i++].op;
      w = d(w, x(), N === "-" ? -1 : 1);
    }
    return w;
  }
  const E = S();
  return i !== o.length || !E ? null : E;
}
function rs(n, l) {
  const o = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(o))
    return o === "thin" ? { px: 1 } : o === "medium" ? { px: 3 } : o === "thick" ? { px: 5 } : o;
  const i = Yn(o, l);
  return i ? i.unitless ? i.num === 0 ? { px: 0 } : { expr: n.trim() } : i.pct && (i.px || i.num) ? { expr: n.trim() } : i.pct ? { pct: i.pct } : { px: M0(i.px) } : { expr: n.trim() };
}
const M0 = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, Tr = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), A0 = ([n, l, o, i]) => `#${Tr(n)}${Tr(l)}${Tr(o)}${Tr(i * 255)}`;
function Bd(n) {
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
    const x = l(i[1]), S = x && Bd(x);
    return S ? { rgba: S, token: i[1] } : null;
  }
  if (o.startsWith("#")) {
    const x = Bd(o);
    return x ? { rgba: x, token: null } : null;
  }
  if (Hd[o]) return { rgba: [...Hd[o]], token: null };
  const s = /^(rgba?|color-mix)\((.*)\)$/s.exec(o);
  if (!s) return null;
  if (s[1] === "color-mix") {
    const x = ie(s[2], ",");
    if (x.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(x[0])) return null;
    const S = (X) => {
      const I = ie(X), $ = I.findIndex((P) => /%$/.test(P)), Q = $ >= 0 ? parseFloat(I[$]) / 100 : null;
      return { color: Kr(I.filter((P, G) => G !== $).join(" "), l), pct: Q };
    }, E = S(x[1]), w = S(x[2]);
    if (!E.color || !w.color || E.color === "currentcolor" || w.color === "currentcolor") return null;
    let N = E.pct, k = w.pct;
    N === null && k === null ? (N = 0.5, k = 0.5) : N === null ? N = 1 - k : k === null && (k = 1 - N);
    const y = N + k, z = y < 1 ? y : 1;
    N /= y, k /= y;
    const [O, D, A, L] = E.color.rgba, [q, R, g, v] = w.color.rgba, h = L * N + v * k, _ = (X, I) => h === 0 ? 0 : (X * L * N + I * v * k) / h, M = [_(O, q), _(D, R), _(A, g), h * z], H = v === 0 ? E.color.token : L === 0 ? w.color.token : null;
    return { rgba: M, token: H };
  }
  const d = s[2].includes(",") ? ie(s[2], ",") : ie(s[2].replace("/", " / ")).filter((x) => x !== "/");
  if (d.length < 3) return null;
  const m = (x) => x.endsWith("%") ? parseFloat(x) / 100 * 255 : parseFloat(x), f = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), p = [m(d[0]), m(d[1]), m(d[2]), f];
  return p.some((x) => Number.isNaN(x)) ? null : { rgba: p, token: null };
}
const xl = ["top", "right", "bottom", "left"], j0 = ["top-left", "top-right", "bottom-right", "bottom-left"], Cr = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], Ud = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function is(n, l) {
  const o = l.trim(), i = () => ie(o);
  switch (n) {
    case "padding":
    case "margin": {
      const s = Cr(i());
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
      const s = Cr(i());
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
      const s = n.split("-")[1], d = Cr(i());
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
          Ud.has(p) ? m = p : /^(thin|medium|thick|-?[\d.]|calc\()/.test(p) ? d = p : f = p;
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
      const s = Cr(ie(o.split("/")[0]));
      return j0.map((d, m) => [`border-${d}-radius`, s[m]]);
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
      return is("gap", o);
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
        Ud.has(f) || f === "auto" ? d = f : /^(thin|medium|thick|-?[\d.]|calc\()/.test(f) ? s = f : m = f;
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
function O0(n, l) {
  return n ? ie(n, ",").some((o) => {
    let i = o.trim().toLowerCase(), s = !1;
    i.startsWith("not ") && (s = !0, i = i.slice(4)), i.startsWith("only ") && (i = i.slice(5));
    const d = i.split(/\s+and\s+/).every((m) => {
      if (m = m.trim(), m === "all" || m === "screen") return !0;
      if (m === "print") return !1;
      const f = /^\((.+)\)$/.exec(m);
      if (!f) return !1;
      const p = f[1].trim(), x = /^([a-z-]+)\s*:\s*(.+)$/.exec(p);
      if (x) {
        const [, E, w] = x, N = (k) => {
          const y = rs(k, { viewport: l });
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
      const S = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(p);
      if (S) {
        const E = S[1] === "width" ? l.width : l.height, w = rs(S[3], { viewport: l }), N = typeof w == "object" && "px" in w ? w.px : NaN;
        switch (S[2]) {
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
    return s ? !d : d;
  }) : !0;
}
function R0(n, l) {
  const o = l[l.length - 1].compound;
  return vs(o)[0] ?? n;
}
function D0(n) {
  const l = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), i = (s, d) => {
    s.forEach(({ compound: m }, f) => {
      const p = d && f === s.length - 1;
      for (const x of m.pseudos)
        if (Tf.has(x.name) && (p ? l : o).add(x.name), x.list && x.name !== "not") for (const S of x.list) i(S, p);
    });
  };
  return i(n, !0), { subject: l, ancestor: o };
}
function vs(n) {
  const l = [...n.classes];
  for (const o of n.pseudos)
    if (!(o.name !== "is" && o.name !== "where"))
      for (const i of o.list) i.length === 1 && l.push(...vs(i[0].compound));
  return l;
}
function H0(n, l) {
  const o = (i, s) => {
    i.forEach(({ compound: d }, m) => {
      const f = s && m === i.length - 1, p = d.pseudos.filter((x) => Tf.has(x.name)).map((x) => x.name);
      if (!f) for (const x of p) for (const S of vs(d)) l.add(`${x}:${S}`);
      for (const x of d.pseudos) if (x.list && x.name !== "not") for (const S of x.list) o(S, f);
    });
  };
  o(n, !0);
}
class B0 {
  constructor(l) {
    this.properties = l.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const o = (d, m) => {
      const f = m[m.length - 1].compound, p = f.classes.length ? `.${f.classes[0]}` : f.tag && f.tag !== "*" ? f.tag : "*";
      this.index.has(p) || this.index.set(p, []), this.index.get(p).push(d);
    };
    let i = 0;
    const s = (d, m) => {
      for (const [f, p, x, S] of d)
        for (const E of ps(f)) {
          let w;
          try {
            w = hs(E);
          } catch (z) {
            if (z instanceof re) {
              this.skipped++;
              continue;
            }
            throw z;
          }
          const N = D0(w);
          H0(w, this.trackedStates);
          const k = w[w.length - 1].compound.pseudoElement, y = { steps: w, media: p, layer: x, origin: m, order: i++, specificity: gf(w), decls: S, states: N, pseudo: k, source: m === 0 ? `ua:${w[w.length - 1].compound.tag ?? "*"}` : R0(E, w) };
          this.rules.push(y), o(y, w);
        }
    };
    s(z0.map(([d, m]) => [d, null, 0, Object.entries(m)]), 0), s(l.rules, 1);
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
const U0 = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function q0(n) {
  if (!n || typeof n != "object") return [];
  const l = [];
  for (const [o, i] of Object.entries(n)) {
    if (i == null || i === "" || typeof i == "boolean") continue;
    const s = o.startsWith("--") ? o : o.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof i == "number" && i !== 0 && !U0.has(s) && !s.startsWith("--") ? `${i}px` : String(i);
    l.push([s, d]);
  }
  return l;
}
function Y0(n) {
  if (n.tagName !== "svg") return [];
  const l = [];
  for (const o of ["width", "height"]) {
    const i = n.getAttribute(o);
    i !== null && l.push([o, /^[\d.]+$/.test(i) ? `${i}px` : i]);
  }
  return l;
}
const G0 = (n, l) => n.important - l.important || n.origin - l.origin || n.layer - l.layer || n.specificity[0] - l.specificity[0] || n.specificity[1] - l.specificity[1] || n.specificity[2] - l.specificity[2] || n.order - l.order;
class K0 {
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
    return this.sheet.candidates(l, i).filter((d) => (!d.media || d.media.every((m) => O0(m, this.viewport))) && yf(l, d.steps, { state: s, pseudo: i }));
  }
  /** `element`'s computed style, or with `pseudo` (`before`, `after`) that of its pseudo-element's box, whose parent
   * is the element (pass the element's own computed style as `parent`). */
  compute(l, o, i = /* @__PURE__ */ new Set(), s = null) {
    const d = this.matching(l, i, s), m = s ? [] : Y0(l), f = s ? [] : q0(l.inlineStyle ?? l.props?.style);
    let p = this.rootComputed;
    o && (p = this.computed.get(o.values), p || this.computed.set(o.values, p = /* @__PURE__ */ new Map()));
    const x = `${d.map((E) => E.order).join(",")}|${m.length ? JSON.stringify(m) : ""}|${f.length ? JSON.stringify(f) : ""}`;
    let S = p.get(x);
    return S || p.set(x, S = this.cascade(d, m, f, o)), { ...S, rules: d, element: l };
  }
  /** The computed style from the matched `rules`, presentational `attrs`, `inline` declarations and the parent's. */
  cascade(l, o, i, s) {
    const d = [];
    for (const g of l)
      for (const [v, h, _] of g.decls) d.push({ prop: v, value: h, important: _ ? 1 : 0, origin: g.origin === 0 ? 0 : 2, layer: g.layer, specificity: g.specificity, order: g.order, source: g.source });
    for (const [g, v] of o) d.push({ prop: g, value: v, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${g}` });
    for (const [g, v] of i) d.push({ prop: g, value: v, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    d.sort(G0);
    const m = this.sheet.properties, f = Object.create(s?.customs ?? null), p = /* @__PURE__ */ new Map(), x = /* @__PURE__ */ new Map();
    for (const g of d) g.prop.startsWith("--") && x.set(g.prop, g.value);
    if (!s && this.theme) for (const g of Nf) this.theme[g] && x.set(`--${g}`, `perchtoken(${g})`);
    const S = (g) => {
      if (p.has(g)) return p.get(g);
      const v = m[g];
      return v && !v.inherits ? v.initial ?? null : g in f ? f[g] : v?.initial ?? null;
    }, E = /* @__PURE__ */ new Set(), w = (g) => {
      if (!x.has(g)) return S(g);
      if (E.has(g)) return null;
      E.add(g);
      const v = ls(x.get(g), w);
      return E.delete(g), x.delete(g), p.set(g, v), (!m[g] || m[g].inherits) && (f[g] = v), v;
    };
    for (const g of [...x.keys()]) w(g);
    const N = /* @__PURE__ */ new Map();
    for (const g of d) {
      if (g.prop.startsWith("--")) continue;
      const v = ls(g.value, S);
      if (v === null) {
        for (const [h] of is(g.prop, "unset")) N.set(h, { value: "unset", source: g.source, origin: g.origin });
        continue;
      }
      for (const [h, _] of is(g.prop, v)) N.set(h, { value: _, source: g.source, origin: g.origin });
    }
    const k = {}, y = {}, z = /* @__PURE__ */ new Set(), O = /* @__PURE__ */ new Set(), D = s?.values, A = { fontSize: D?.["font-size"] ?? ns, viewport: this.viewport }, L = (g, v) => {
      if (/currentcolor/i.test(v)) return this.parseValue(g, v, A, k, D);
      const h = `${g}\0${v}\0${A.fontSize}`;
      let _ = this.parsed.get(h);
      return _ === void 0 && this.parsed.set(h, _ = this.parseValue(g, v, A, k, D)), _;
    }, q = N.size ? [...as, ...[...N.keys()].filter((g) => !T0.has(g))] : as;
    for (const g of q) {
      const v = N.get(g);
      let h = v?.value;
      const _ = N0.has(g);
      if ((h === void 0 || h === "unset" || h === "revert" || h === "revert-layer") && (h = _ ? "inherit" : "initial"), v && (y[g] = v.source, v.origin !== 0 && z.add(g)), h === "inherit" && D && g in D) {
        k[g] = D[g], O.add(g);
        continue;
      }
      (h === "inherit" || h === "initial") && (h = _ ? Mf[g] : Cf[g]), k[g] = L(g, h), g === "font-size" && (A.fontSize = k["font-size"]);
    }
    for (const g of xl) {
      const v = k[`border-${g}-style`];
      (v === "none" || v === "hidden") && (k[`border-${g}-width`] = { px: 0 });
    }
    k["outline-style"] === "none" && (k["outline-width"] = { px: 0 });
    const R = D?.display;
    return (R === "flex" || R === "inline-flex" || R === "grid" || R === "inline-grid") && k.position !== "absolute" && k.position !== "fixed" && (k.display = qd(k.display)), (k.position === "absolute" || k.position === "fixed") && (k.display = qd(k.display)), { values: k, sources: y, own: z, inherited: O, customs: f };
  }
  parseValue(l, o, i, s, d) {
    const m = String(o).trim();
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
        return rs(m, i);
      default:
        return m.toLowerCase().startsWith("var(") ? m : /^[a-z-]+$/i.test(m) ? m.toLowerCase() : m;
    }
  }
}
function qd(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const Qr = (n) => n && n.rgba ? { value: A0(n.rgba), token: n.token ?? null } : null, Q0 = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function V0(n, l) {
  const o = l?.(n);
  if (Number.isFinite(o)) return o;
  const i = Math.round(n * 100) / 100;
  return Q0[i] ?? Math.round(n * 1.2);
}
function _l(n, l) {
  const o = n["line-height"], i = n["font-size"];
  return o.normal ? V0(i, l) : o.factor !== void 0 ? o.factor * i : o.px;
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
const X0 = "perch-native-description/1", Bn = Symbol("display"), Vr = {
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
}, Yd = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, ys = (n) => {
  const l = n.props["data-testid"];
  if (l) return `${n.tagName}[data-testid="${l}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const o = n.classList.find((s) => !s.includes(":") && !s.includes("[")) ?? n.classList[0];
  if (o) return `${n.tagName}.${o}`;
  const i = n.parentElement;
  return i && i.tagName !== "body" ? `${ys(i)} > ${n.tagName}` : n.tagName;
};
class P0 {
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
}, tg = /^(text|search|url|email|tel|password|number)$/, eg = 162.13 / 12.8;
function ng(n, l) {
  const o = typeof n == "object" && /^min\((.*)\)$/.exec(String(n?.expr ?? "").trim());
  if (!o) return;
  const i = ie(o[1], ",").map((s) => Yn(s.trim(), { fontSize: l })).filter((s) => s && !s.pct && !s.num).map((s) => s.px);
  return i.length ? Math.min(...i) : void 0;
}
function ag(n, l) {
  if (typeof n != "object" || !n?.expr) return !1;
  const o = Yn(n.expr, { fontSize: l["font-size"] }), i = (l["margin-left"]?.px ?? NaN) + (l["margin-right"]?.px ?? NaN);
  return !!o && !o.num && o.pct === 100 && Math.abs(o.px + i) < 0.01;
}
function Af(n) {
  const l = n.transform;
  if (l && l !== "none") {
    const i = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(l), s = i && ie(i[2], ",").map((d) => d.trim());
    return !s || s.length > (i[1] ? 1 : 2) ? null : i[1] === "X" ? [s[0], "0"] : i[1] === "Y" ? ["0", s[0]] : [s[0], s[1] ?? "0"];
  }
  const o = n.translate;
  if (o && o !== "none") {
    const i = ie(String(o).trim(), " ").filter(Boolean);
    return i.length > 3 || i[2] !== void 0 && Yn(i[2], {})?.px ? null : [i[0], i[1] ?? "0"];
  }
  return [];
}
function Gd(n, l, o, i = !1) {
  const s = n.values, d = Af(s);
  if (d?.length === 0) return;
  const m = s.transform && s.transform !== "none" ? "transform" : "translate", f = { fontSize: s["font-size"] }, p = (E, w) => {
    const N = Yn(E, f);
    if (!(!N || N.unitless && N.num))
      return N.pct ? typeof w == "number" ? N.px + N.pct / 100 * w : void 0 : N.px;
  }, x = d ? p(d[0], l.w) : void 0, S = d ? p(d[1], l.h) : void 0;
  if (x === void 0 || S === void 0) {
    const E = !i && d ? d.map((w) => Yn(w, f)) : null;
    if (E?.every((w) => w && !(w.unitless && w.num))) {
      l[jf] = E.map((w) => [w.px, w.pct ?? 0]);
      return;
    }
    o("unsupported", m, s[m], n.sources[m]);
    return;
  }
  if (i) {
    x && (l.left = x), S && (l.top = S);
    return;
  }
  x && (l.ml = (l.ml ?? 0) + x), S && (l.mt = (l.mt ?? 0) + S);
}
const jf = Symbol("perch.shift");
function lg(n, l, o) {
  const i = n.ownerDocument, s = i?.measure?.(n) ?? null;
  if (s) {
    const [[m, f], [p, x]] = o, S = m + f / 100 * s.width, E = p + x / 100 * s.height;
    S && (l.ml = (typeof l.ml == "number" ? l.ml : 0) + S), E && (l.mt = (typeof l.mt == "number" ? l.mt : 0) + E);
  }
  const d = s ? `${s.width}x${s.height}` : "";
  d === n.shiftSeen ? n.shiftTries = 0 : (n.shiftTries ?? 0) < _f && i?.retries && (n.shiftSeen = d, n.shiftTries = (n.shiftTries ?? 0) + 1, i.retries.push(() => i.afterCommit?.()));
}
function Br(n, l, o = null) {
  const i = n.values, s = {}, d = (A) => n.sources[A], m = (A) => n.sources[A] !== void 0, f = i.display;
  f === "none" ? s.display = "hidden" : f === "flex" || f === "inline-flex" ? s.display = "flex" : (f === "grid" || f === "inline-grid") && (s.display = "flex", s.flex_direction = "col", l("approximated", "display", f, d("display"), "one-column flex column"), i["grid-template-columns"] && i["grid-template-columns"] !== "none" && l("unsupported", "grid-template-columns", i["grid-template-columns"], d("grid-template-columns"))), n.element.hidden && (s.display = "hidden");
  const p = s.display === "flex";
  if (p && s.flex_direction !== "col") {
    const A = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[i["flex-direction"]] ?? "row";
    s.flex_direction = A;
  }
  if (p) {
    (i["flex-wrap"] === "wrap" || i["flex-wrap"] === "wrap-reverse") && (s.flex_wrap = "wrap");
    const A = f === "grid" || f === "inline-grid", L = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[i["align-items"]];
    L && (s.items = L);
    let q = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[i["justify-content"]];
    if (A) {
      const v = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[i["justify-items"]];
      v && (s.items = v), i["align-items"] === "center" && (q = "center");
    }
    q && (s.justify = q);
    const R = mn(i["row-gap"]), g = mn(i["column-gap"]);
    typeof R == "number" && R && (s.gap_y = R), typeof g == "number" && g && !A && (s.gap_x = g);
  }
  i["flex-grow"] && (s.flex_grow = i["flex-grow"]), i["flex-shrink"] !== 1 && (s.flex_shrink = i["flex-shrink"]);
  const x = mn(i["flex-basis"]);
  x !== void 0 && x !== "auto" && (s.flex_basis = x);
  const S = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[i["align-self"]];
  S && (s.self = S);
  for (const [A, L] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const q = i[L], R = mn(q);
    if (R === void 0 && L === "width" && ag(q, i)) {
      s.self = "stretch", l("approximated", L, q.expr, d(L), "stretched across its parent, inside its margins");
      continue;
    }
    const g = R === void 0 && /^max-/.test(L) ? ng(q, i["font-size"]) : void 0;
    if (g !== void 0) {
      s[A] = g, l("approximated", L, q.expr, d(L), "the fixed bound of min()");
      continue;
    }
    if (R === void 0) {
      typeof q == "object" && q.expr ? l("unsupported", L, q.expr, d(L), "no calc() in the engine") : typeof q == "string" && !["auto", "none"].includes(q) && l("unsupported", L, q, d(L));
      continue;
    }
    R !== "auto" && (s[A] = R);
  }
  const E = ["top", "right", "bottom", "left"];
  for (const A of E) {
    const L = A[0];
    for (const [q, R] of [["p", "padding"], ["m", "margin"]]) {
      const g = i[`${R}-${A}`], v = mn(g);
      if (v === void 0) {
        g?.expr && l("unsupported", `${R}-${A}`, g.expr, d(`${R}-${A}`), "no calc() in the engine");
        continue;
      }
      v !== 0 && (s[`${q}${L}`] = v);
    }
  }
  const w = i.position;
  if (w === "absolute" || w === "fixed") {
    s.position = "absolute", w === "fixed" && l("approximated", "position", "fixed", d("position"), "absolute in the overlay layer");
    for (const A of E) {
      const L = mn(i[A]);
      L !== void 0 && L !== "auto" && (s[A] = L);
    }
    if (w === "fixed" && o && s.w === void 0 && s.right === void 0 && typeof s.left == "number") {
      const A = o.width - s.left - (typeof s.ml == "number" ? s.ml : 0) - (typeof s.mr == "number" ? s.mr : 0);
      s.max_w = typeof s.max_w == "number" ? Math.min(s.max_w, A) : A;
    }
    Gd(n, s, l);
  } else w === "sticky" ? l("unsupported", "position", "sticky", d("position")) : Af(i)?.length !== 0 && (s.position = "relative", Gd(n, s, l, !0));
  i["z-index"] !== "auto" && m("z-index") && l("unsupported", "z-index", i["z-index"], d("z-index"), "paint order is tree order");
  for (const [A, L] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const q = i[L];
    q === "hidden" || q === "clip" ? s[A] = "hidden" : (q === "auto" || q === "scroll") && (s[A] = "scroll");
  }
  (i.visibility === "hidden" || i.visibility === "collapse") && (s.visibility = "invisible");
  const N = i["background-color"];
  N?.unreadable ? l("unsupported", "background-color", N.unreadable, d("background-color")) : N?.rgba && N.rgba[3] > 0 && (s.bg = Qr(N)), i["background-image"] && i["background-image"] !== "none" && l("unsupported", "background-image", i["background-image"], d("background-image"));
  const k = E.map((A) => mn(i[`border-${A}-width`]) || 0), y = [];
  E.forEach((A, L) => {
    if (!k[L]) return;
    s[`border_${A[0]}`] = k[L];
    const q = i[`border-${A}-style`];
    q !== "solid" && l("approximated", `border-${A}-style`, q, d(`border-${A}-style`), "drawn solid");
    const R = Qr(i[`border-${A}-color`]);
    R && y.push(R);
  }), y.length && (s.border_color = y[0], y.some((A) => A.value !== y[0].value) && l("approximated", "border-color", y.map((A) => A.value).join(" "), d("border-top-color"), "one border colour"));
  const z = (A) => {
    const L = mn(i[`border-${A}-radius`]) || 0;
    if (typeof L != "string") return L;
    const q = parseFloat(L) / 100, R = [s.w, s.h].filter((g) => typeof g == "number");
    return L === "auto" || !(q > 0) ? 0 : R.length ? Math.round(Math.min(q, 0.5) * Math.min(...R) * 100) / 100 : 9999;
  }, O = ["top-left", "top-right", "bottom-right", "bottom-left"].map(z);
  O.every((A) => A === O[0]) ? O[0] && (s.rounded = O[0]) : ["tl", "tr", "br", "bl"].forEach((A, L) => {
    O[L] && (s[`rounded_${A}`] = O[L]);
  }), i.opacity !== 1 && (s.opacity = Math.round(i.opacity * 1e3) / 1e3);
  const D = i["box-shadow"];
  if (D && D !== "none" && ie(D, ",").some((A) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(A.trim())) && (s.shadow = "lg", l("approximated", "box-shadow", D, d("box-shadow"), "the engine's large shadow preset")), i.cursor && i.cursor !== "auto" && !n.inherited.has("cursor")) {
    const A = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[i.cursor];
    A ? s.cursor = A : l("unsupported", "cursor", i.cursor, d("cursor"));
  }
  return i["text-overflow"] === "ellipsis" && (s.text_ellipsis = !0), i["text-decoration-line"] === "underline" ? s.underline = !0 : i["text-decoration-line"] && i["text-decoration-line"] !== "none" && l("unsupported", "text-decoration-line", i["text-decoration-line"], d("text-decoration-line")), s;
}
const rg = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function Of(n) {
  if (!n || n === "normal") return "";
  const l = String(n).trim().split(/\s+/).map((o) => rg[o]);
  return l.every(Boolean) ? l.join(",") : null;
}
function Ur(n, l) {
  const o = n.values, i = o["line-height"];
  return {
    text_color: Qr(o.color),
    text_size: Math.round(o["font-size"] * 1e3) / 1e3,
    font_features: Of(o["font-variant-numeric"]) ?? "",
    font_weight: o["font-weight"],
    line_height: i.factor !== void 0 ? { factor: i.factor } : { px: Math.round(_l(o, l) * 1e3) / 1e3 },
    font_family: I0(o["font-family"]),
    italic: o["font-style"] === "italic" || o["font-style"] === "oblique",
    whitespace: o["white-space"] === "nowrap" || o["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[o["text-align"]] ?? "left"
  };
}
const Kd = (n, l) => n.factor !== void 0 ? n.factor * l : n.px, Rf = (n, l) => JSON.stringify(n) === JSON.stringify(l);
function qr(n, l, o) {
  const i = {}, s = (f, p) => p.some((x) => !n.inherited.has(x));
  for (const [f, p] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (s(f, p) || !Rf(l[f], o[f])) && (i[f] = l[f]);
  const d = Kd(l.line_height, l.text_size), m = o.line_height ? Kd(o.line_height, l.text_size) : NaN;
  return (s("line_height", ["line-height"]) || !(Math.abs(d - m) <= 1e-3)) && (i.line_height = l.line_height), i;
}
const ig = (n, l) => ({ ...n, ...l });
function Yr(n, l) {
  const o = {};
  for (const [i, s] of Object.entries(n))
    s && typeof s == "object" && "value" in s ? (o[i] = s.value, s.token && (l[i] = s.token)) : i === "line_height" ? o[i] = s.factor !== void 0 ? Math.round(s.factor * 1e3) / 1e3 : `${s.px}px` : i === "italic" ? s && (o.italic = !0) : o[i] = s;
  return o.italic === !1 && delete o.italic, o;
}
function Qd(n, l) {
  const o = {};
  for (const i of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)])) {
    const s = n[i], d = l[i];
    Rf(s, d) || (o[i] = d === void 0 ? i in Vr ? Vr[i] : null : d);
  }
  return o;
}
function Vd(n, l) {
  const o = n.values;
  for (const [i, s] of Object.entries(n.sources)) {
    if (i.startsWith("--") || J0.has(i) || s.startsWith("ua:")) continue;
    const d = o[i];
    switch (i) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && l("approximated", i, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, s, d?.px < 0 ? "the run's box is as wide as with the spacing (the glyphs reach past it; where the element clips, the run is drawn smaller to fit)" : "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        d !== "normal" && Of(d) === null && l("unsupported", i, d, s);
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
        o["outline-style"] !== "none" && i === "outline-style" && l("unsupported", "outline", `${mn(o["outline-width"])}px ${o["outline-style"]} ${Qr(o["outline-color"])?.value ?? ""}`.trim(), s, "no outline in the engine (no focus ring)");
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
function og(n, l, o, i) {
  const s = ys(n), d = [], m = (O, D, A, L, q) => d.push([O, D, A, L ?? "(user agent)", s, q]), f = i.cascade.compute(n, l), p = {}, x = Br(f, m, i.viewport), S = x[jf];
  Vd(f, m);
  const E = Ur(f, i.measure), w = qr(f, E, o), N = Yr({ ...x, ...w }, p), k = {}, y = i.cascade.matching(n, "*").filter((O) => O.states.subject.size);
  for (const [O, D] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!y.some((g) => D.some((v) => g.states.subject.has(v)))) continue;
    const A = i.cascade.compute(n, l, new Set(D)), L = {}, q = Yr({ ...Br(A, () => {
    }), ...qr(A, Ur(A, i.measure), o) }, L);
    O === "focus" && Vd(A, m);
    const R = Qd(N, q);
    if (Object.keys(R).length) {
      k[O] = R;
      const g = Object.fromEntries(Object.entries(L).filter(([v]) => v in R));
      Object.keys(g).length && (k[`${O}_tokens`] = g);
    }
  }
  if (i.cascade.sheet.tracks(n, "hover") && (k.group = Ld(n), k.track_hover = !0), i.cascade.sheet.readsAncestor(n, "hover"))
    for (let O = n.parentNode; O?.state; O = O.parentNode) {
      if (!i.cascade.sheet.tracks(O, "hover")) continue;
      const D = O.state.hover;
      O.state.hover = !0;
      let A;
      try {
        A = i.cascade.compute(n, l);
      } finally {
        O.state.hover = D;
      }
      const L = {}, q = Yr({ ...Br(A, () => {
      }), ...qr(A, Ur(A, i.measure), o) }, L), R = Qd(N, q);
      if (!Object.keys(R).length) continue;
      const g = Object.fromEntries(Object.entries(L).filter(([v]) => v in R));
      (k.group_hover ??= []).push({ group: Ld(O), style: R, ...Object.keys(g).length ? { tokens: g } : {} });
    }
  if (/tabular/.test(String(f.values["font-variant-numeric"] ?? "")) && (k.tabular = !0), /^(anywhere|break-word)$/.test(String(f.values["overflow-wrap"] ?? "")) && (k.break_anywhere = !0), x.overflow_y === "scroll") {
    const O = Number.parseFloat(f.customs?.["--scrollbar-size"] ?? "");
    O > 0 && (k.scrollbar = O);
  }
  f.values["pointer-events"] !== "none" && l?.values["pointer-events"] === "none" && (k.blocks_pointer = !0);
  const z = Object.entries($0).filter(([, O]) => O.some((D) => typeof n.props[D] == "function")).map(([O]) => O);
  return !z.includes("click") && ts(n) && z.push("click"), z.length && (k.events = z), { computed: f, style: N, tokens: p, extra: k, meta: fg(n), reports: d, childText: ig(o, w), where: s, shift: S };
}
function sg(n, l, o, i) {
  const s = { before: null, after: null };
  for (const d of ["before", "after"]) {
    if (!i.cascade.matching(n, /* @__PURE__ */ new Set(), d).length) continue;
    const m = i.cascade.compute(n, l, /* @__PURE__ */ new Set(), d), f = String(m.values.content ?? "none").trim();
    if (f === "none" || f === "normal") continue;
    const p = /^(["'])(.*)\1$/.exec(f)?.[2] ?? "", x = (k, y, z, O, D) => i.findings.add(k, y, z, O ?? "(user agent)", `${ys(n)}::${d}`, D), S = {}, E = Br(m, x, i.viewport), N = { kind: "div", style: Yr({ ...E, ...qr(m, Ur(m, i.measure), o) }, S), tokens: S, children: p ? [{ kind: "text", text: p }] : [] };
    Object.defineProperty(N, Bn, { value: m.values.display }), s[d] = N;
  }
  return s;
}
const Ld = (n) => `~g${n.id}`;
function Df(n, l, o, i, s = "") {
  const d = `${s}/${n.id}.${n.version}`;
  let m = i.cache.get(n);
  (!m || m.key !== d) && i.cache.set(n, m = { key: d, part: og(n, l, o, i) });
  const { computed: f, tokens: p, extra: x, reports: S, childText: E, where: w } = m.part;
  for (const h of S) i.findings.add(...h);
  const N = (h, _, M, H, X) => i.findings.add(h, _, M, H, w, X), k = { ...m.part.style };
  m.part.shift && lg(n, k, m.part.shift);
  const y = { kind: "div", id: n.id, style: k, tokens: p, meta: m.part.meta, ...x };
  Object.defineProperty(y, Bn, { value: f.values.display }), n.measured && n.ownerDocument?.measureKey && (y.measure = n.ownerDocument.measureKey(n));
  const z = n.tagName;
  if (z === "svg")
    return y.kind = n.props["data-perch-image"] ? "image" : "svg", y.markup = pg(n), y;
  if (z === "input" || z === "textarea" || z === "select") {
    y.kind = "input", y.input_type = z === "input" ? String(n.props.type ?? "text") : z;
    for (const M of ["placeholder", "checked", "disabled"]) n.props[M] !== void 0 && (y[M] = n.props[M]);
    if (/^(checkbox|radio)$/.test(y.input_type) && (y.checked = n.checked), z !== "select" && (y.value = n.value), z === "input" && tg.test(y.input_type) && (y.field_w = eg * f.values["font-size"]), z === "textarea" && k.h === void 0) {
      const M = f.values, H = ($) => $ && typeof $ == "object" && "px" in $ ? $.px : 0, X = ($) => M[`border-${$}-style`] === "none" ? 0 : H(M[`border-${$}-width`]), I = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      k.h = I * _l(M, i.measure) + H(M["padding-top"]) + H(M["padding-bottom"]) + X("top") + X("bottom");
    }
    const { before: h, after: _ } = sg(n, f, E, i);
    return (h || _) && (y.children = [h, _].filter(Boolean)), y;
  }
  if (z === "img") {
    y.kind = "image", y.src = n.props.src ?? null;
    for (const [h, _] of [["width", "w"], ["height", "h"]]) {
      const M = Number(n.props[h]);
      k[_] === void 0 && n.props[h] != null && Number.isFinite(M) && (k[_] = M);
    }
    return y;
  }
  const O = f.values["text-transform"], D = [];
  let A = !1, L = !1;
  for (const h of n.childNodes) {
    if (h instanceof $r) {
      if (h.hidden || h.data === "") continue;
      A = !0;
      const H = D[D.length - 1];
      if (H?.kind === "text")
        H.source = (H.source ?? H.text) + h.data, H.text = Xd(H.source, O), H.text === H.source && delete H.source;
      else {
        const X = Xd(h.data, O);
        D.push(X === h.data ? { kind: "text", text: X } : { kind: "text", text: X, source: h.data });
      }
      continue;
    }
    if (!(h instanceof $t)) continue;
    const _ = Df(h, f, E, i, d), M = _[Bn];
    M === "inline" || M === "inline-block" || M === "inline-flex" ? A = !0 : M !== "none" && (L = !0), D.push(_);
  }
  if (/(^|\s)inline-flex(\s|$)/.test(String(n.props?.className ?? "")) && k.w === void 0)
    for (const h of D)
      h.style?.flex_grow && h.style.min_w === 0 && h.style.overflow_x === "hidden" && (delete h.style.min_w, delete h.style.flex_grow, delete h.style.flex_basis, delete h.style.overflow_x, delete h.style.overflow_y);
  if (!k.display && A && D.some((h) => h.kind !== "text") && D.every((h) => h.kind === "text" || h.kind === "div" && h[Bn] === "inline" && !h.events?.length && h.children?.every((_) => _.kind === "text"))) {
    const h = D.map((_) => _.kind === "text" ? _.text : _.children.map((M) => M.text).join("")).join("");
    N("approximated", "display", "inline text elements in a line of text", "(inline formatting)", "their text joined to the line, in its font"), D.splice(0, D.length, { kind: "text", text: h });
  }
  const q = D.some((h) => h.kind !== "text"), R = D.length === 1 && D[0].kind !== "text" && /^inline-(block|flex)$/.test(D[0][Bn]) ? D[0] : null;
  if (!k.display && R) {
    const h = i.cache.get(n.childNodes.find((M) => M.id === R.id))?.part.computed, _ = h ? Xr(f.values, i.measure) - dg(h.values, i.measure, R) : 0;
    k.display = "flex", k.flex_direction = "col", k.items = "start", _ > 0 && (R.style.mt = Math.round(((R.style.mt ?? 0) + _) * 100) / 100), N("approximated", "display", `${f.values.display} holding one ${R[Bn]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!k.display && D.length === 1 && (D[0].kind === "svg" || D[0].kind === "image") && D[0][Bn] === "inline" && typeof D[0].style.h == "number") {
    const h = D[0], _ = Xr(f.values, i.measure), M = _l(f.values, i.measure) - _, H = (X) => Math.round(X * 100) / 100;
    k.display = "flex", k.flex_direction = "col", k.items = "start", _ > h.style.h && (h.style.mt = H((h.style.mt ?? 0) + _ - h.style.h)), M > 0 && (h.style.mb = H((h.style.mb ?? 0) + M)), N("approximated", "display", `${f.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!k.display && A && q) {
    if (k.display = "flex", k.flex_direction = L ? "col" : "row", !L) k.items = "baseline";
    else for (const h of D) h.kind !== "text" && /^inline-(block|flex)$/.test(h[Bn]) && !h.style.self && (h.style.self = "start");
    N("approximated", "display", `${f.values.display} with inline content`, "(inline formatting)", L ? "a column of its children" : "a row on the text baseline");
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
      const H = f.values["font-size"], X = Math.max(0.8, 1 + g / (0.55 * H)), I = Math.round(_l(f.values, i.measure) * 1e3) / 1e3;
      D[h] = { kind: "div", style: { text_size: Math.round(H * X * 1e3) / 1e3, line_height: `${I}px` }, tokens: {}, children: [_] };
    }
  return y.children = D, y;
}
function cg(n, l) {
  if (!l) return null;
  let i = (l.self ? n : l.closest ? xf(n, l.closest) : l.find ? Sl(n, l.find)[0] : null)?.getAttribute(l.attr) ?? null;
  return i && l.strip && i.startsWith(l.strip) && (i = i.slice(l.strip.length)), i;
}
function ug(n, l, o) {
  const i = l.map((m) => [m, Ir(m.selector)]), s = /* @__PURE__ */ new Map(), d = (m) => {
    for (const f of m.children) {
      const p = o.get(f.id);
      if (p)
        for (const [x, S] of i) {
          const E = x.textRange ? "range_name" : "name";
          if (x.textRange && p[E] != null || !S.some((y) => yf(f, y))) continue;
          const w = cg(f, x.key), N = w == null ? s.get(x.name) ?? 0 : 0;
          w == null && s.set(x.name, N + 1);
          const k = w != null ? `${x.name}:${w}` : N ? `${x.name}@${N}` : x.name;
          p[E] == null ? p[E] = k : (p.also ??= []).push(k);
        }
      d(f);
    }
  };
  d(n.documentElement);
}
const Lr = 0.9521, Hf = 0.2256, Xr = (n, l) => (_l(n, l) - (Lr + Hf) * n["font-size"]) / 2 + Lr * n["font-size"];
function dg(n, l, o) {
  const i = (p) => p && typeof p == "object" && "px" in p ? p.px : 0, s = n["border-top-style"] === "none" ? 0 : i(n["border-top-width"]), d = o?.children ?? [], m = d.length === 1 && (d[0].kind === "svg" || d[0].kind === "image") && typeof d[0].style.h == "number" ? d[0] : null, f = m ? Math.max(Xr(n, l), (m.style.mt ?? 0) + m.style.h) : Xr(n, l);
  return i(n["padding-top"]) + s + f;
}
const Xd = (n, l) => l === "uppercase" ? n.toUpperCase() : l === "lowercase" ? n.toLowerCase() : l === "capitalize" ? n.replace(/\b\p{L}/gu, (o) => o.toUpperCase()) : n, Bf = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function fg(n) {
  const l = {};
  for (const [o, i] of Object.entries(n.props)) {
    if (Bf.has(o) || typeof i == "function" || i === void 0 || i === null || typeof i == "object") continue;
    const s = o.startsWith("aria-") || o.startsWith("data-");
    if (i === !1 && !s) continue;
    const d = o === "htmlFor" ? "for" : o === "tabIndex" ? "tabindex" : o;
    l[d] = typeof i == "boolean" ? s ? String(i) : "" : String(i);
  }
  return { tag: n.tagName, classes: n.classList, attrs: l };
}
const mg = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`), Zd = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function pg(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const l = (o) => {
    const i = [];
    for (const [d, m] of Object.entries(o.props))
      Bf.has(d) || typeof m == "function" || m === void 0 || m === null || m === !1 || typeof m == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || i.push(`${mg(d)}="${Zd(m === !0 ? "" : m)}"`);
    o.tagName === "svg" && !o.props.xmlns && i.unshift('xmlns="http://www.w3.org/2000/svg"');
    const s = o.childNodes.map((d) => d instanceof $r ? Zd(d.data) : l(d)).join("");
    return `<${o.tagName}${i.length ? ` ${i.join(" ")}` : ""}>${s}</${o.tagName}>`;
  };
  return l(n);
}
function hg(n) {
  const l = n.theme?.() ?? {}, o = {};
  for (const i of Nf) l[i] && (o[i] = l[i]);
  return o;
}
const gg = { font_features: "" };
function bg(n, l, o, i = {}, s = null) {
  const d = hg(l), m = l.viewport?.() ?? { width: 1e3, height: 800 }, f = JSON.stringify([d, m]);
  (i.look !== f || i.sheet !== o) && Object.assign(i, { look: f, sheet: o, cache: /* @__PURE__ */ new WeakMap(), cascade: new K0(o, { theme: d, viewport: m }), top: null });
  const { cascade: p, cache: x } = i, S = { cascade: p, cache: x, viewport: m, findings: new P0(), measure: l.lineHeight ? (N) => l.lineHeight(N) : null };
  i.top ??= p.compute(n.body, p.compute(n.documentElement, null));
  const E = n.body.children.map((N) => Df(N, i.top, gg, S));
  if (s?.length) {
    const N = /* @__PURE__ */ new Map(), k = (y) => {
      y.id && N.set(y.id, y);
      for (const z of y.children ?? []) k(z);
    };
    E.forEach(k), ug(n, s, N);
  }
  const w = /* @__PURE__ */ new Set();
  for (const N of [n, n.defaultView])
    for (const { type: k } of N?.listeners ?? []) Yd[k] && w.add(Yd[k]);
  return { schema: X0, root: E[0] ?? null, overlays: E.slice(1), document_events: [...w].sort(), unsupported: S.findings.list() };
}
const vg = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.15rem\\]", null, 4, [["margin-left", "1.15rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[2\\.025rem\\]", null, 4, [["margin-left", "2.025rem"]]], [".ml-\\[2\\.375rem\\]", null, 4, [["margin-left", "2.375rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-2\\.5", null, 4, [["width", "calc(var(--spacing) * 2.5)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-1\\.5", null, 4, [["padding-left", "calc(var(--spacing) * 1.5)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.075rem\\]", null, 4, [["padding-left", "1.075rem"]]], [".pl-\\[1\\.525rem\\]", null, 4, [["padding-left", "1.525rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let yg = null;
const xg = () => yg ??= new B0(vg);
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
function wg(n, l) {
  const o = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(l)]);
  for (const i of o) {
    if (i === "children") continue;
    const s = n[i], d = l[i];
    if (!(s === d || typeof s == "function" && typeof d == "function") && !(i === "style" && s && d && typeof s == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(s), ...Object.keys(d)])].every((f) => s[f] === d[f])))
      return !0;
  }
  return !1;
}
const _g = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function Jd(n, l) {
  for (const o of e0(l.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(o);
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
  createInstance: (n, l, o) => Jd(new $t(n, l, o.ownerDocument), l),
  createTextInstance: (n, l) => new $r(n),
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
      Jd(n, i);
    }
    wg(o, i) && n.touch();
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
}, ze = k0(kg), Pr = (n, l, o = null) => ze.createPortal(n, l, null, o), Sg = {
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
function Mr(n, l, o) {
  l.currentTarget = n;
  for (const { type: i, listener: s, capture: d } of [...n.listeners ?? []])
    i === l.type && d === o && s.call(n, l);
  if (n instanceof $t) {
    const i = Sg[l.type], s = i && n.props[o ? `${i}Capture` : i];
    typeof s == "function" && s(l);
  }
}
function ky(n, l, o = {}) {
  const { document: i, window: s, globals: d } = i0(n), m = new $t("div", { id: "root", style: o.container ?? {} }, i);
  i.body.appendChild(m);
  const f = [];
  let p = null;
  const x = () => [i, s].map((R) => R.listeners.map((g) => `${g.type}:${g.capture}`).sort().join(",")).join("|");
  let S = "";
  const E = {}, w = `m${Math.random().toString(36).slice(2, 10)}:`;
  let N = 0, k = -1;
  i.measureKey = (R) => w + R.id, i.stale = () => k !== N, i.computed = (R) => {
    if (!E.cascade || !E.top) return null;
    const g = [];
    for (let h = R; h instanceof $t && h !== i.body; h = h.parentNode) g.unshift(h);
    let v = E.top;
    for (const h of g) v = E.cascade.compute(h, v);
    return v.values;
  };
  const y = () => (N += 1, p = bg(i, n, xg(), E, o.names), S = x(), n.render?.(p), p), z = () => {
    ze.flushPassiveEffects(), ze.flushSyncWork(), x() !== S && y();
  };
  i.afterCommit = y;
  const O = (R) => {
    f.push(R), n.error?.(R);
  }, D = ze.createContainer(m, El.ConcurrentRoot, null, !1, null, "", O, O, O, null);
  ze.updateContainerSync(ct.createElement(l, o.props ?? {}), D, null, null), ze.flushSyncWork(), z();
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
  }, L = (R) => {
    const g = sa;
    sa = El.DiscreteEventPriority;
    try {
      return R();
    } finally {
      sa = g, ze.flushSyncWork(), z();
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
    describe: y,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(R, g, v = {}) {
      const h = typeof R == "string" ? A(R) : R;
      if (!h || Eg.has(g) && Ng(h)) return !1;
      const _ = new Tg(g, v, h), M = [];
      for (let I = h; I; I = I.parentNode) M.push(I);
      const H = [...M, i, s];
      L(() => {
        for (let I = H.length - 1; I > 0 && !_.propagationStopped; I--) Mr(H[I], _, !0);
        _.propagationStopped || (Mr(h, _, !0), _.propagationStopped || Mr(h, _, !1));
        for (let I = 1; I < H.length && !_.propagationStopped; I++) Mr(H[I], _, !1);
      });
      const X = g === "click" && !_.defaultPrevented ? ts(h) : null;
      if (X && q.dispatch(X, "submit", {}), g === "click" && !_.defaultPrevented)
        for (let I = h; I; I = I.parentNode) {
          if (I.tagName !== "a") continue;
          const $ = I.props?.href;
          typeof $ == "string" && /^https:\/\/\S+$/.test($) && n.openLink?.($);
          break;
        }
      return !_.defaultPrevented;
    },
    /** Whether the source listens for `type` on `window` or `document` (a page recording a key press does). */
    listensFor: (R) => [i, s].some((g) => g.listeners.some((v) => v.type === R)),
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(R) {
      const g = i.activeElement && i.activeElement !== i.body ? i.activeElement : i.body;
      if (!q.dispatch(g, "keydown", R)) return !0;
      const h = R.key === "Enter" && !R.isComposing ? ts(g, !0) : null;
      if (h)
        return q.dispatch(h, "submit", {}), !0;
      if (!Ef(g) || g.props.disabled || g.props.readOnly) return !1;
      if ((R.ctrlKey || R.metaKey) && !R.altKey && !R.shiftKey && R.key.toLowerCase() === "a")
        return g.selectedAll = !0, !0;
      if (R.ctrlKey || R.metaKey) return !1;
      const _ = g.selectedAll;
      g.selectedAll = !1;
      const M = g.value, X = R.key === "Backspace" || _ && R.key === "Delete" ? _ ? "" : M.slice(0, -1) : [...R.key].length === 1 ? (_ ? "" : M) + R.key : M;
      return X === M ? !1 : (g.value = X, q.dispatch(g, "input", { data: R.key }), q.dispatch(g, "change", {}), g.props.value !== void 0 && delete g.edit, g.touch(), y(), !0);
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
      if (!g || g.props.disabled || !q.dispatch(R, "click", { button: 0, detail: 1 })) return;
      const v = g.props.type === "radio";
      v && g.checked || (g.checked = v ? !0 : !g.checked, q.dispatch(R, "input", {}), q.dispatch(R, "change", {}), g.props.checked !== void 0 && delete g.ticked, g.touch(), y());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(R, g = {}) {
      const v = { button: 0, buttons: 1, pointerType: "mouse", ...g };
      for (const h of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) q.dispatch(R, h, v);
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
      g && (L(() => {
        const v = i.activeElement;
        v && v !== g && v !== i.body && q.dispatch(v, "blur"), i.focus(g), q.dispatch(g, "focus");
      }), y());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(R) {
      let v = typeof R == "string" ? A(R) : R;
      for (; v && !(v instanceof $t && typeof v.props.onKeyDown == "function" && _g(v)); ) v = v.parentNode;
      !v || v === i.activeElement || (q.focus(v.id), v.state.pointerFocus = !0, v.touch(), y());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return k = N, i.retries.length > 0;
    },
    /** Runs the effects that waited for a fresh layout. */
    retry() {
      const R = i.retries.splice(0);
      for (const g of R) g();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: z,
    update(R) {
      ze.updateContainerSync(ct.createElement(l, R ?? {}), D, null, null), ze.flushSyncWork(), z();
    },
    unmount() {
      ze.updateContainerSync(null, D, null, null), ze.flushSyncWork(), ze.flushPassiveEffects(), i.afterCommit = null, i.retries.length = 0, n.forgetBounds?.(w);
    }
  };
  return q;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const Uf = (n) => ze.flushSyncFromReconciler(n), Cg = { createPortal: Pr, flushSync: Uf }, Sy = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Pr,
  default: Cg,
  flushSync: Uf
}, Symbol.toStringTag, { value: "Module" }));
function qf(n) {
  var l, o, i = "";
  if (typeof n == "string" || typeof n == "number") i += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var s = n.length;
    for (l = 0; l < s; l++) n[l] && (o = qf(n[l])) && (i && (i += " "), i += o);
  } else for (o in n) n[o] && (i && (i += " "), i += o);
  return i;
}
function Yf() {
  for (var n, l, o = 0, i = "", s = arguments.length; o < s; o++) (n = arguments[o]) && (l = qf(n)) && (i && (i += " "), i += l);
  return i;
}
const Mg = (n, l) => {
  const o = new Array(n.length + l.length);
  for (let i = 0; i < n.length; i++)
    o[i] = n[i];
  for (let i = 0; i < l.length; i++)
    o[n.length + i] = l[i];
  return o;
}, Ag = (n, l) => ({
  classGroupId: n,
  validator: l
}), Gf = (n = /* @__PURE__ */ new Map(), l = null, o) => ({
  nextPart: n,
  validators: l,
  classGroupId: o
}), Zr = "-", Wd = [], jg = "arbitrary..", Og = (n) => {
  const l = Dg(n), {
    conflictingClassGroups: o,
    conflictingClassGroupModifiers: i
  } = n;
  return {
    getClassGroupId: (m) => {
      if (m.startsWith("[") && m.endsWith("]"))
        return Rg(m);
      const f = m.split(Zr), p = f[0] === "" && f.length > 1 ? 1 : 0;
      return Kf(f, p, l);
    },
    getConflictingClassGroupIds: (m, f) => {
      if (f) {
        const p = i[m], x = o[m];
        return p ? x ? Mg(x, p) : p : x || Wd;
      }
      return o[m] || Wd;
    }
  };
}, Kf = (n, l, o) => {
  if (n.length - l === 0)
    return o.classGroupId;
  const s = n[l], d = o.nextPart.get(s);
  if (d) {
    const x = Kf(n, l + 1, d);
    if (x) return x;
  }
  const m = o.validators;
  if (m === null)
    return;
  const f = l === 0 ? n.join(Zr) : n.slice(l).join(Zr), p = m.length;
  for (let x = 0; x < p; x++) {
    const S = m[x];
    if (S.validator(f))
      return S.classGroupId;
  }
}, Rg = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const l = n.slice(1, -1), o = l.indexOf(":"), i = l.slice(0, o);
  return i ? jg + i : void 0;
})(), Dg = (n) => {
  const {
    theme: l,
    classGroups: o
  } = n;
  return Hg(o, l);
}, Hg = (n, l) => {
  const o = Gf();
  for (const i in n) {
    const s = n[i];
    xs(s, o, i, l);
  }
  return o;
}, xs = (n, l, o, i) => {
  const s = n.length;
  for (let d = 0; d < s; d++) {
    const m = n[d];
    Bg(m, l, o, i);
  }
}, Bg = (n, l, o, i) => {
  if (typeof n == "string") {
    Ug(n, l, o);
    return;
  }
  if (typeof n == "function") {
    qg(n, l, o, i);
    return;
  }
  Yg(n, l, o, i);
}, Ug = (n, l, o) => {
  const i = n === "" ? l : Qf(l, n);
  i.classGroupId = o;
}, qg = (n, l, o, i) => {
  if (Gg(n)) {
    xs(n(i), l, o, i);
    return;
  }
  l.validators === null && (l.validators = []), l.validators.push(Ag(o, n));
}, Yg = (n, l, o, i) => {
  const s = Object.entries(n), d = s.length;
  for (let m = 0; m < d; m++) {
    const [f, p] = s[m];
    xs(p, Qf(l, f), o, i);
  }
}, Qf = (n, l) => {
  let o = n;
  const i = l.split(Zr), s = i.length;
  for (let d = 0; d < s; d++) {
    const m = i[d];
    let f = o.nextPart.get(m);
    f || (f = Gf(), o.nextPart.set(m, f)), o = f;
  }
  return o;
}, Gg = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, Kg = (n) => {
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
}, os = "!", Fd = ":", Qg = [], Id = (n, l, o, i, s) => ({
  modifiers: n,
  hasImportantModifier: l,
  baseClassName: o,
  maybePostfixModifierPosition: i,
  isExternal: s
}), Vg = (n) => {
  const {
    prefix: l,
    experimentalParseClassName: o
  } = n;
  let i = (s) => {
    const d = [];
    let m = 0, f = 0, p = 0, x;
    const S = s.length;
    for (let y = 0; y < S; y++) {
      const z = s[y];
      if (m === 0 && f === 0) {
        if (z === Fd) {
          d.push(s.slice(p, y)), p = y + 1;
          continue;
        }
        if (z === "/") {
          x = y;
          continue;
        }
      }
      z === "[" ? m++ : z === "]" ? m-- : z === "(" ? f++ : z === ")" && f--;
    }
    const E = d.length === 0 ? s : s.slice(p);
    let w = E, N = !1;
    E.endsWith(os) ? (w = E.slice(0, -1), N = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      E.startsWith(os) && (w = E.slice(1), N = !0)
    );
    const k = x && x > p ? x - p : void 0;
    return Id(d, N, w, k);
  };
  if (l) {
    const s = l + Fd, d = i;
    i = (m) => m.startsWith(s) ? d(m.slice(s.length)) : Id(Qg, !1, m, void 0, !0);
  }
  if (o) {
    const s = i;
    i = (d) => o({
      className: d,
      parseClassName: s
    });
  }
  return i;
}, Lg = (n) => {
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
}, Xg = (n) => ({
  cache: Kg(n.cacheSize),
  parseClassName: Vg(n),
  sortModifiers: Lg(n),
  postfixLookupClassGroupIds: Zg(n),
  ...Og(n)
}), Zg = (n) => {
  const l = /* @__PURE__ */ Object.create(null), o = n.postfixLookupClassGroups;
  if (o)
    for (let i = 0; i < o.length; i++)
      l[o[i]] = !0;
  return l;
}, Jg = /\s+/, Wg = (n, l) => {
  const {
    parseClassName: o,
    getClassGroupId: i,
    getConflictingClassGroupIds: s,
    sortModifiers: d,
    postfixLookupClassGroupIds: m
  } = l, f = [], p = n.trim().split(Jg);
  let x = "";
  for (let S = p.length - 1; S >= 0; S -= 1) {
    const E = p[S], {
      isExternal: w,
      modifiers: N,
      hasImportantModifier: k,
      baseClassName: y,
      maybePostfixModifierPosition: z
    } = o(E);
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
    const A = N.length === 0 ? "" : N.length === 1 ? N[0] : d(N).join(":"), L = k ? A + os : A, q = L + D;
    if (f.indexOf(q) > -1)
      continue;
    f.push(q);
    const R = s(D, O);
    for (let g = 0; g < R.length; ++g) {
      const v = R[g];
      f.push(L + v);
    }
    x = E + (x.length > 0 ? " " + x : x);
  }
  return x;
}, Fg = (...n) => {
  let l = 0, o, i, s = "";
  for (; l < n.length; )
    (o = n[l++]) && (i = Vf(o)) && (s && (s += " "), s += i);
  return s;
}, Vf = (n) => {
  if (typeof n == "string")
    return n;
  let l, o = "";
  for (let i = 0; i < n.length; i++)
    n[i] && (l = Vf(n[i])) && (o && (o += " "), o += l);
  return o;
}, Ig = (n, ...l) => {
  let o, i, s, d;
  const m = (p) => {
    const x = l.reduce((S, E) => E(S), n());
    return o = Xg(x), i = o.cache.get, s = o.cache.set, d = f, f(p);
  }, f = (p) => {
    const x = i(p);
    if (x)
      return x;
    const S = Wg(p, o);
    return s(p, S), S;
  };
  return d = m, (...p) => d(Fg(...p));
}, $g = [], Xt = (n) => {
  const l = (o) => o[n] || $g;
  return l.isThemeGetter = !0, l.themeKey = n, l;
}, Lf = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Xf = /^\((?:(\w[\w-]*):)?(.+)\)$/i, Pg = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, tb = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, eb = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, nb = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, ab = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, lb = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, On = (n) => Pg.test(n), vt = (n) => !!n && !Number.isNaN(Number(n)), Je = (n) => !!n && Number.isInteger(Number(n)), Zo = (n) => n.endsWith("%") && vt(n.slice(0, -1)), fn = (n) => tb.test(n), Zf = () => !0, rb = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  eb.test(n) && !nb.test(n)
), ws = () => !1, ib = (n) => ab.test(n), ob = (n) => lb.test(n), sb = (n) => !at(n) && !rt(n), cb = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), ub = (n) => Gn(n, Ff, ws), at = (n) => Lf.test(n), oa = (n) => Gn(n, If, rb), $d = (n) => Gn(n, vb, vt), db = (n) => Gn(n, Pf, Zf), fb = (n) => Gn(n, $f, ws), Pd = (n) => Gn(n, Jf, ws), mb = (n) => Gn(n, Wf, ob), Ar = (n) => Gn(n, tm, ib), rt = (n) => Xf.test(n), yl = (n) => ua(n, If), pb = (n) => ua(n, $f), tf = (n) => ua(n, Jf), hb = (n) => ua(n, Ff), gb = (n) => ua(n, Wf), jr = (n) => ua(n, tm, !0), bb = (n) => ua(n, Pf, !0), Gn = (n, l, o) => {
  const i = Lf.exec(n);
  return i ? i[1] ? l(i[1]) : o(i[2]) : !1;
}, ua = (n, l, o = !1) => {
  const i = Xf.exec(n);
  return i ? i[1] ? l(i[1]) : o : !1;
}, Jf = (n) => n === "position" || n === "percentage", Wf = (n) => n === "image" || n === "url", Ff = (n) => n === "length" || n === "size" || n === "bg-size", If = (n) => n === "length", vb = (n) => n === "number", $f = (n) => n === "family-name", Pf = (n) => n === "number" || n === "weight", tm = (n) => n === "shadow", yb = () => {
  const n = Xt("color"), l = Xt("font"), o = Xt("text"), i = Xt("font-weight"), s = Xt("tracking"), d = Xt("leading"), m = Xt("breakpoint"), f = Xt("container"), p = Xt("spacing"), x = Xt("radius"), S = Xt("shadow"), E = Xt("inset-shadow"), w = Xt("text-shadow"), N = Xt("drop-shadow"), k = Xt("blur"), y = Xt("perspective"), z = Xt("aspect"), O = Xt("ease"), D = Xt("animate"), A = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], L = () => [
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
  ], q = () => [...L(), rt, at], R = () => ["auto", "hidden", "clip", "visible", "scroll"], g = () => ["auto", "contain", "none"], v = () => [rt, at, p], h = () => [On, "full", "auto", ...v()], _ = () => [Je, "none", "subgrid", rt, at], M = () => ["auto", {
    span: ["full", Je, rt, at]
  }, Je, rt, at], H = () => [Je, "auto", rt, at], X = () => ["auto", "min", "max", "fr", rt, at], I = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], $ = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], Q = () => ["auto", ...v()], Z = () => [On, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...v()], P = () => [f, On, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...v()], G = () => [On, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...v()], K = () => [n, rt, at], T = () => [...L(), tf, Pd, {
    position: [rt, at]
  }], V = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], et = () => ["auto", "cover", "contain", hb, ub, {
    size: [rt, at]
  }], ot = () => [Zo, yl, oa], st = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    x,
    rt,
    at
  ], ut = () => ["", vt, yl, oa], St = () => ["solid", "dashed", "dotted", "double"], Jt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ht = () => [vt, Zo, tf, Pd], Kn = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    k,
    rt,
    at
  ], Qn = () => ["none", vt, rt, at], Re = () => ["none", vt, rt, at], De = () => [vt, rt, at], pn = () => [On, "full", ...v()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [fn],
      breakpoint: [fn],
      color: [Zf],
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
        aspect: ["auto", "square", On, at, rt, z]
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
        "@container": ["", "normal", "size", rt, at]
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
        columns: [vt, "auto", at, rt, f]
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
        z: [Je, "auto", rt, at]
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
        grow: ["", vt, rt, at]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", vt, rt, at]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [Je, "first", "last", "none", rt, at]
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
        text: ["base", o, yl, oa]
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
        tracking: [s, rt, at]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [vt, "none", rt, $d]
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
        "list-image": ["none", rt, at]
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
        list: ["disc", "decimal", "none", rt, at]
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
        decoration: [vt, "from-font", "auto", rt, oa]
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
        "underline-offset": [vt, "auto", rt, at]
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
        tab: [Je, rt, at]
      }],
      /**
       * Vertical Alignment
       * @see https://tailwindcss.com/docs/vertical-align
       */
      "vertical-align": [{
        align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", rt, at]
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
        content: ["none", rt, at]
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
          }, Je, rt, at],
          radial: ["", rt, at],
          conic: ["", Je, rt, at]
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
        "outline-offset": [vt, rt, at]
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
        opacity: [vt, rt, at]
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
        "mask-radial": [rt, at]
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
        mask: ["none", rt, at]
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
        brightness: [vt, rt, at]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [vt, rt, at]
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
        grayscale: ["", vt, rt, at]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [vt, rt, at]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", vt, rt, at]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [vt, rt, at]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", vt, rt, at]
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
        "backdrop-brightness": [vt, rt, at]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [vt, rt, at]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", vt, rt, at]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [vt, rt, at]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", vt, rt, at]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [vt, rt, at]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [vt, rt, at]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", vt, rt, at]
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
        transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", rt, at]
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
        duration: [vt, "initial", rt, at]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", O, rt, at]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [vt, rt, at]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", D, rt, at]
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
        perspective: [y, rt, at]
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
        transform: [rt, at, "", "none", "gpu", "cpu"]
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
        zoom: [Je, rt, at]
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
        cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", rt, at]
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
        "will-change": ["auto", "scroll", "contents", "transform", rt, at]
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
function Zt(...n) {
  return xb(Yf(n));
}
function wb(n, l, o) {
  return n.filter((i, s) => s !== l && (i.start + i.end) / 2 < o).length;
}
function _b(n, l, o, i) {
  const s = n.map(() => 0), d = n[l];
  if (!d) return s;
  const m = n[l + 1], f = n[l - 1], p = d.end - d.start + (m ? m.start - d.end : f ? d.start - f.end : 0);
  return n.forEach((x, S) => {
    l < o && S > l && S <= o ? s[S] = -p : o < l && S >= o && S < l && (s[S] = p);
  }), s[l] = Math.min(Math.max(i, n[0].start - d.start), n[n.length - 1].end - d.end), s;
}
const ef = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function kb(n, l) {
  for (let o = n.parentElement; o; o = o.parentElement) {
    const i = getComputedStyle(o)[l === "x" ? "overflowX" : "overflowY"];
    if ((i === "auto" || i === "scroll") && (l === "x" ? o.scrollWidth > o.clientWidth : o.scrollHeight > o.clientHeight)) return o;
  }
  return null;
}
function Sb(n, l, o, i) {
  const s = n[l] ? kb(n[l], o) : null, d = () => s ? o === "x" ? s.scrollLeft : s.scrollTop : 0, m = (z) => (o === "x" ? z.clientX : z.clientY) + d(), f = m(i), p = d(), x = n.map((z) => {
    const O = z.getBoundingClientRect();
    return o === "x" ? { start: O.left + p, end: O.right + p } : { start: O.top + p, end: O.bottom + p };
  }), S = n.map((z) => ef.map((O) => z.style[O])), E = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, w = o === "x" ? "translateX" : "translateY";
  let N = !1;
  const k = { to: l };
  n.forEach((z, O) => {
    if (z.style.pointerEvents = "none", O !== l) {
      E || (z.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(z).position === "static" && (z.style.position = "relative"), z.style.zIndex = "30", z.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const y = (z, O) => {
    k.to = z, _b(x, l, z, O).forEach((D, A) => {
      n[A].style.transform = D ? `${w}(${D}px)` : "";
    });
  };
  return {
    from: l,
    get to() {
      return k.to;
    },
    slot: (z) => wb(x, l, m(z)),
    apply: (z, O) => {
      N || y(z, m(O) - f);
    },
    rest: () => {
      N || y(l, 0);
    },
    end: () => {
      N || (N = !0, n.forEach((z, O) => ef.forEach((D, A) => {
        z.style[D] = S[O][A];
      })));
    }
  };
}
const Eb = 5;
let Jo = !1;
function zb(n, l) {
  if (n.button !== 0 || Jo) return;
  const o = { clientX: n.clientX, clientY: n.clientY }, i = n.currentTarget, s = n.pointerId;
  let d = null, m, f = !1;
  const p = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, x = (k) => {
    if (f) return;
    f = !0, window.removeEventListener("pointermove", S), window.removeEventListener("pointerup", E), window.removeEventListener("pointercancel", w), window.removeEventListener("keydown", N, !0), window.removeEventListener("blur", w), i.removeEventListener("lostpointercapture", w);
    try {
      i.releasePointerCapture(s);
    } catch {
    }
    if (!d) return;
    Jo = !1, document.body.style.cursor = p.cursor, document.body.style.userSelect = p.userSelect, d.end();
    const y = (z) => z.stopPropagation();
    window.addEventListener("click", y, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", y, !0), 0), m?.(), l.onEnd(k, d);
  }, S = (k) => {
    if (!d) {
      if (Math.hypot(k.clientX - o.clientX, k.clientY - o.clientY) < Eb) return;
      const y = l.items();
      d = Sb(y, l.from(y), l.axis, o), Jo = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        i.setPointerCapture(s);
      } catch {
      }
      i.addEventListener("lostpointercapture", w);
      const z = l.onStart?.();
      m = typeof z == "function" ? z : void 0;
    }
    l.onMove(k, d);
  }, E = () => x(!0), w = () => x(!1), N = (k) => {
    k.key === "Escape" && (k.stopPropagation(), x(!1));
  };
  window.addEventListener("pointermove", S), window.addEventListener("pointerup", E), window.addEventListener("pointercancel", w), window.addEventListener("keydown", N, !0), window.addEventListener("blur", w);
}
const em = typeof navigator < "u" && /Mac/i.test(navigator.platform), Jr = {
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
const Nb = Object.fromEntries(Object.entries(Jr).map(([n, l]) => [l, n])), Tb = {
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
const nf = /* @__PURE__ */ new Map();
function nm(n, l = em) {
  const o = `${l}|${n}`, i = nf.get(o);
  if (i) return i;
  const s = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const d of n.split("+"))
    if (d === "mod")
      l ? s.cmd = !0 : (s.ctrl = !0, s.shift = !0);
    else if (d === "cmd" || d === "ctrl" || d === "shift" || d === "alt") s[d] = !0;
    else if (/^[a-z]$/.test(d))
      s.code = `Key${d.toUpperCase()}`, s.letter = d;
    else if (/^[0-9]$/.test(d)) s.code = `Digit${d}`;
    else if (Jr[d]) s.code = Jr[d];
    else throw new Error(`unknown key "${d}" in "${n}"`);
  if (!s.code) throw new Error(`no key in "${n}"`);
  return nf.set(o, s), s;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const l = nm(n, !0);
  return [l.cmd && "cmd", l.ctrl && "ctrl", l.alt && "alt", l.shift && "shift", l.code].filter(Boolean).join("+");
}));
function Mb(n, l = em) {
  const o = nm(n, l), i = Ab(Cb(o.code) ?? "");
  return l ? `${o.ctrl ? "⌃" : ""}${o.alt ? "⌥" : ""}${o.shift ? "⇧" : ""}${o.cmd ? "⌘" : ""}${i}` : [o.ctrl && "Ctrl", o.alt && "Alt", o.shift && "Shift", i].filter(Boolean).join("+");
}
const Ab = (n) => Tb[n] ?? n.toUpperCase(), af = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, lf = Yf, ti = (n, l) => (o) => {
  var i;
  if (l?.variants == null) return lf(n, o?.class, o?.className);
  const { variants: s, defaultVariants: d } = l, m = Object.keys(s).map((x) => {
    const S = o?.[x], E = d?.[x];
    if (S === null) return null;
    const w = af(S) || af(E);
    return s[x][w];
  }), f = o && Object.entries(o).reduce((x, S) => {
    let [E, w] = S;
    return w === void 0 || (x[E] = w), x;
  }, {}), p = l == null || (i = l.compoundVariants) === null || i === void 0 ? void 0 : i.reduce((x, S) => {
    let { class: E, className: w, ...N } = S;
    return Object.entries(N).every((k) => {
      let [y, z] = k;
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
  return lf(n, m, p, o?.class, o?.className);
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
function Rb({ className: n, ...l } = {}) {
  return Zt(Ob(l), n);
}
const am = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", lm = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", Db = ti(`${lm} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function Hb({ className: n, ...l } = {}) {
  return Zt(Db(l), n);
}
const rm = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", Bb = ti(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), Ub = "my-1 h-px bg-overlay-0";
function qb({ size: n = 14, className: l }) {
  return /* @__PURE__ */ lt.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ lt.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ lt.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ lt.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function Yb({ size: n = 16, className: l }) {
  return /* @__PURE__ */ lt.jsxs("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ lt.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ lt.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function Gb({ size: n = 14, className: l }) {
  return /* @__PURE__ */ lt.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ lt.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function im({ size: n = 14, className: l }) {
  return /* @__PURE__ */ lt.jsx("svg", { className: l, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ lt.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const rf = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function Kb({ state: n, error: l }) {
  return /* @__PURE__ */ lt.jsx(
    "span",
    {
      className: Zt("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", rf[n] ?? rf.disabled),
      title: n === "error" && l ? l : n
    }
  );
}
function Qb({ title: n, onClose: l, children: o, testId: i }) {
  return Pr(
    /* @__PURE__ */ lt.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (s) => {
          s.target === s.currentTarget && l();
        },
        onKeyDown: (s) => {
          s.key === "Escape" && l();
        },
        children: /* @__PURE__ */ lt.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": n,
            "data-testid": i,
            children: [
              /* @__PURE__ */ lt.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: n }),
              o
            ]
          }
        )
      }
    ),
    document.body
  );
}
const Or = 4, Rn = 8, Vb = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", of = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function Lb({ value: n, onChange: l, options: o, className: i, ariaLabel: s, testId: d, id: m, title: f, disabled: p, placeholder: x, freeText: S, onKeyDown: E }) {
  const w = ct.useId(), [N, k] = ct.useState(!1), [y, z] = ct.useState(-1), [O, D] = ct.useState(!1), A = ct.useRef(null), L = ct.useRef(null), [q, R] = ct.useState({}), g = ct.useRef({ text: "", at: 0 }), v = S && O && n ? o.filter((G) => of(G).toLowerCase().includes(n.toLowerCase()) || G.value.toLowerCase().includes(n.toLowerCase())) : o, h = o.find((G) => G.value === n), _ = (G) => `${w}-${G}`;
  function M(G) {
    p || (z(G), k(!0));
  }
  function H() {
    k(!1), D(!1), z(-1);
  }
  function X(G) {
    !G || G.disabled || (l(G.value), H());
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
    const G = L.current;
    if (!N || !G || q.left === void 0) return;
    const K = G.getBoundingClientRect().right, T = window.innerWidth - Rn;
    K > T && R((V) => ({ ...V, left: Math.max(Rn, Number(V.left) - (K - T)) }));
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
    const G = N && y >= 0 ? document.getElementById(_(y)) : null, K = L.current;
    !G || !K || (G.offsetTop < K.scrollTop ? K.scrollTop = G.offsetTop : G.offsetTop + G.offsetHeight > K.scrollTop + K.clientHeight && (K.scrollTop = G.offsetTop + G.offsetHeight - K.clientHeight));
  }, [N, y]), um(N, (G) => {
    G || H();
  }, A, L);
  function Z(G) {
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
        K(), v.length && z(y < 0 ? T === "ArrowDown" ? $() : Q() : I(y, T === "ArrowDown" ? 1 : -1));
        return;
      } else if (T === "Home" && !S) {
        K(), z($());
        return;
      } else if (T === "End" && !S) {
        K(), z(Q());
        return;
      } else if (T === "Enter" || T === " " && !S) {
        if (y >= 0 && v[y]) {
          K(), X(v[y]);
          return;
        }
        if (!S) {
          K(), H();
          return;
        }
      } else if (!S && T.length === 1 && !G.metaKey && !G.ctrlKey && !G.altKey) {
        const V = Date.now();
        g.current = { text: (V - g.current.at > 600 ? "" : g.current.text) + T.toLowerCase(), at: V };
        const et = Math.max(y, 0), ot = [...v.slice(et + (g.current.text.length === 1 ? 1 : 0)), ...v.slice(0, et + 1)].find((st) => !st.disabled && of(st).toLowerCase().startsWith(g.current.text));
        ot && (K(), z(v.indexOf(ot)));
        return;
      }
    } else if (T === "ArrowDown" || T === "ArrowUp" || !S && (T === "Enter" || T === " ")) {
      K(), M(Math.max(0, v.findIndex((V) => V.value === n)));
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
    "aria-label": s,
    "aria-expanded": N,
    "aria-controls": N ? w : void 0,
    "aria-activedescendant": N && y >= 0 ? _(y) : void 0,
    "data-testid": d,
    onKeyDown: Z
  };
  return /* @__PURE__ */ lt.jsxs(lt.Fragment, { children: [
    S ? /* @__PURE__ */ lt.jsx(
      "input",
      {
        ...P,
        type: "text",
        role: "combobox",
        "aria-autocomplete": "list",
        autoComplete: "off",
        placeholder: x,
        className: i,
        value: n,
        onChange: (G) => {
          l(G.target.value), D(!0), N ? z(-1) : (z(-1), k(!0));
        },
        onBlur: () => H()
      }
    ) : /* @__PURE__ */ lt.jsxs(
      "button",
      {
        ...P,
        type: "button",
        role: "combobox",
        "aria-haspopup": "listbox",
        "data-value": n,
        className: Zt("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", i),
        onClick: () => N ? H() : M(Math.max(0, v.findIndex((G) => G.value === n))),
        children: [
          /* @__PURE__ */ lt.jsx("span", { className: "min-w-0 flex-1 truncate", children: h ? h.label : x ?? "" }),
          /* @__PURE__ */ lt.jsx(cm, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    N && v.length > 0 && Pr(
      /* @__PURE__ */ lt.jsx(
        "div",
        {
          ref: L,
          id: w,
          role: "listbox",
          "aria-label": s,
          className: Zt("z-[9999]", rm),
          style: q,
          onMouseDown: (G) => {
            G.preventDefault(), G.stopPropagation();
          },
          onClick: (G) => G.stopPropagation(),
          children: v.map((G, K) => /* @__PURE__ */ lt.jsxs(
            "div",
            {
              id: _(K),
              role: "option",
              "aria-selected": G.value === n,
              "aria-disabled": G.disabled || void 0,
              "data-value": G.value,
              className: Zt(Vb, K === y && !G.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                G.disabled || z(K);
              },
              onClick: () => X(G),
              children: [
                /* @__PURE__ */ lt.jsx("span", { className: "min-w-0 truncate", children: G.label }),
                G.value === n && /* @__PURE__ */ lt.jsx("span", { "aria-hidden": "true", className: "shrink-0 text-accent", children: "✓" })
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
const Xb = "box-border min-h-[44px] cursor-pointer rounded-ui bg-transparent px-[0.7rem] py-[0.45rem] text-subtext-0 no-underline [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] text-[0.85rem] hover:bg-surface-1 hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] disabled:cursor-default disabled:opacity-[0.55]", Zb = "m-0 mt-[0.4rem] text-[0.78rem] text-subtext-0", Jb = "m-0 mb-2 text-[0.82rem] text-subtext-0", om = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", _s = `${om} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, Wb = `${_s} min-w-[5.5rem] shrink-0`, ks = `${om} min-w-0 px-[0.55rem] py-[0.35rem] text-[0.82rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, Fb = `${ks} flex-1 max-[700px]:flex-[1_1_100%]`, Ib = `${ks} w-20 flex-[0_0_5rem] max-[700px]:w-24 max-[700px]:flex-[1_1_6rem]`, $b = `${ks} flex-[1_1_100%]`, Pb = "flex flex-wrap items-center gap-[0.4rem]", tv = "m-0 mb-2 flex list-none flex-col gap-[0.3rem] p-0", ev = "flex items-center gap-2 max-[700px]:flex-wrap rounded-ui bg-surface-1 px-2 py-[0.35rem] text-[0.82rem]", nv = `settings-modal__host-row ${ev}`, av = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-fg", lv = "min-w-0 flex-1 max-[700px]:basis-full overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-subtext-0", sm = "shrink-0 cursor-pointer rounded-ui px-[0.7rem] py-[0.35rem] max-[700px]:min-h-11 text-[0.82rem] font-semibold text-panel-bg [border:none] [font-family:inherit] [transition:opacity_0.12s_ease] hover:opacity-[0.85]", rv = `${sm} bg-accent`, iv = `${sm} ml-auto bg-red`;
function cm({ open: n, size: l = 12, className: o }) {
  return /* @__PURE__ */ lt.jsx("svg", { className: o, width: l, height: l, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ lt.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function ov(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
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
function cs(n, l) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && l.some((o) => o.id === n.parentSessionId);
}
function sv(n) {
  const l = /* @__PURE__ */ new Map();
  for (const o of n)
    cs(o, n) && l.set(o.parentSessionId, [...l.get(o.parentSessionId) ?? [], o]);
  return l.size ? n.filter((o) => !cs(o, n)).flatMap((o) => [o, ...l.get(o.id) ?? []]) : n;
}
const Rr = 6, sf = 8;
function cv(n, l = {}) {
  const { minWidth: o = 220, align: i = "right", minSpaceAbove: s = 100 } = l, d = n.getBoundingClientRect(), m = window.innerWidth, f = window.innerHeight, p = i === "right" ? { right: Math.max(0, m - d.right) } : { left: Math.max(0, d.left) }, x = d.top - Rr - sf, S = f - d.bottom - Rr - sf;
  return x >= s ? {
    position: "fixed",
    bottom: f - d.top + Rr,
    ...p,
    minWidth: o,
    maxHeight: Math.min(x, f * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: d.bottom + Rr,
    ...p,
    minWidth: o,
    maxHeight: Math.min(S, f * 0.75),
    overflowY: "auto"
  };
}
function um(n, l, o, i) {
  Fe(() => {
    if (!n) return;
    function s(m) {
      const f = m.target, p = o.current?.contains(f) ?? !1, x = i.current?.contains(f) ?? !1;
      !p && !x && l(!1);
    }
    function d(m) {
      m.key === "Escape" && l(!1);
    }
    return document.addEventListener("mousedown", s), document.addEventListener("keydown", d), () => {
      document.removeEventListener("mousedown", s), document.removeEventListener("keydown", d);
    };
  }, [n]);
}
function uv({ icon: n, fallback: l }) {
  const [o, i] = ct.useState(!1);
  return Fe(() => i(!1), [n]), !n || o ? /* @__PURE__ */ lt.jsx(lt.Fragment, { children: l }) : /* @__PURE__ */ lt.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => i(!0) });
}
function dv(n, l = !1) {
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
const fv = {
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
function mv({ name: n, directory: l = !1, open: o = !1 }) {
  const { kind: i, tone: s, text: d } = dv(n, l);
  return /* @__PURE__ */ lt.jsxs("svg", { className: Zt("size-[calc(14px*var(--zoom,1))] shrink-0", s), "data-file-icon": i, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    i === "react" ? /* @__PURE__ */ lt.jsxs(lt.Fragment, { children: [
      /* @__PURE__ */ lt.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5" }),
      /* @__PURE__ */ lt.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(60 8 8)" }),
      /* @__PURE__ */ lt.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(120 8 8)" }),
      /* @__PURE__ */ lt.jsx("circle", { cx: "8", cy: "8", r: "1" })
    ] }) : d ? /* @__PURE__ */ lt.jsx("text", { x: "8", y: "11", textAnchor: "middle", fill: "currentColor", stroke: "none", fontSize: "8", fontWeight: "600", fontFamily: "var(--font-mono)", children: d }) : /* @__PURE__ */ lt.jsx("path", { d: i === "folder" && o ? "M2 5V3h4l2 2h5v2M2 7h13l-2 6H2z" : fv[i] }),
    i === "branch" && /* @__PURE__ */ lt.jsxs(lt.Fragment, { children: [
      /* @__PURE__ */ lt.jsx("circle", { cx: "4", cy: "3", r: "1.5" }),
      /* @__PURE__ */ lt.jsx("circle", { cx: "4", cy: "13", r: "1.5" }),
      /* @__PURE__ */ lt.jsx("circle", { cx: "12", cy: "3", r: "1.5" })
    ] }),
    i === "image" && /* @__PURE__ */ lt.jsx("circle", { cx: "10.5", cy: "5", r: "1" })
  ] });
}
const pv = { unmodified: "", modified: "M", added: "A", deleted: "D", renamed: "R", copied: "C", typeChanged: "T", untracked: "U", ignored: "I", conflicted: "!" }, cf = (n) => typeof n == "string" ? pv[n] ?? "?" : "?", uf = (n) => typeof n == "string" ? n === "unmodified" ? "unmodified" : n === "typeChanged" ? "type changed" : n : `unknown (${n.unknown})`;
function hv(n) {
  const l = cf(n.index), o = cf(n.worktree), i = l === "!" || o === "!", s = i ? "!" : n.staged && n.unstaged ? `${l || "?"}/${o || "?"}` : n.staged ? l : o || l, d = `Git · Index: ${uf(n.index)}; working tree: ${uf(n.worktree)}${n.originalPath ? `; from ${n.originalPath}` : ""}`, m = i || s.includes("D") ? "text-red" : s === "U" || s === "A" || s === "C" ? "text-green" : s.includes("?") || s === "I" ? "text-subtext-0" : "text-yellow";
  return { label: s, title: d, tone: m };
}
function gv({ decoration: n, directory: l = !1 }) {
  if (!n) return null;
  if (l && n.containsChanges) return /* @__PURE__ */ lt.jsx("span", { className: Zt("ml-1 size-1 shrink-0 rounded-full", n.conflicted ? "bg-red" : "bg-yellow"), role: "img", "aria-label": n.conflicted ? "Contains Git conflicts" : "Contains Git changes", title: n.conflicted ? "Contains Git conflicts" : "Contains Git changes", "data-testid": "file-git-summary" });
  if (!n.entry) return null;
  const { label: o, title: i, tone: s } = hv(n.entry);
  return o ? /* @__PURE__ */ lt.jsx("span", { className: Zt("ml-1 shrink-0 text-[10px] tabular-nums [font-family:var(--font-mono)]", s), "aria-label": i, title: i, "data-testid": "file-git-marker", children: o }) : null;
}
const bv = ["application/zip", "application/x-tar", "application/gzip"];
function vv(n) {
  const l = n ?? "";
  if (l.startsWith("image/")) return "image";
  if (l.startsWith("video/")) return "video";
  if (l.startsWith("audio/")) return "audio";
  if (l === "application/pdf") return "pdf";
  if (bv.includes(l)) return "archive";
}
const yv = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]", dm = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]", xv = `${dm} group-aria-[checked=false]:text-accent`, wv = `${dm} group-aria-checked:text-accent`, _v = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg", kv = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
function Sv({
  mode: n,
  onChange: l,
  testId: o = "mode-switch",
  disabled: i = !1
}) {
  const s = n === "cli";
  return /* @__PURE__ */ lt.jsxs(
    "button",
    {
      type: "button",
      className: yv,
      "data-testid": o,
      role: "switch",
      "aria-checked": s,
      "aria-label": "Toggle UI / CLI mode",
      disabled: i,
      onClick: () => l(s ? "ui" : "cli"),
      children: [
        /* @__PURE__ */ lt.jsx("span", { className: Zt("mode-switch__label mode-switch__label--ui", xv), children: "UI" }),
        /* @__PURE__ */ lt.jsx("span", { className: Zt("mode-switch__track", _v), children: /* @__PURE__ */ lt.jsx("span", { className: Zt("mode-switch__thumb", kv) }) }),
        /* @__PURE__ */ lt.jsx("span", { className: Zt("mode-switch__label mode-switch__label--cli", wv), children: "CLI" })
      ]
    }
  );
}
const Ya = function(n, l) {
  let s = n;
  const d = wl[l];
  let m = null, f = 0, p = null;
  const x = [], S = {}, E = function(g, v) {
    f = s * 4 + 17, m = (function(h) {
      const _ = new Array(h);
      for (let M = 0; M < h; M += 1) {
        _[M] = new Array(h);
        for (let H = 0; H < h; H += 1)
          _[M][H] = null;
      }
      return _;
    })(f), w(0, 0), w(f - 7, 0), w(0, f - 7), y(), k(), O(g, v), s >= 7 && z(g), p == null && (p = L(s, d, x)), D(p, v);
  }, w = function(g, v) {
    for (let h = -1; h <= 7; h += 1)
      if (!(g + h <= -1 || f <= g + h))
        for (let _ = -1; _ <= 7; _ += 1)
          v + _ <= -1 || f <= v + _ || (0 <= h && h <= 6 && (_ == 0 || _ == 6) || 0 <= _ && _ <= 6 && (h == 0 || h == 6) || 2 <= h && h <= 4 && 2 <= _ && _ <= 4 ? m[g + h][v + _] = !0 : m[g + h][v + _] = !1);
  }, N = function() {
    let g = 0, v = 0;
    for (let h = 0; h < 8; h += 1) {
      E(!0, h);
      const _ = Hn.getLostPoint(S);
      (h == 0 || g > _) && (g = _, v = h);
    }
    return v;
  }, k = function() {
    for (let g = 8; g < f - 8; g += 1)
      m[g][6] == null && (m[g][6] = g % 2 == 0);
    for (let g = 8; g < f - 8; g += 1)
      m[6][g] == null && (m[6][g] = g % 2 == 0);
  }, y = function() {
    const g = Hn.getPatternPosition(s);
    for (let v = 0; v < g.length; v += 1)
      for (let h = 0; h < g.length; h += 1) {
        const _ = g[v], M = g[h];
        if (m[_][M] == null)
          for (let H = -2; H <= 2; H += 1)
            for (let X = -2; X <= 2; X += 1)
              H == -2 || H == 2 || X == -2 || X == 2 || H == 0 && X == 0 ? m[_ + H][M + X] = !0 : m[_ + H][M + X] = !1;
      }
  }, z = function(g) {
    const v = Hn.getBCHTypeNumber(s);
    for (let h = 0; h < 18; h += 1) {
      const _ = !g && (v >> h & 1) == 1;
      m[Math.floor(h / 3)][h % 3 + f - 8 - 3] = _;
    }
    for (let h = 0; h < 18; h += 1) {
      const _ = !g && (v >> h & 1) == 1;
      m[h % 3 + f - 8 - 3][Math.floor(h / 3)] = _;
    }
  }, O = function(g, v) {
    const h = d << 3 | v, _ = Hn.getBCHTypeInfo(h);
    for (let M = 0; M < 15; M += 1) {
      const H = !g && (_ >> M & 1) == 1;
      M < 6 ? m[M][8] = H : M < 8 ? m[M + 1][8] = H : m[f - 15 + M][8] = H;
    }
    for (let M = 0; M < 15; M += 1) {
      const H = !g && (_ >> M & 1) == 1;
      M < 8 ? m[8][f - M - 1] = H : M < 9 ? m[8][15 - M - 1 + 1] = H : m[8][15 - M - 1] = H;
    }
    m[f - 8][8] = !g;
  }, D = function(g, v) {
    let h = -1, _ = f - 1, M = 7, H = 0;
    const X = Hn.getMaskFunction(v);
    for (let I = f - 1; I > 0; I -= 2)
      for (I == 6 && (I -= 1); ; ) {
        for (let $ = 0; $ < 2; $ += 1)
          if (m[_][I - $] == null) {
            let Q = !1;
            H < g.length && (Q = (g[H] >>> M & 1) == 1), X(_, I - $) && (Q = !Q), m[_][I - $] = Q, M -= 1, M == -1 && (H += 1, M = 7);
          }
        if (_ += h, _ < 0 || f <= _) {
          _ -= h, h = -h;
          break;
        }
      }
  }, A = function(g, v) {
    let h = 0, _ = 0, M = 0;
    const H = new Array(v.length), X = new Array(v.length);
    for (let Z = 0; Z < v.length; Z += 1) {
      const P = v[Z].dataCount, G = v[Z].totalCount - P;
      _ = Math.max(_, P), M = Math.max(M, G), H[Z] = new Array(P);
      for (let et = 0; et < H[Z].length; et += 1)
        H[Z][et] = 255 & g.getBuffer()[et + h];
      h += P;
      const K = Hn.getErrorCorrectPolynomial(G), V = zl(H[Z], K.getLength() - 1).mod(K);
      X[Z] = new Array(K.getLength() - 1);
      for (let et = 0; et < X[Z].length; et += 1) {
        const ot = et + V.getLength() - X[Z].length;
        X[Z][et] = ot >= 0 ? V.getAt(ot) : 0;
      }
    }
    let I = 0;
    for (let Z = 0; Z < v.length; Z += 1)
      I += v[Z].totalCount;
    const $ = new Array(I);
    let Q = 0;
    for (let Z = 0; Z < _; Z += 1)
      for (let P = 0; P < v.length; P += 1)
        Z < H[P].length && ($[Q] = H[P][Z], Q += 1);
    for (let Z = 0; Z < M; Z += 1)
      for (let P = 0; P < v.length; P += 1)
        Z < X[P].length && ($[Q] = X[P][Z], Q += 1);
    return $;
  }, L = function(g, v, h) {
    const _ = df.getRSBlocks(g, v), M = ff();
    for (let X = 0; X < h.length; X += 1) {
      const I = h[X];
      M.put(I.getMode(), 4), M.put(I.getLength(), Hn.getLengthInBits(I.getMode(), g)), I.write(M);
    }
    let H = 0;
    for (let X = 0; X < _.length; X += 1)
      H += _[X].dataCount;
    if (M.getLengthInBits() > H * 8)
      throw "code length overflow. (" + M.getLengthInBits() + ">" + H * 8 + ")";
    for (M.getLengthInBits() + 4 <= H * 8 && M.put(0, 4); M.getLengthInBits() % 8 != 0; )
      M.putBit(!1);
    for (; !(M.getLengthInBits() >= H * 8 || (M.put(236, 8), M.getLengthInBits() >= H * 8)); )
      M.put(17, 8);
    return A(M, _);
  };
  S.addData = function(g, v) {
    v = v || "Byte";
    let h = null;
    switch (v) {
      case "Numeric":
        h = Ev(g);
        break;
      case "Alphanumeric":
        h = zv(g);
        break;
      case "Byte":
        h = Nv(g);
        break;
      case "Kanji":
        h = Tv(g);
        break;
      default:
        throw "mode:" + v;
    }
    x.push(h), p = null;
  }, S.isDark = function(g, v) {
    if (g < 0 || f <= g || v < 0 || f <= v)
      throw g + "," + v;
    return m[g][v];
  }, S.getModuleCount = function() {
    return f;
  }, S.make = function() {
    if (s < 1) {
      let g = 1;
      for (; g < 40; g++) {
        const v = df.getRSBlocks(g, d), h = ff();
        for (let M = 0; M < x.length; M++) {
          const H = x[M];
          h.put(H.getMode(), 4), h.put(H.getLength(), Hn.getLengthInBits(H.getMode(), g)), H.write(h);
        }
        let _ = 0;
        for (let M = 0; M < v.length; M++)
          _ += v[M].dataCount;
        if (h.getLengthInBits() <= _ * 8)
          break;
      }
      s = g;
    }
    E(!1, N());
  }, S.createTableTag = function(g, v) {
    g = g || 2, v = typeof v > "u" ? g * 4 : v;
    let h = "";
    h += '<table style="', h += " border-width: 0px; border-style: none;", h += " border-collapse: collapse;", h += " padding: 0px; margin: " + v + "px;", h += '">', h += "<tbody>";
    for (let _ = 0; _ < S.getModuleCount(); _ += 1) {
      h += "<tr>";
      for (let M = 0; M < S.getModuleCount(); M += 1)
        h += '<td style="', h += " border-width: 0px; border-style: none;", h += " border-collapse: collapse;", h += " padding: 0px; margin: 0px;", h += " width: " + g + "px;", h += " height: " + g + "px;", h += " background-color: ", h += S.isDark(_, M) ? "#000000" : "#ffffff", h += ";", h += '"/>';
      h += "</tr>";
    }
    return h += "</tbody>", h += "</table>", h;
  }, S.createSvgTag = function(g, v, h, _) {
    let M = {};
    typeof arguments[0] == "object" && (M = arguments[0], g = M.cellSize, v = M.margin, h = M.alt, _ = M.title), g = g || 2, v = typeof v > "u" ? g * 4 : v, h = typeof h == "string" ? { text: h } : h || {}, h.text = h.text || null, h.id = h.text ? h.id || "qrcode-description" : null, _ = typeof _ == "string" ? { text: _ } : _ || {}, _.text = _.text || null, _.id = _.text ? _.id || "qrcode-title" : null;
    const H = S.getModuleCount() * g + v * 2;
    let X, I, $, Q, Z = "", P;
    for (P = "l" + g + ",0 0," + g + " -" + g + ",0 0,-" + g + "z ", Z += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"', Z += M.scalable ? "" : ' width="' + H + 'px" height="' + H + 'px"', Z += ' viewBox="0 0 ' + H + " " + H + '" ', Z += ' preserveAspectRatio="xMinYMin meet"', Z += _.text || h.text ? ' role="img" aria-labelledby="' + q([_.id, h.id].join(" ").trim()) + '"' : "", Z += ">", Z += _.text ? '<title id="' + q(_.id) + '">' + q(_.text) + "</title>" : "", Z += h.text ? '<description id="' + q(h.id) + '">' + q(h.text) + "</description>" : "", Z += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>', Z += '<path d="', $ = 0; $ < S.getModuleCount(); $ += 1)
      for (Q = $ * g + v, X = 0; X < S.getModuleCount(); X += 1)
        S.isDark($, X) && (I = X * g + v, Z += "M" + I + "," + Q + P);
    return Z += '" stroke="transparent" fill="black"/>', Z += "</svg>", Z;
  }, S.createDataURL = function(g, v) {
    g = g || 2, v = typeof v > "u" ? g * 4 : v;
    const h = S.getModuleCount() * g + v * 2, _ = v, M = h - v;
    return jv(h, h, function(H, X) {
      if (_ <= H && H < M && _ <= X && X < M) {
        const I = Math.floor((H - _) / g), $ = Math.floor((X - _) / g);
        return S.isDark($, I) ? 0 : 1;
      } else
        return 1;
    });
  }, S.createImgTag = function(g, v, h) {
    g = g || 2, v = typeof v > "u" ? g * 4 : v;
    const _ = S.getModuleCount() * g + v * 2;
    let M = "";
    return M += "<img", M += ' src="', M += S.createDataURL(g, v), M += '"', M += ' width="', M += _, M += '"', M += ' height="', M += _, M += '"', h && (M += ' alt="', M += q(h), M += '"'), M += "/>", M;
  };
  const q = function(g) {
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
    const h = S.getModuleCount() * 1 + g * 2, _ = g, M = h - g;
    let H, X, I, $, Q;
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
    for (H = 0; H < h; H += 2) {
      for (I = Math.floor((H - _) / 1), $ = Math.floor((H + 1 - _) / 1), X = 0; X < h; X += 1)
        Q = "█", _ <= X && X < M && _ <= H && H < M && S.isDark(I, Math.floor((X - _) / 1)) && (Q = " "), _ <= X && X < M && _ <= H + 1 && H + 1 < M && S.isDark($, Math.floor((X - _) / 1)) ? Q += " " : Q += "█", G += g < 1 && H + 1 >= M ? P[Q] : Z[Q];
      G += `
`;
    }
    return h % 2 && g > 0 ? G.substring(0, G.length - h - 1) + Array(h + 1).join("▀") : G.substring(0, G.length - 1);
  };
  return S.createASCII = function(g, v) {
    if (g = g || 1, g < 2)
      return R(v);
    g -= 1, v = typeof v > "u" ? g * 2 : v;
    const h = S.getModuleCount() * g + v * 2, _ = v, M = h - v;
    let H, X, I, $;
    const Q = Array(g + 1).join("██"), Z = Array(g + 1).join("  ");
    let P = "", G = "";
    for (H = 0; H < h; H += 1) {
      for (I = Math.floor((H - _) / g), G = "", X = 0; X < h; X += 1)
        $ = 1, _ <= X && X < M && _ <= H && H < M && S.isDark(I, Math.floor((X - _) / g)) && ($ = 0), G += $ ? Q : Z;
      for (I = 0; I < g; I += 1)
        P += G + `
`;
    }
    return P.substring(0, P.length - 1);
  }, S.renderTo2dContext = function(g, v) {
    v = v || 2;
    const h = S.getModuleCount();
    for (let _ = 0; _ < h; _++)
      for (let M = 0; M < h; M++)
        g.fillStyle = S.isDark(_, M) ? "black" : "white", g.fillRect(M * v, _ * v, v, v);
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
    const s = Mv(n), d = function() {
      const p = s.read();
      if (p == -1) throw "eof";
      return p;
    };
    let m = 0;
    const f = {};
    for (; ; ) {
      const p = s.read();
      if (p == -1) break;
      const x = d(), S = d(), E = d(), w = String.fromCharCode(p << 8 | x), N = S << 8 | E;
      f[w] = N, m += 1;
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
      f = f.multiply(zl([1, Un.gexp(p)], 0));
    return f;
  }, s.getLengthInBits = function(m, f) {
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
  }, s.getLostPoint = function(m) {
    const f = m.getModuleCount();
    let p = 0;
    for (let E = 0; E < f; E += 1)
      for (let w = 0; w < f; w += 1) {
        let N = 0;
        const k = m.isDark(E, w);
        for (let y = -1; y <= 1; y += 1)
          if (!(E + y < 0 || f <= E + y))
            for (let z = -1; z <= 1; z += 1)
              w + z < 0 || f <= w + z || y == 0 && z == 0 || k == m.isDark(E + y, w + z) && (N += 1);
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
    const S = Math.abs(100 * x / f / f - 50) / 5;
    return p += S * 10, p;
  }, s;
})(), Un = (function() {
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
        d[m + f] ^= Un.gexp(Un.glog(i.getAt(m)) + Un.glog(s.getAt(f)));
    return zl(d, 0);
  }, i.mod = function(s) {
    if (i.getLength() - s.getLength() < 0)
      return i;
    const d = Un.glog(i.getAt(0)) - Un.glog(s.getAt(0)), m = new Array(i.getLength());
    for (let f = 0; f < i.getLength(); f += 1)
      m[f] = i.getAt(f);
    for (let f = 0; f < s.getLength(); f += 1)
      m[f] ^= Un.gexp(Un.glog(s.getAt(f)) + d);
    return zl(m, 0).mod(s);
  }, i;
}, df = (function() {
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
    for (let x = 0; x < f; x += 1) {
      const S = m[x * 3 + 0], E = m[x * 3 + 1], w = m[x * 3 + 2];
      for (let N = 0; N < S; N += 1)
        p.push(l(E, w));
    }
    return p;
  }, o;
})(), ff = function() {
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
}, Ev = function(n) {
  const l = ue.MODE_NUMBER, o = n, i = {};
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
}, zv = function(n) {
  const l = ue.MODE_ALPHA_NUM, o = n, i = {};
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
}, Nv = function(n) {
  const l = ue.MODE_8BIT_BYTE, o = Ya.stringToBytes(n), i = {};
  return i.getMode = function() {
    return l;
  }, i.getLength = function(s) {
    return o.length;
  }, i.write = function(s) {
    for (let d = 0; d < o.length; d += 1)
      s.put(o[d], 8);
  }, i;
}, Tv = function(n) {
  const l = ue.MODE_KANJI, o = Ya.stringToBytes;
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
}, fm = function() {
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
}, Cv = function() {
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
}, Mv = function(n) {
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
}, Av = function(n, l) {
  const o = n, i = l, s = new Array(n * l), d = {};
  d.setPixel = function(x, S, E) {
    s[S * o + x] = E;
  }, d.write = function(x) {
    x.writeString("GIF87a"), x.writeShort(o), x.writeShort(i), x.writeByte(128), x.writeByte(0), x.writeByte(0), x.writeByte(0), x.writeByte(0), x.writeByte(0), x.writeByte(255), x.writeByte(255), x.writeByte(255), x.writeString(","), x.writeShort(0), x.writeShort(0), x.writeShort(o), x.writeShort(i), x.writeByte(0);
    const S = 2, E = f(S);
    x.writeByte(S);
    let w = 0;
    for (; E.length - w > 255; )
      x.writeByte(255), x.writeBytes(E, w, 255), w += 255;
    x.writeByte(E.length - w), x.writeBytes(E, w, E.length - w), x.writeByte(0), x.writeString(";");
  };
  const m = function(x) {
    const S = x;
    let E = 0, w = 0;
    const N = {};
    return N.write = function(k, y) {
      if (k >>> y)
        throw "length over";
      for (; E + y >= 8; )
        S.writeByte(255 & (k << E | w)), y -= 8 - E, k >>>= 8 - E, w = 0, E = 0;
      w = k << E | w, E = E + y;
    }, N.flush = function() {
      E > 0 && S.writeByte(w);
    }, N;
  }, f = function(x) {
    const S = 1 << x, E = (1 << x) + 1;
    let w = x + 1;
    const N = p();
    for (let D = 0; D < S; D += 1)
      N.add(String.fromCharCode(D));
    N.add(String.fromCharCode(S)), N.add(String.fromCharCode(E));
    const k = fm(), y = m(k);
    y.write(S, w);
    let z = 0, O = String.fromCharCode(s[z]);
    for (z += 1; z < s.length; ) {
      const D = String.fromCharCode(s[z]);
      z += 1, N.contains(O + D) ? O = O + D : (y.write(N.indexOf(O), w), N.size() < 4095 && (N.size() == 1 << w && (w += 1), N.add(O + D)), O = D);
    }
    return y.write(N.indexOf(O), w), y.write(E, w), y.flush(), k.toByteArray();
  }, p = function() {
    const x = {};
    let S = 0;
    const E = {};
    return E.add = function(w) {
      if (E.contains(w))
        throw "dup key:" + w;
      x[w] = S, S += 1;
    }, E.size = function() {
      return S;
    }, E.indexOf = function(w) {
      return x[w];
    }, E.contains = function(w) {
      return typeof x[w] < "u";
    }, E;
  };
  return d;
}, jv = function(n, l, o) {
  const i = Av(n, l);
  for (let f = 0; f < l; f += 1)
    for (let p = 0; p < n; p += 1)
      i.setPixel(p, f, o(p, f));
  const s = fm();
  i.write(s);
  const d = Cv(), m = s.toByteArray();
  for (let f = 0; f < m.length; f += 1)
    d.writeByte(m[f]);
  return d.flush(), "data:image/gif;base64," + d;
};
Ya.stringToBytes;
function Ov({ text: n }) {
  const { size: l, path: o } = ct.useMemo(() => {
    const i = Ya(0, "M");
    i.addData(n), i.make();
    const s = i.getModuleCount();
    let d = "";
    for (let m = 0; m < s; m++)
      for (let f = 0; f < s; f++) i.isDark(m, f) && (d += `M${f} ${m}h1v1h-1z`);
    return { size: s, path: d };
  }, [n]);
  return /* @__PURE__ */ lt.jsxs(
    "svg",
    {
      viewBox: `-4 -4 ${l + 8} ${l + 8}`,
      shapeRendering: "crispEdges",
      role: "img",
      "aria-label": "Pairing QR code",
      "data-testid": "pair-qr",
      className: "h-44 w-44 shrink-0 rounded-ui",
      children: [
        /* @__PURE__ */ lt.jsx("rect", { x: -4, y: -4, width: l + 8, height: l + 8, fill: "#fff" }),
        /* @__PURE__ */ lt.jsx("path", { d: o, fill: "#000" })
      ]
    }
  );
}
const Nl = ct.createContext(""), us = (n, l) => typeof n == "string" && n.toLowerCase().includes(l);
function Rv({ title: n, children: l, testId: o, ariaLabel: i }) {
  const s = ct.useContext(Nl), d = s !== "" && us(n, s);
  return (
    // While searching, a group with no matching row (and no matching title) hides itself.
    /* @__PURE__ */ lt.jsxs("section", { className: s && !d ? "mb-8 not-has-[[data-setting-row]]:hidden" : "mb-8", "data-testid": o, "aria-label": i, children: [
      n && /* @__PURE__ */ lt.jsx("h3", { className: "m-0 mb-3 text-[0.9rem] font-medium text-fg", children: n }),
      /* @__PURE__ */ lt.jsx("div", { className: "rounded-ui bg-surface-0 px-4", children: /* @__PURE__ */ lt.jsx(Nl.Provider, { value: d ? "" : s, children: l }) })
    ] })
  );
}
function Dv({ title: n, description: l, children: o, testId: i }) {
  const s = ct.useContext(Nl);
  return s && !us(n, s) && !us(l, s) ? null : /* @__PURE__ */ lt.jsxs("div", { "data-setting-row": !0, "data-testid": i, className: "flex items-center justify-between gap-6 py-[0.8rem] max-[700px]:flex-wrap max-[700px]:gap-y-2", children: [
    /* @__PURE__ */ lt.jsxs("div", { className: "min-w-0 max-[700px]:flex-1 max-[700px]:basis-56", children: [
      /* @__PURE__ */ lt.jsx("div", { className: "text-[0.85rem] text-fg", children: n }),
      l && /* @__PURE__ */ lt.jsx("div", { className: "mt-[0.15rem] text-[0.75rem] text-subtext-0", children: l })
    ] }),
    o && /* @__PURE__ */ lt.jsx("div", { className: "flex shrink-0 items-center gap-2", children: o })
  ] });
}
function Hv({ checked: n, onChange: l, testId: o, label: i }) {
  return /* @__PURE__ */ lt.jsx(
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
const Bv = () => ct.useContext(Nl), Uv = {
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
  catalogToggle: Xb
};
//! State the host keeps for a resource rather than for one view of it (`useResourceState`, `@perch/sdk` 1.4): a
//! review's unsent commit message and comment, its pending batch and its operation id, keyed by the screen's
//! own name for the resource (`review:<workspace>:commit`). Every view and copy that names the same key shares the
//! value, and it outlives a reload or swap of the screen's code, a released hidden copy and the phone/desktop
//! layouts trading places. In memory: a page reload starts empty (durable drafts live in their own services).
const qv = 512, We = /* @__PURE__ */ new Map(), kl = /* @__PURE__ */ new Map();
function mm(n, l) {
  We.delete(n), We.set(n, l);
  for (const o of We.keys()) {
    if (We.size <= qv) break;
    kl.get(o)?.size || We.delete(o);
  }
}
function Yv(n, l) {
  return We.has(n) ? We.get(n) : l;
}
function Gv(n, l, o) {
  const i = Yv(n, o), s = typeof l == "function" ? l(i) : l;
  if (!(We.has(n) && Object.is(s, i))) {
    mm(n, s);
    for (const d of [...kl.get(n) ?? []]) d();
  }
}
function Kv(n, l) {
  if (typeof n != "string" || !n) throw new Error("useResourceState needs a non-empty key.");
  We.has(n) || mm(n, l);
  const o = ct.useCallback((d) => {
    const m = kl.get(n) ?? /* @__PURE__ */ new Set();
    return kl.set(n, m), m.add(d), () => {
      m.delete(d), m.size || kl.delete(n);
    };
  }, [n]), i = ct.useSyncExternalStore(o, () => We.get(n)), s = ct.useCallback((d) => Gv(n, d, l), [n]);
  return [i, s];
}
const Qv = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", Vv = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const Lv = "1.3.0";
let Gr = null;
const Xv = (n) => {
  Gr = n;
};
function Et() {
  const n = (typeof Gr == "function" ? Gr() : Gr) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const Zv = (n) => Et().subscribe?.(n) ?? (() => {
}), Jv = cv;
function Wv() {
  return typeof globalThis.crypto?.randomUUID == "function" ? globalThis.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (n) => {
    const l = Math.floor(Math.random() * 16);
    return (n === "x" ? l : l & 3 | 8).toString(16);
  });
}
const Fv = globalThis.perch?.isMac !== !1, Iv = (n) => Mb(n, Et().isMac !== !1), $v = (n) => jb(n), Pv = ({ className: n, ...l } = {}) => Zt(Rb(l), n), t1 = Hb, e1 = (n) => Bb(n), n1 = Ub, a1 = lm, l1 = am, r1 = (n) => ss[n].color, i1 = (n, l) => Et().shortcutFor?.(n, l) ?? null, o1 = (n) => Et().shortcutLabel?.(n) ?? null, ei = (n, l) => Et().command(n, l ?? {}) !== !1, s1 = (n, l, o) => Et().startSession?.(n, l, o), c1 = globalThis.perch?.pickFolder ? (n) => Et().pickFolder(n) : null;
function Pt(n) {
  const l = ct.useRef(n);
  return l.current = n, ct.useSyncExternalStore(Zv, () => l.current(Et()));
}
const pm = (n = {}) => Pt((l) => l.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), u1 = () => Pt((n) => n.hosts()), d1 = () => Pt((n) => n.sessionFolders());
function f1() {
  const n = Pt((l) => l.addProject?.() ?? m1);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (l, o, i) => {
      l.trim() && n.status !== "pending" && Et().addProjectFolder?.(l, o, i);
    },
    clear: () => Et().clearAddProject?.()
  };
}
const m1 = Object.freeze({ status: "idle" }), hm = "perch.lastAgentChoice", p1 = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), h1 = () => {
  const n = Et().storage?.getItem(hm);
  return n === "claude" || n === "codex" ? n : "claude";
}, g1 = Object.freeze({ items: [] });
function b1() {
  const n = Pt((l) => l.notifications?.() ?? g1);
  return ct.useMemo(() => ({
    items: n.items ?? [],
    open: (l) => Et().command("notification.open", { id: l }),
    dismiss: (l) => Et().command("notification.dismiss", { id: l })
  }), [n]);
}
function v1(n) {
  const l = Pt((s) => s.agentChoices?.(n) ?? p1), [o, i] = ct.useState(h1);
  return ct.useMemo(() => ({
    connected: !!l.connected,
    discovery: !!l.discovery,
    choices: l.choices ?? [],
    lastChoice: o,
    state: l.state ?? "ready",
    error: l.state === "error" ? l.error : void 0,
    rememberChoice: (s) => {
      s !== "claude" && s !== "codex" || (Et().storage?.setItem(hm, s), i(s));
    },
    manage: () => Et().command("agents.manage", {})
  }), [l, o]);
}
function y1(n) {
  Fe(() => Et().onRequest?.("add-project", n) ?? void 0, [n]);
}
function x1(n) {
  const l = n.map((o) => ({ id: o.id, parentSessionId: o.parentId, session: o }));
  return sv(l).map((o) => ({ session: o.session, nested: cs(o, l) }));
}
function w1({ id: n, plain: l, className: o }) {
  const i = Pt((x) => x.session(n));
  if (!i) return null;
  const s = i.state ?? ov(i), d = ss[s]?.color ?? ss.unknown.color, m = i.provider, f = m === "claude" || m === "claude-agent-teams" || m === "omp", p = l ? Zt("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", o) : Zt("agent-status-dot", `agent-status-dot--${s}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", o);
  return ct.createElement(
    "span",
    { className: p, style: l ? void 0 : { borderColor: d }, "data-provider": m ?? "unknown", title: l ? m ?? "Agent" : `${m ?? "Agent"} · ${s}`, "aria-hidden": "true" },
    ct.createElement("span", { className: Zt("inline-flex text-fg", f && "rounded-full bg-[#161616]") }, ct.createElement(gm, { provider: m, size: 14 }))
  );
}
function gm({ provider: n, size: l = 14 }) {
  const o = Et().agentIcon?.(n, l) ?? null, i = o?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return ct.createElement("svg", { width: l, height: l, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": i, ...o && o.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const _1 = ({ children: n }) => ct.createElement(ct.Fragment, null, n);
function k1(n, l) {
  const o = ct.useRef(l);
  return o.current = l, Fe(() => {
    const i = Et();
    if (!i.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const s = {};
    for (const [m, f] of Object.entries(o.current))
      s[m] = typeof f == "function" ? (...p) => o.current[m]?.(...p) : f;
    const d = i.openOverlay(n, s);
    return () => i.closeOverlay?.(d);
  }, [n]), null;
}
const da = (n) => function(o) {
  return k1(n, o);
}, S1 = da("session-menu"), E1 = da("new-session-menu"), z1 = da("confirm");
let bm = null;
const N1 = (n) => {
  bm = n;
};
function T1(n) {
  return ct.createElement(bm ?? z1, n);
}
function C1({ className: n = _s, ...l }) {
  return ct.createElement(Lb, { ...l, className: n });
}
let ds = null;
const M1 = (n) => {
  ds = n;
}, A1 = da("folder-browser");
function j1(n) {
  return ds ? ct.createElement(ds, { ...n, browse: (l) => Et().browse(n.hostId, l) }) : ct.createElement(A1, n);
}
const O1 = da("instructions"), R1 = da("memory"), D1 = Qb;
let Ss = null;
const H1 = (n) => {
  Ss = n;
};
function B1(n) {
  if (Ss) return ct.createElement(q1, n);
  const { hostId: l, path: o, className: i } = n, s = ct.useRef(null);
  return ct.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: Zt("worktree-menu__btn", am, i),
      "data-testid": `worktree-menu-${l}-${o}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => Et().openOverlay?.("worktree", { hostId: l, cwd: o, anchor: s.current?.getBoundingClientRect() })
    },
    ct.createElement(im, null)
  );
}
const vm = "Perch did not answer.";
function Dr(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: vm };
}
function U1(n, l, o = Et()) {
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
const mf = 5 * 6e4;
function ym(n, l, o, i = Et()) {
  const s = Date.now() + mf;
  let d = !1, m = () => {
  };
  const f = () => {
    d = !0, m(), clearTimeout(x);
  }, p = () => {
    if (!d) {
      if (Date.now() >= s) return f();
      U1(n, l, i) && (f(), i.startSession?.(n, l, o));
    }
  }, x = setTimeout(f, mf);
  m = i.subscribe?.(p) ?? (() => {
  }), p();
}
function q1({ hostId: n, path: l, className: o, worktrees: i, request: s, parentChoices: d, emptyAgent: m, ...f }) {
  const [p, x] = ct.useState(i), S = (_) => !!Et().coreCan?.(_, n), E = pm(), w = `${n}:${l}`, N = ct.useMemo(() => {
    if (Array.isArray(d)) return d;
    if (!S("workspace.nest")) return [];
    const _ = E?.projects?.find((X) => X.hostId === n && X.repoPath === l), M = [], H = (X, I) => {
      for (const $ of X ?? [])
        I && M.push({ id: $.id, name: $.name, path: $.path }), H($.children, !0);
    };
    return H(_?.workspaces, !1), M;
  }, [d, E, n, l]), k = n === "local" && S("worktree.job"), y = f.deleteSupported ?? S("worktree.delete"), z = f.startFromSupported ?? S("worktree.startFrom"), O = Pt((_) => _.emptyWorkspaceAgent?.() ?? void 0), D = m ?? O ?? void 0, A = Pt((_) => _.worktreeMenuRequest?.() ?? null), L = A?.projectKey === w ? A.nonce : null, q = ct.useMemo(() => s ?? (L == null ? null : A), [s, L]), [R, g] = ct.useState(q);
  Fe(() => {
    q && g(q);
  }, [q]);
  const v = ct.useRef({});
  v.current = { background: k, deleteSupported: y };
  const h = ct.useMemo(() => {
    const _ = (M, H) => Et().ask(M, { hostId: n, repoPath: l, ...H });
    return {
      list: async () => {
        const M = await _("worktree.list", {});
        return M?.type === "worktree.list.result" && x({ worktrees: M.worktrees ?? [], defaultRoot: M.defaultRoot ?? "", baseRef: M.baseRef, refs: M.refs ?? [] }), Dr(M);
      },
      create: async ({ branch: M, newBranch: H, path: X, extra: I, agent: $ }) => {
        const Q = { branch: M, newBranch: !!H, path: X ?? null, name: I?.name ?? null, startFrom: I?.startFrom ?? null, parentWorkspaceId: I?.parentWorkspaceId ?? null }, { background: Z } = v.current, P = await _(Z ? "worktree.job.start" : "worktree.create", Q), G = Z ? "worktree.job.started" : "worktree.done";
        if (P?.type !== G) return { error: Dr(P).error ?? vm };
        const K = Z ? P.job?.path : P.path;
        return $ && K && ym(n, K, $), { background: Z };
      },
      remove: async (M, H) => {
        const X = await _("worktree.remove", { path: M, force: !!H, deleteBranch: v.current.deleteSupported });
        return { ...Dr(X), preservedBranch: X?.type === "worktree.done" ? X.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (M, H) => Dr(await _("worktree.branch.delete", { branch: M, expectedHead: H })),
      open: (M) => Et().startSession?.(n, M, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => Et().takeWorktreeRequest?.()
    };
  }, [n, l]);
  return ct.createElement(Ss, {
    hostId: n,
    cwd: l,
    projectKey: w,
    className: o,
    worktrees: p,
    background: k,
    startFromSupported: z,
    deleteSupported: y,
    parentChoices: N,
    emptyAgent: D,
    request: R,
    actions: h
  });
}
const Y1 = (n, l) => {
  if (!Et().followPointer?.(n)) return;
  const o = l.items();
  for (const i of o) i.getBoundingClientRect();
  o[0]?.parentElement?.getBoundingClientRect(), zb(n, l);
}, G1 = () => Pt((n) => n.workspaceTabs());
function K1({ value: n, label: l }) {
  return ct.createElement("pre", { "aria-label": l, className: "m-0 min-h-0 flex-1 overflow-auto p-3 text-[0.78rem] leading-[1.45] whitespace-pre text-fg [font-family:var(--font-mono)]" }, n);
}
function Q1({ metadata: n }) {
  return ct.createElement(
    "div",
    { className: "grid content-center justify-items-center gap-1 p-5 text-[0.72rem] text-subtext-0" },
    ct.createElement("strong", { className: "text-[0.9rem] text-fg" }, n?.name ?? ""),
    ct.createElement("span", null, `${n?.mediaType ?? "file"} · ${n?.size ?? 0} bytes`)
  );
}
function V1({ content: n }) {
  return ct.createElement("pre", { className: "m-0 min-h-0 flex-1 overflow-auto p-3 whitespace-pre-wrap text-fg" }, n);
}
const L1 = () => null, X1 = /* @__PURE__ */ new Map(), Z1 = ["requestTree", "searchFiles", "openFile", "reloadFile", "requestPreview", "updateDraft", "saveFile", "overwriteFile", "setWrap"];
function J1(n, l = {}) {
  const o = Pt((f) => f.workspaceFiles(n)), i = !!l.git, s = o.git?.decorations, d = ct.useMemo(() => i && s?.length ? new Map(s) : X1, [s, i]), m = ct.useMemo(() => Object.fromEntries(Z1.map((f) => [f, (...p) => (Et().filesDo(f, n, ...p), null)])), [n]);
  return ct.useMemo(() => ({
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
const W1 = () => Pt((n) => n.statusLine()), F1 = () => Pt((n) => n.zoom()), I1 = () => Pt((n) => n.paneLook()), $1 = () => Pt((n) => n.keybindings?.() ?? []), P1 = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function ty(n) {
  const l = !!n?.keepFresh, o = Pt((s) => s.statusLine?.().connected ?? !1), i = Pt((s) => s.planUsage?.() ?? P1);
  return Fe(() => {
    if (!l || !o) return;
    let s;
    const d = () => {
      Et().command("usage.get"), s = setTimeout(d, 18e4);
    };
    return d(), () => clearTimeout(s);
  }, [l, o]), i;
}
const ey = () => Et().command("usage.get", { force: !0 }), ny = (n) => Et().command("usage.redeemReset", { accountId: n }), ay = () => ei("app.zoom_reset"), ly = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, ry = (n, l, o) => Et().beginTabDrag?.(n, l, o);
function iy(n) {
  Fe(() => Et().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const oy = (n) => ei("browser.open", { workspaceId: n }), sy = (n, l) => ei("file.open", { workspaceId: n, path: l }), cy = () => null, uy = () => null, dy = da("new-file"), Ey = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: gm,
  Chevron: cm,
  CloseIcon: Gb,
  CodeEditor: K1,
  ConfirmDialog: T1,
  Dialog: D1,
  EllipsisIcon: qb,
  FileAsset: Q1,
  FileEntryMenu: L1,
  FileIcon: mv,
  FolderBrowser: j1,
  GearIcon: Yb,
  GitMarker: gv,
  HostStateDot: Kb,
  InstructionsDialog: O1,
  MarkdownPreview: V1,
  MemoryDialog: R1,
  ModeSwitch: Sv,
  NewFilePrompt: dy,
  NewSessionMenu: E1,
  PageIcon: uv,
  PlusIcon: im,
  QrCode: Ov,
  Select: C1,
  SessionDot: w1,
  SessionMenu: S1,
  SettingRow: Dv,
  SettingsGroup: Rv,
  SettingsQuery: Nl,
  Slot: _1,
  Switch: Hv,
  TabDragLayer: uy,
  TabMenu: cy,
  WorktreeMenu: B1,
  agentStateColor: r1,
  anchoredPopoverStyle: Jv,
  assetKind: vv,
  beginReorderDrag: Y1,
  beginTabDrag: ry,
  bindHost: Xv,
  buttonClass: t1,
  cn: Zt,
  drawConfirmationsInPlace: N1,
  drawFolderBrowserInPlace: M1,
  drawWorktreeInPlace: H1,
  ghostButton: a1,
  glassClass: Qv,
  iconButton: l1,
  isMac: Fv,
  keyLabel: Iv,
  menuDividerClass: n1,
  menuItemClass: e1,
  menuPanel: rm,
  nestSessions: x1,
  newId: Wv,
  openBrowserTab: oy,
  openFileTab: sy,
  pickFolder: c1,
  redeemUsageReset: ny,
  refreshUsage: ey,
  resetZoom: ay,
  rowActionClass: Pv,
  runCommand: ei,
  segmentClass: $v,
  settingsClass: Uv,
  shortcutFor: i1,
  shortcutLabel: o1,
  startPaneWhenReady: ym,
  startSession: s1,
  tabStateClass: ly,
  tapButtonClass: Vv,
  useAddProject: f1,
  useAddProjectRequest: y1,
  useAgentChoices: v1,
  useDismissOnOutsideClick: um,
  useHostSnapshot: Pt,
  useHosts: u1,
  useKeybindings: $1,
  useNavigation: pm,
  useNewTabRequest: iy,
  useNotifications: b1,
  usePaneLook: I1,
  usePlanUsage: ty,
  useResourceState: Kv,
  useSessionFolders: d1,
  useSettingsQuery: Bv,
  useStatusLine: W1,
  useWorkspaceFiles: J1,
  useWorkspaceTabs: G1,
  useZoom: F1,
  version: Lv
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
const Es = {
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
  Es[n] = (l, o) => l[n](o);
const zy = Object.keys(Es);
function Wo(n, l) {
  for (const [o, i] of Object.entries(l)) {
    const s = Es[o];
    if (!s) throw new Error(`the description key ${o} has no GPUI builder`);
    i != null && (n = s(n, i));
  }
  return n;
}
const qn = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), pf = /* @__PURE__ */ new WeakSet(), Fo = /* @__PURE__ */ new WeakSet();
function hf(n, l, o) {
  const i = n.pressed, s = qn(o);
  return i && i.x === s.clientX && i.y === s.clientY ? i.id : l;
}
function fy(n, l, o) {
  if (n.name) return n.name;
  if (!(l.size || n.hover || n.focus || n.active || n.track_hover && Wr.has(n.group) || o)) return null;
  const i = n.meta?.attrs["data-testid"];
  return i ? `~${n.id}:${i}` : `~${n.id}`;
}
const xm = (n, l = !1) => (n.children ?? []).some((o) => o.kind === "text" ? !l || /\s/.test(String(o.text ?? "").trim()) : o.kind === "div" && o.style?.flex_direction !== "row" && o.style?.whitespace !== "nowrap" && xm(o, !0)), Ne = (n) => n.style?.display !== "hidden";
let Wr = /* @__PURE__ */ new Set();
function wm(n, l = /* @__PURE__ */ new Set()) {
  for (const { group: o, style: i } of n.group_hover ?? []) "display" in i && l.add(o);
  for (const o of n.children ?? []) o.kind !== "text" && wm(o, l);
  return l;
}
function fs(n, l, o, i, s = !1, d = !1, m = null, f = {}, p = !1, x = /* @__PURE__ */ new Map(), S = null) {
  if (n.kind === "text") return x.get(n)?.text ?? n.text;
  const E = pf.has(n);
  d ||= n.style.opacity === 0 || n.style.visibility === "invisible" || n.style.display === "hidden", d && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), n.style.text_color !== void 0 && (S = null), m = n.style.text_color ?? m;
  const w = !!n.hover?.text_color && Em(n), N = n.group ?? (w ? `~g${n.id}` : null);
  w && (S = { group: N, color: n.hover.text_color }), f = { ...f };
  for (const h of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[h] !== void 0 && (f[h] = n.style[h]);
  const k = new Set(n.events ?? []);
  let y;
  if (n.kind === "image" && !n.markup ? y = l.image(n.src) : y = l.div(), n.markup && n.kind === "svg" && S && S.color !== m) {
    const { group: h, color: _ } = S, M = () => l.div().absolute().top(0).left(0).size_full();
    y = y.child(M().group_hover(h, (H) => H.invisible()).child(i.icon(`~icon-${n.id}`, n.markup, m))).child(M().invisible().group_hover(h, (H) => H.visible()).child(i.icon(`~icon-${n.id}-hover`, n.markup, _)));
  } else n.markup && (y = y.child(i.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? m : "")));
  const z = fy(n, k, s);
  if (z && (y = y.id(z)), n.measure && (y = y.measure(n.measure)), n.name && y.also_named) for (const h of n.also ?? []) y = y.also_named(h);
  y = Wo(y, { ...n.style, ...x.get(n) });
  const O = f.whitespace !== "nowrap" && !f.text_ellipsis;
  p && O && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && xm(n) && (y = y.min_w(0));
  for (const h of ["hover", "focus", "active"]) n[h] && (y = y[h]((_) => Wo(_, n[h])));
  N && (y = y.group(N));
  for (const { group: h, style: _ } of n.group_hover ?? []) {
    const { display: M, ...H } = _;
    Object.keys(H).length && (y = y.group_hover(h, (X) => Wo(X, H)));
  }
  if (l.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const h = o.document?.scrollTarget, _ = h ? (n.children ?? []).filter(Ne).findIndex((M) => Sm(M, h.id)) : -1;
    if (_ >= 0 && (o.scroller ?? n.id) === n.id && (o.document.scrollTarget = null, o.scroller = n.id, l.scroll.scroll_to_item(_)), o.scroller ??= n.id, o.scroller === n.id && o.document) {
      y = y.track_scroll(l.scroll);
      const M = (n.children ?? []).filter(Ne).map((H) => H.id);
      o.document.itemBounds = (H) => M.includes(H) ? l.scroll.item_bounds?.(M.indexOf(H)) ?? null : null;
    }
  }
  const D = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll";
  if (D && Fo.has(n) && (y = y.on_scroll_wheel((h, _) => _.stop_propagation?.())), D || Fo.has(n)) for (const h of n.children ?? []) h.kind !== "text" && Fo.add(h);
  n.kind === "input" && !n.disabled && (y = y.on_mouse_down("left", (h, _) => {
    h.bounds && o.setBounds(n.id, h.bounds), o.focus(n.id), _.notify();
  }));
  const A = n.kind === "input" ? n : n.meta?.tag === "label" ? km(n) : null;
  A && !A.disabled && /^(checkbox|radio)$/.test(A.input_type) && (y = y.on_click((h, _) => {
    _.stop_propagation?.(), o.toggle(A.id), _.notify();
  }));
  const L = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((h) => k.has(h));
  if (L || E) for (const h of n.children ?? []) h.kind !== "text" && pf.add(h);
  if (L && (y = y.on_mouse_down("left", (h, _) => {
    _.stop_propagation?.(), h.bounds && o.setBounds(n.id, h.bounds);
    const M = { ...qn(h), button: 0, buttons: 1, detail: h.click_count }, H = hf(o, n.id, h);
    o.pressed = null, o.dispatch(H, "pointerdown", { ...M, pointerType: "mouse" }), o.dispatch(H, "mousedown", M) && o.pressFocus?.(H), _.notify();
  }), y = y.on_mouse_down("right", (h, _) => {
    _.stop_propagation?.(), h.bounds && o.setBounds(n.id, h.bounds);
    const M = hf(o, n.id, h);
    o.pressed = null, o.dispatch(M, "contextmenu", { ...qn(h), button: 2 }), _.notify();
  }), y = y.on_mouse_up("left", (h, _) => {
    _.stop_propagation?.();
    const M = { ...qn(h), button: 0 };
    o.dispatch(n.id, "pointerup", { ...M, pointerType: "mouse" }), o.dispatch(n.id, "mouseup", M), _.notify();
  }), y = y.on_click((h, _) => {
    o.dispatch(n.id, h.click_count === 2 && k.has("double_click") ? "dblclick" : "click", { detail: h.click_count, button: 0 }), _.notify();
  })), n.blocks_pointer && !L)
    for (const h of ["left", "right"]) y = y.on_mouse_down(h, (_, M) => M.stop_propagation?.());
  else if (E && !L)
    for (const h of ["left", "right"])
      y = y.on_mouse_down(h, (_) => {
        const M = qn(_);
        (o.pressed?.x !== M.clientX || o.pressed?.y !== M.clientY) && (o.pressed = { id: n.id, x: M.clientX, y: M.clientY });
      });
  if (k.has("mouse_move") && (y = y.on_mouse_move((h) => {
    o.dispatch(n.id, "pointermove", { ...qn(h), pointerType: "mouse" });
  })), n.track_hover && Wr.has(n.group) && (y = y.on_hover((h, _) => {
    o.hover(n.id, h), _.notify();
  })), s && (y = y.on_mouse_down_out((h, _) => {
    o.dispatch(o.document.body.id, "pointerdown", { ...qn(h), pointerType: "mouse" }), o.dispatch(o.document.body.id, "mousedown", qn(h)), _.notify();
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const h = n.value ? String(n.value) : String(n.placeholder ?? "");
    let _ = l.div().whitespace_nowrap().overflow_x_hidden();
    const M = ca(f);
    M && (_ = _.h(M)), !n.value && m && (_ = _.text_color(py(m))), h && (y = y.child(_.child(n.input_type === "password" && n.value ? "•".repeat([...h].length) : h))), n.field_w && (y = y.child(l.div().w(n.field_w).h(0)));
  }
  const q = f.whitespace === "nowrap" ? ca(f) : null, R = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let g = !n.range_name;
  const v = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const h of (n.children ?? []).filter(Ne)) {
    const _ = h.style?.flex_basis;
    v && h.style.flex_grow > 0 && (_ === 0 || typeof _ == "string" && _.endsWith("%")) && x.set(h, { ...x.get(h), flex_basis: "auto" });
    let M = fs(h, l, o, i, !1, d, m, f, R && h.style?.position !== "absolute", x, S);
    const H = !g && (h.kind === "text" || !h.meta), X = h.kind === "text" ? x.get(h)?.h ?? q : null, I = h.kind === "text" ? x.get(h)?.w : void 0;
    if (H || X || I !== void 0) {
      let $ = l.div();
      H && ($ = $.id(n.range_name)), H && !R && n.style.display === "flex" && ($ = $[`self_${my[f.text_align] ?? "start"}`]().max_w("100%")), X && ($ = $.h(X)), I !== void 0 && ($ = $.w(I).flex_none().whitespace_nowrap()), M = $.child(M), g ||= H;
    }
    y = y.child(M);
  }
  return y;
}
const my = { center: "center", right: "end", end: "end" };
function py(n) {
  const l = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(l)) return n;
  const o = l.length === 9 ? Number.parseInt(l.slice(7), 16) : 255;
  return `${l.slice(0, 7)}${Math.round(o / 2).toString(16).padStart(2, "0")}`;
}
const _m = /^(?:[!-,.-~]+|\S)$/u, km = (n) => {
  for (const l of n.children ?? []) {
    if (l.kind === "input" && /^(checkbox|radio)$/.test(l.input_type)) return l;
    const o = l.kind === "text" ? null : km(l);
    if (o) return o;
  }
  return null;
}, Sm = (n, l) => n.id === l || (n.children ?? []).some((o) => o.kind !== "text" && Sm(o, l)), Em = (n) => !!n.markup || (n.children ?? []).some((l) => l.kind !== "text" && Em(l));
function ca(n) {
  const l = n.line_height;
  return typeof l == "string" && l.endsWith("px") ? Number.parseFloat(l) : typeof l == "number" && typeof n.text_size == "number" ? l * n.text_size : null;
}
function Ny(n, l, o, i, s = 0, d = !1) {
  const m = [n.root, ...n.overlays];
  Wr = /* @__PURE__ */ new Set();
  for (const S of m) wm(S, Wr);
  const f = s > 0 ? wy(m, s) : /* @__PURE__ */ new Map();
  s > 0 && i.measure && hy(m, s, i.measure, f), yy(m, f), vy(m, f), i.measure && by(m, i.measure, f);
  let p = l.div().relative().size_full().child(fs(n.root, l, o, i, !1, !1, null, {}, !1, f)), x = d && n.overlays.length ? l.div().relative().size_full().window_layer() : p;
  for (const S of n.overlays) x = x.child(fs(S, l, o, i, !0, !1, null, {}, !1, f));
  return x === p ? p : p.child(x);
}
function hy(n, l, o, i) {
  const s = (k, y) => i.set(k, { ...i.get(k), ...y }), d = /* @__PURE__ */ new Map(), m = /* @__PURE__ */ new Map(), f = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function p(k, y, z) {
    if (k.kind === "text") {
      if (!(y.whitespace === "nowrap" || _m.test(k.text)) || y.text_ellipsis || z || typeof y.text_size != "number") return NaN;
      const g = o(k.text, { size: y.text_size, weight: y.font_weight ?? 400, family: y.font_family ?? ".SystemUIFont", italic: !!y.italic });
      return Number.isFinite(g) ? g : NaN;
    }
    if (!Ne(k) || k.kind === "input" || k.markup) return x(k);
    const O = { ...y };
    for (const R of f) k.style[R] !== void 0 && (O[R] = k.style[R]);
    O.text_ellipsis = !!k.style.text_ellipsis, m.set(k, O);
    const D = k.style, A = (k.children ?? []).filter(Ge), L = A.map((R) => p(R, O, z || !!k.tabular));
    let q = x(k);
    if (!Number.isFinite(q) && D.w === void 0) {
      const R = A.map((v, h) => L[h] + (v.kind === "text" ? 0 : it(v.style.ml) + it(v.style.mr)));
      let g;
      A.length ? Oe(k) ? g = A.some((v) => v.kind !== "text" && v.style.flex_grow > 0) || D.flex_wrap === "wrap" ? NaN : R.reduce((v, h) => v + h, 0) + it(D.gap_x) * (A.length - 1) : g = Math.max(...R) : g = 0, q = g + it(D.pl) + it(D.pr) + it(D.border_l) + it(D.border_r), typeof D.min_w == "number" && (q = Math.max(q, D.min_w)), typeof D.max_w == "number" && (q = Math.min(q, D.max_w));
    }
    return d.set(k, q), q;
  }
  const x = (k) => typeof k.style?.w == "number" ? k.style.w : NaN, S = () => ({ exact: 0, laid: 0 }), E = (k, y) => {
    if (!Number.isFinite(y))
      return Object.assign(k, S()), NaN;
    k.exact += y;
    const z = Math.round(k.exact * l + 1e-9) / l, O = z - k.laid;
    return k.laid = z, O;
  }, w = (k) => Oe(k) && k.style.flex_wrap !== "wrap" && (k.style.justify ?? "start") === "start";
  function N(k) {
    if (!k || k.kind === "text" || !Ne(k)) return;
    const y = (k.children ?? []).filter(Ge);
    if (w(k) && y.length > 1) {
      const z = it(k.style.gap_x), O = S(), D = !(z && y.some((A) => A.kind === "text" || !Number.isFinite(it(A.style.ml))));
      s(k, { border_l: E(O, it(k.style.border_l)), pl: E(O, it(k.style.pl)) }), D && z && s(k, { gap_x: 0 }), y.forEach((A, L) => {
        const q = (L && D ? z : 0) + (A.kind === "text" ? 0 : it(A.style.ml));
        if (A.kind === "text")
          q && Object.assign(O, S());
        else {
          const h = E(O, q);
          Number.isFinite(h) && s(A, { ml: h });
        }
        const R = A.kind === "text" ? m.get(k) ?? {} : null, g = A.kind === "text" ? p(A, R, !!k.tabular) : d.get(A);
        if ((A.kind === "text" || !(A.style.flex_grow > 0)) && Number.isFinite(g)) {
          const h = { w: E(O, g) };
          A.kind !== "text" && typeof A.style.w != "number" && A.style.min_w === void 0 && (h.whitespace = "nowrap", h.flex_shrink = 0), s(A, h);
        } else Object.assign(O, S());
        if (A.kind !== "text") {
          const h = E(O, it(A.style.mr));
          Number.isFinite(h) && s(A, { mr: h });
        }
      });
    }
    for (const z of k.children ?? []) z.kind !== "text" && N(z);
  }
  for (const k of n)
    k && (p(k, {}, !1), N(k));
}
const gy = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function by(n, l, o) {
  const i = ["text_size", "font_weight", "font_family", "italic", "line_height"], s = (f) => typeof f == "number" ? f : 0, d = (f, p) => p && Fr(p) && !Oe(p) && f.style.position !== "absolute" && !["start", "center", "end"].includes(f.style.self) && !["start", "center", "end"].includes(p.style.items), m = (f, p, x, S) => {
    if (!f || f.kind === "text" || !Ne(f)) return;
    const E = f.style;
    let w = typeof E.w == "number" ? E.w : E.w === "100%" ? x : d(f, p) ? x - s(E.ml) - s(E.mr) : NaN;
    typeof E.max_w == "number" && (w = Math.min(w, E.max_w));
    const N = w - s(E.pl) - s(E.pr) - s(E.border_l) - s(E.border_r), k = { ...S };
    for (const z of i) E[z] !== void 0 && (k[z] = E[z]);
    const y = f.children ?? [];
    if (f.break_anywhere && Number.isFinite(N) && N > 0 && typeof k.text_size == "number" && y.length && y.every((z) => z.kind === "text")) {
      const z = { size: k.text_size, weight: k.font_weight ?? 400, family: k.font_family ?? ".SystemUIFont", italic: !!k.italic }, O = (L) => l(L.trimEnd(), z) <= N + 0.01;
      let D = 0;
      for (const L of y) {
        const q = [];
        for (const g of L.text.split(`
`)) {
          let v = "";
          for (const h of g.split(gy)) {
            if (O(v + h)) {
              v += h;
              continue;
            }
            v && q.push(v.trimEnd()), v = "";
            for (const _ of h)
              v && !O(v + _) && (q.push(v), v = ""), v += _;
          }
          q.push(v.trimEnd());
        }
        const R = q.join(`
`);
        q.every((g) => !g || O(g)) ? R !== L.text && o.set(L, { ...o.get(L), text: R }) : D = NaN, D += q.length;
      }
      const A = ca(k);
      Number.isFinite(D) && A && E.h === void 0 && y.length === 1 && o.set(f, { ...o.get(f), h: D * A + s(E.pt) + s(E.pb) + s(E.border_t) + s(E.border_b) });
    }
    for (const z of y) m(z, f, Oe(f) ? NaN : N, k);
  };
  for (const f of n) m(f, null, NaN, {});
}
function vy(n, l) {
  const o = (i, s) => {
    if (!i || i.kind === "text" || !Ne(i)) return;
    const d = i.style, m = d.position === "absolute" ? d.w === void 0 && (d.left === void 0 || d.right === void 0) : s && typeof d.w != "number";
    if (m && Oe(i))
      for (const f of i.children ?? []) {
        const p = f.kind === "text" ? void 0 : f.style.flex_basis;
        f.kind !== "text" && f.style.flex_grow > 0 && (p === 0 || typeof p == "string" && p.endsWith("%")) && l.set(f, { ...l.get(f), flex_basis: "auto" });
      }
    for (const f of i.children ?? []) o(f, m);
  };
  for (const i of n) o(i, !1);
}
function yy(n, l) {
  const o = l.heights ?? /* @__PURE__ */ new Map(), i = (p) => o.get(p), s = (p) => {
    const x = i(p);
    if (Number.isFinite(x)) return x;
    if (p.kind === "text" || !Ne(p)) return 0;
    const S = p.style, E = typeof S.min_h == "number" ? S.min_h : 0, w = (p.children ?? []).filter(Ge), N = w.map((z) => s(z) + (z.kind === "text" ? 0 : Math.max(0, it(z.style.mt) || 0) + Math.max(0, it(z.style.mb) || 0))), k = w.length ? Oe(p) ? Math.max(...N) : N.reduce((z, O) => z + O, 0) + (S.display === "flex" ? (it(S.gap_y) || 0) * (w.length - 1) : 0) : 0, y = [S.pt, S.pb, S.border_t, S.border_b].reduce((z, O) => z + (it(O) || 0), 0);
    return Math.max(E, k + y);
  }, d = (p) => !(p.children ?? []).filter(Ge).length || Oe(p) ? NaN : s({ ...p, style: { ...p.style, h: void 0, max_h: void 0, min_h: void 0 } }), m = (p, x) => {
    const S = p.style;
    if (typeof S.h == "number") return S.h;
    if (typeof S.max_h == "number") return S.max_h;
    if (!x || !Fr(x) || Oe(x)) return NaN;
    const E = x.style, w = typeof E.h == "number" ? E.h : typeof E.max_h == "number" ? E.max_h : NaN, N = (x.children ?? []).filter(Ge);
    let k = 0;
    for (const z of N) {
      if (z === p) continue;
      const O = i(z);
      if (!Number.isFinite(O)) return NaN;
      k += O + (z.kind === "text" ? 0 : it(z.style.mt) + it(z.style.mb));
    }
    const y = E.display === "flex" ? it(E.gap_y) * Math.max(0, N.length - 1) : 0;
    return w - it(E.pt) - it(E.pb) - it(E.border_t) - it(E.border_b) - k - y - it(S.mt) - it(S.mb);
  }, f = (p, x) => {
    if (!(!p || p.kind === "text" || !Ne(p))) {
      if (p.scrollbar > 0 && p.style.overflow_y === "scroll") {
        const S = d(p), E = m(p, x);
        Number.isFinite(S) && Number.isFinite(E) && S > E + 0.01 && l.set(p, { ...l.get(p), pr: it(p.style.pr) + p.scrollbar });
      }
      for (const S of p.children ?? []) f(S, p);
    }
  };
  for (const p of n) f(p, null);
}
const xy = ["text_size", "line_height", "whitespace", "text_ellipsis"], it = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, Fr = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Oe = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Ge = (n) => n.kind === "text" || Ne(n) && n.style.position !== "absolute";
function wy(n, l) {
  const o = /* @__PURE__ */ new Map(), i = (y, z) => o.set(y, { ...o.get(y), ...Object.fromEntries(Object.entries(z).filter(([, O]) => Number.isFinite(O))) }), s = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  function m(y, z) {
    if (y.kind === "text") return z.whitespace === "nowrap" || _m.test(y.text) ? ca(z) ?? NaN : NaN;
    const O = { ...z };
    for (const R of xy) y.style[R] !== void 0 && (O[R] = y.style[R]);
    d.set(y, O);
    const D = y.style, A = (y.children ?? []).filter(Ge), L = A.map((R) => m(R, O));
    let q;
    if (D.h !== void 0 && D.h !== "auto") q = it(D.h);
    else if (y.kind === "input")
      q = (y.input_type === "textarea" || y.input_type === "select" ? NaN : ca(O) ?? NaN) + it(D.pt) + it(D.pb) + it(D.border_t) + it(D.border_b), D.min_h !== void 0 && (q = Math.max(q, it(D.min_h)));
    else {
      const R = A.map((v, h) => (v.kind === "text" ? 0 : it(v.style.mt) + it(v.style.mb)) + L[h]);
      let g;
      if (Oe(y)) g = D.flex_wrap === "wrap" ? NaN : D.items === "baseline" ? p(A, L, O) : Math.max(0, ...R);
      else if (Fr(y)) {
        const v = A.some((_) => _.kind !== "text" && (_.style.flex_grow > 0 || _.style.flex_basis !== void 0)), h = D.display !== "flex" && A.some((_) => _.kind !== "text" && (it(_.style.mt) || it(_.style.mb)));
        g = v || h ? NaN : R.reduce((_, M) => _ + M, 0) + (D.display === "flex" ? it(D.gap_y) * Math.max(0, A.length - 1) : 0);
      } else g = NaN;
      q = g + it(D.pt) + it(D.pb) + it(D.border_t) + it(D.border_b), D.min_h !== void 0 && (q = Math.max(q, it(D.min_h))), D.max_h !== void 0 && (q = Math.min(q, it(D.max_h)));
    }
    return s.set(y, q), q;
  }
  const f = (y) => (ca(y) - (Lr + Hf) * y.text_size) / 2 + Lr * y.text_size;
  function p(y, z, O) {
    let D = 0, A = 0;
    for (const [L, q] of y.entries()) {
      const R = q.kind === "text" ? O : d.get(q);
      if (!(q.kind === "text" || (q.children ?? []).filter(Ge).every((_) => _.kind === "text")) || !Number.isFinite(z[L]) || typeof R.text_size != "number") return NaN;
      const v = q.kind === "text" ? {} : q.style, h = it(v.mt) + it(v.border_t) + it(v.pt) + f(R);
      D = Math.max(D, h), A = Math.max(A, it(v.mt) + z[L] + it(v.mb) - h);
    }
    return D + A;
  }
  const x = () => ({ exact: 0, laid: 0 }), S = (y, z) => {
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
        i(y, { border_t: S(z, it(y.style.border_t)), pt: S(z, it(y.style.pt)) }), w(y, z);
      } else for (const z of (y.children ?? []).filter(Ge)) z.kind !== "text" && E(z);
    }
  }
  function w(y, z) {
    const O = (y.children ?? []).filter(Ge), D = y.style.display === "flex" ? it(y.style.gap_y) : 0;
    if (D && O.some((A) => A.kind === "text")) {
      for (const A of O) A.kind !== "text" && E(A);
      return !1;
    }
    return D && i(y, { gap_y: 0 }), O.forEach((A, L) => {
      if (A.kind === "text") {
        const q = s.get(A) ?? m(A, d.get(y) ?? {});
        Number.isFinite(q) ? i(A, { h: S(z, q) }) : Object.assign(z, x());
        return;
      }
      if (i(A, { mt: S(z, (L ? D : 0) + it(A.style.mt)) }), Number.isFinite(s.get(A))) k(A, z);
      else if (N(A)) {
        const q = A.style;
        i(A, { border_t: S(z, it(q.border_t)), pt: S(z, it(q.pt)) }), i(A, { pb: S(z, it(q.pb)), border_b: S(z, it(q.border_b)) });
      } else
        E(A), Object.assign(z, x());
      i(A, { mb: S(z, it(A.style.mb)) });
    }), !0;
  }
  function N(y) {
    const z = y.style, O = (y.children ?? []).filter(Ge), D = ca(d.get(y) ?? {});
    return y.kind === "div" && !Oe(y) && O.length > 0 && O.every((A) => A.kind === "text") && Number.isInteger(D) && [z.h, z.min_h, z.max_h].every((A) => A === void 0 || A === "auto");
  }
  function k(y, z) {
    const O = y.style;
    for (const R of (y.children ?? []).filter((g) => g.kind !== "text" && Ne(g) && g.style.position === "absolute")) E(R);
    const D = z.laid, A = z.exact;
    i(y, { border_t: S(z, it(O.border_t)), pt: S(z, it(O.pt)) });
    const L = O.h !== void 0 && O.h !== "auto", q = s.get(y) - it(O.pt) - it(O.pb) - it(O.border_t) - it(O.border_b);
    if (y.kind === "input")
      L || S(z, q);
    else if (Oe(y) || L && (O.justify ?? "start") !== "start") {
      for (const R of (y.children ?? []).filter(Ge)) R.kind !== "text" && E(R);
      L || S(z, q);
    } else !w(y, z) && !L && S(z, q);
    if (L) {
      z.exact = A + s.get(y), z.laid = Math.round(z.exact * l + 1e-9) / l, i(y, { h: z.laid - D });
      return;
    }
    i(y, { pb: S(z, it(O.pb)), border_b: S(z, it(O.border_b)) }), i(y, { h: z.laid - D });
  }
  for (const y of n)
    m(y, {}), E(y);
  return Object.defineProperty(o, "heights", { value: s }), o;
}
const Ty = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }], settings: [{ name: "settings-modal", selector: '[data-testid="settings-modal"]' }, { name: "settings-nav-card", selector: '[data-testid="settings-modal"] > nav' }, { name: "settings-close", selector: '[data-testid="settings-close"]' }, { name: "settings-nav", selector: 'nav [data-testid^="settings-nav-"]', key: { self: !0, attr: "data-testid", strip: "settings-nav-" } }, { name: "settings-main-card", selector: '[data-testid="settings-modal"] > main' }, { name: "settings-search", selector: '[data-testid="settings-search"]' }, { name: "settings-title", selector: '[data-testid="settings-modal"] > main h1' }, { name: "settings-body", selector: '[data-testid="settings-modal"] .settings-modal__body' }, { name: "settings-group-title", selector: '[data-testid="settings-modal"] > main h3' }, { name: "settings-group-card", selector: '[data-testid="settings-modal"] > main section > div.rounded-ui' }, { name: "settings-row", selector: '[data-testid="settings-modal"] [data-setting-row]' }, { name: "settings-row-title", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:first-child' }, { name: "settings-row-description", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:nth-child(2)' }, { name: "settings-result-title", selector: '[data-testid^="settings-result-"] > h2' }] };
export {
  Ty as NAMED_ELEMENTS,
  m0 as React,
  X0 as SCHEMA,
  zy as STYLE_KEYS,
  Ny as describeToGpui,
  _y as jsxRuntime,
  ky as mount,
  Sy as reactDom,
  Ey as sdk
};
