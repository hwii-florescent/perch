function Gs(n, a) {
  for (var r = 0; r < a.length; r++) {
    const o = a[r];
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
const Lg = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), Vg = /* @__PURE__ */ new Set(["not", "is", "where", "has", "nth-child"]), Qg = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...Lg]);
function bs(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (a, r, o) => r ? String.fromCodePoint(parseInt(r, 16)) : o);
}
function wl(n, a) {
  let r = a;
  for (; r < n.length; ) {
    const o = n[r];
    if (o === "\\") {
      r += 2;
      continue;
    }
    if (/[A-Za-z0-9_\- -￿]/.test(o)) {
      r++;
      continue;
    }
    break;
  }
  if (r === a) throw new re(`expected a name at ${a} in ${JSON.stringify(n)}`);
  return [bs(n.slice(a, r)), r];
}
function Kg(n, a) {
  let r = 1;
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
    if (s === "(") r++;
    else if (s === ")" && --r === 0) return o;
  }
  throw new re(`unbalanced parenthesis in ${JSON.stringify(n)}`);
}
function Ys(n) {
  const a = [];
  let r = 0, o = 0;
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
    u === "(" || u === "[" ? r++ : u === ")" || u === "]" ? r-- : u === "," && r === 0 && (a.push(n.slice(o, s).trim()), o = s + 1);
  }
  return a.push(n.slice(o).trim()), a.filter(Boolean);
}
function Xg(n, a) {
  const r = { tag: null, id: null, classes: [], attrs: [], pseudos: [], pseudoElement: null };
  let o = !1;
  for (; a < n.length; ) {
    const s = n[a];
    if (s === "*") {
      r.tag = "*", a++, o = !0;
      continue;
    }
    if (s === ".") {
      const [u, m] = wl(n, a + 1);
      r.classes.push(u), a = m, o = !0;
      continue;
    }
    if (s === "#") {
      const [u, m] = wl(n, a + 1);
      r.id = u, a = m, o = !0;
      continue;
    }
    if (s === "[") {
      const u = n.indexOf("]", a);
      if (u < 0) throw new re(`unclosed [ in ${JSON.stringify(n)}`);
      const m = n.slice(a + 1, u).trim(), f = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(m);
      if (!f) throw new re(`cannot read the attribute selector [${m}]`);
      const p = f[3] ?? f[4] ?? f[5];
      r.attrs.push({ name: bs(f[1]).toLowerCase(), op: f[2] ?? null, value: p === void 0 ? null : bs(p) }), a = u + 1, o = !0;
      continue;
    }
    if (s === ":") {
      if (n[a + 1] === ":") {
        const [p, v] = wl(n, a + 2), x = p.toLowerCase();
        if (x !== "before" && x !== "after") throw new re(`::${x} is not supported`);
        if (r.pseudoElement = x, a = v, o = !0, a < n.length && !/[\s>]/.test(n[a])) throw new re(`nothing may follow ::${x} in ${JSON.stringify(n)}`);
        break;
      }
      const [u, m] = wl(n, a + 1);
      a = m;
      const f = u.toLowerCase();
      if ((f === "before" || f === "after") && n[a] !== "(") {
        if (r.pseudoElement = f, o = !0, a < n.length && !/[\s>]/.test(n[a])) throw new re(`nothing may follow :${f} in ${JSON.stringify(n)}`);
        break;
      }
      if (n[a] === "(") {
        if (!Vg.has(f)) throw new re(`:${f}() is not supported`);
        const p = Kg(n, a + 1), v = n.slice(a + 1, p).trim();
        if (a = p + 1, f === "nth-child") {
          if (!/^\d+$/.test(v)) throw new re(`:nth-child(${v}) is not supported (only a number)`);
          r.pseudos.push({ name: f, n: Number(v) });
        } else {
          const x = Ys(v).map(Ls);
          if (f === "has" && x.some((y) => y.length !== 1)) throw new re(`:has(${v}) is not supported (only a compound selector)`);
          r.pseudos.push({ name: f, list: x });
        }
      } else {
        if (!Qg.has(f)) throw new re(`:${f} is not supported`);
        r.pseudos.push({ name: f });
      }
      o = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(s) && !o) {
      const [u, m] = wl(n, a);
      r.tag = u.toLowerCase(), a = m, o = !0;
      continue;
    }
    break;
  }
  if (!o) throw new re(`empty compound selector at ${a} in ${JSON.stringify(n)}`);
  return [r, a];
}
function Ls(n) {
  const a = [];
  let r = 0, o = null;
  for (n = n.trim(); r < n.length; ) {
    const [s, u] = Xg(n, r);
    if (a.at(-1)?.compound.pseudoElement) throw new re(`::${a.at(-1).compound.pseudoElement} must end ${JSON.stringify(n)}`);
    a.push({ compound: s, combinator: o }), r = u;
    let m = !1;
    for (; n[r] === " " || n[r] === `
` || n[r] === "	"; )
      r++, m = !0;
    if (r >= n.length) break;
    const f = n[r];
    if (f === ">")
      for (o = ">", r++; n[r] === " "; ) r++;
    else {
      if (f === "+" || f === "~") throw new re(`the ${f} combinator is not supported`);
      if (m) o = " ";
      else throw new re(`unexpected ${JSON.stringify(f)} in ${JSON.stringify(n)}`);
    }
  }
  if (!a.length) throw new re("empty selector");
  return a;
}
const Wd = /* @__PURE__ */ new Map();
function pr(n) {
  let a = Wd.get(n);
  return a || (a = Ys(n).map(Ls), Wd.set(n, a)), a;
}
function em(n) {
  const a = [0, 0, 0], r = (o) => {
    a[0] += o[0], a[1] += o[1], a[2] += o[2];
  };
  for (const { compound: o } of n) {
    o.id && a[0]++, a[1] += o.classes.length + o.attrs.length, o.tag && o.tag !== "*" && a[2]++, o.pseudoElement && a[2]++;
    for (const s of o.pseudos)
      if (s.name !== "where")
        if (s.list) {
          const u = s.list.map(em).sort((m, f) => f[0] - m[0] || f[1] - m[1] || f[2] - m[2])[0];
          r(u);
        } else a[1]++;
  }
  return a;
}
function Zg(n, { name: a, op: r, value: o }) {
  const s = n.getAttribute(a);
  if (s == null) return !1;
  if (r === null) return !0;
  switch (r) {
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
function Hi(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function nm(n, a) {
  for (const r of n.children) if (a(r) || nm(r, a)) return !0;
  return !1;
}
function am(n, a, r, o) {
  if ((a.pseudoElement ?? null) !== (o ? r.pseudo ?? null : null) || a.tag && a.tag !== "*" && n.tagName !== a.tag || a.id && n.getAttribute("id") !== a.id) return !1;
  if (a.classes.length) {
    const s = n.classSet ?? new Set(n.classList ?? []);
    for (const u of a.classes) if (!s.has(u)) return !1;
  }
  for (const s of a.attrs) if (!Zg(n, s)) return !1;
  for (const s of a.pseudos)
    switch (s.name) {
      case "first-child":
        if (Hi(n)[0] !== n) return !1;
        break;
      case "only-child":
        if (Hi(n).length !== 1) return !1;
        break;
      case "last-child": {
        const u = Hi(n);
        if (u[u.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (Hi(n).indexOf(n) !== s.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (s.list.some((u) => La(n, u, r, o))) return !1;
        break;
      case "has":
        if (n.watchesDescendants = !0, !s.list.some(([{ compound: u }]) => nm(n, (m) => am(m, u, r, !1)))) return !1;
        break;
      case "is":
      case "where":
        if (!s.list.some((u) => La(n, u, r, o))) return !1;
        break;
      default:
        if (!r.state || !r.state(n, s.name, o)) return !1;
    }
  return !0;
}
function La(n, a, r, o = !0) {
  const s = (u, m, f) => {
    const { compound: p, combinator: v } = a[m];
    if (!am(u, p, r, f)) return !1;
    if (m === 0) return !0;
    if (v === ">") return !!u.parentElement && s(u.parentElement, m - 1, !1);
    for (let x = u.parentElement; x; x = x.parentElement) if (s(x, m - 1, !1)) return !0;
    return !1;
  };
  return s(n, a.length - 1, o);
}
function Jg(n, a, r = {}) {
  return (typeof a == "string" ? pr(a) : a).some((s) => La(n, s, r));
}
function vs(n, a, r = {}) {
  return La(n, a, r);
}
function Al(n, a, r = {}) {
  const o = pr(a), s = [], u = (m) => {
    for (const f of m.children)
      o.some((p) => La(f, p, r)) && s.push(f), u(f);
  };
  return u(n), s;
}
function lm(n, a, r = {}) {
  const o = pr(a);
  for (let s = n; s; s = s.parentElement) if (o.some((u) => La(s, u, r))) return s;
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
let Wg = 1;
class ys {
  constructor(a = 0, r = 0, o = 0, s = 0) {
    this.x = a, this.y = r, this.width = o, this.height = s;
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
class Vs {
  constructor() {
    this.listeners = [];
  }
  addEventListener(a, r, o) {
    const s = o === !0 || !!o?.capture;
    this.listeners.some((u) => u.type === a && u.listener === r && u.capture === s) || this.listeners.push({ type: a, listener: r, capture: s });
  }
  removeEventListener(a, r, o) {
    const s = o === !0 || !!o?.capture;
    this.listeners = this.listeners.filter((u) => !(u.type === a && u.listener === r && u.capture === s));
  }
}
let Fg = 0;
const xs = () => ++Fg;
class hr {
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
class Zt extends Vs {
  constructor(a, r = {}, o = null) {
    super(), this.nodeType = 1, this.id = `n${Wg++}`, this.tagName = a.toLowerCase(), this.props = r, this.childNodes = [], this.parentNode = null, this.ownerDocument = o, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0, this.attrStamp = 0, this.stamp = 0;
  }
  /** Its props, attributes or state changed. */
  touch() {
    this.version++, this.attrStamp = xs(), this.mark();
  }
  /** Its subtree changed: it and its ancestors are described again (their styles are kept unless they changed). */
  mark() {
    const a = xs();
    for (let r = this; r instanceof Zt; r = r.parentNode) r.stamp = a;
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
    for (const [r, o] of Object.entries(this.props))
      r.startsWith("data-") && o != null && o !== !1 && (a[r.slice(5).replace(/-([a-z])/g, (s, u) => u.toUpperCase())] = String(o));
    return a;
  }
  /** The DOM attribute React would write for `name`, or null. */
  getAttribute(a) {
    const r = this.props;
    if (a === "class") return this.className || null;
    if (a === "id") return r.id != null ? String(r.id) : null;
    if (a === "style") return null;
    const s = r[a === "for" ? "htmlFor" : a === "tabindex" ? "tabIndex" : a];
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
    const o = this.childNodes.indexOf(r);
    return a.parentNode = this, o < 0 ? this.childNodes.push(a) : this.childNodes.splice(o, 0, a), this.touchWatchers(), a;
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
    return Jg(this, a);
  }
  closest(a) {
    return lm(this, a);
  }
  querySelectorAll(a) {
    return Al(this, a);
  }
  querySelector(a) {
    return Al(this, a)[0] ?? null;
  }
  /** Where the engine last laid this element out (`HostDocument.measure`); else, before its first layout, a box the
   * engine reported another way (the direct children of a scroll area, a pressed element); else a zero box. */
  getBoundingClientRect() {
    const a = this.ownerDocument?.measure?.(this) ?? this.ownerDocument?.itemBounds?.(this.id) ?? this.bounds;
    return a ? new ys(a.x, a.y, a.width, a.height) : new ys();
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
    const a = this, r = (m) => String(m).startsWith("--") ? String(m) : String(m).replace(/-([a-z])/g, (f, p) => p.toUpperCase()), o = (m) => {
      const f = a.props.style?.[m];
      return f == null || typeof f == "boolean" ? "" : typeof f == "number" && f !== 0 ? `${f}px` : String(f);
    }, s = (m) => a.inline && m in a.inline ? a.inline[m] : o(m), u = (m, f) => {
      const p = f == null ? "" : String(f);
      s(m) !== p && (a.inline ??= {}, p === o(m) ? delete a.inline[m] : a.inline[m] = p, a.touch(), a.ownerDocument?.restyled());
    };
    return this.styleView = new Proxy({}, {
      get: (m, f) => {
        if (typeof f == "string")
          return f === "setProperty" ? (p, v) => u(r(p), v) : f === "removeProperty" ? (p) => {
            const v = s(r(p));
            return u(r(p), ""), v;
          } : f === "getPropertyValue" ? (p) => s(r(p)) : s(f);
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
    return Fd(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(a = []) {
    return Fd(this, a);
  }
}
const im = Symbol("perch.stale-layout"), rm = 3;
let Fi = !1;
function om(n) {
  return () => {
    let a, r = !1;
    const o = (s) => {
      const u = Fi;
      Fi = s < rm;
      try {
        a = n();
      } catch (m) {
        const f = m?.[im];
        if (!f) throw m;
        f.retries.push(() => {
          r || o(s + 1);
        });
      } finally {
        Fi = u;
      }
    };
    return o(0), () => {
      r = !0, typeof a == "function" && a();
    };
  };
}
const ws = "perch-dom:", $g = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), Ig = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function Fd(n, a = []) {
  const r = new Set(a.map((s) => Ig[s] ?? s)), o = (s) => {
    if (!(s instanceof Zt)) return { x: s.data, ...s.hidden ? { h: 1 } : {} };
    const u = {};
    for (const [m, f] of Object.entries(s.props))
      $g.has(m) || r.has(m) || f == null || typeof f == "function" || typeof f == "symbol" || (u[m] = f);
    return { t: s.tagName, p: u, c: s.childNodes.map(o), ...s.hidden ? { h: 1 } : {} };
  };
  return ws + JSON.stringify(o(n));
}
function Pg(n, a) {
  if (typeof n != "string" || !n.startsWith(ws)) return null;
  let r;
  try {
    r = JSON.parse(n.slice(ws.length));
  } catch {
    return null;
  }
  const o = (u) => !!u && typeof u == "object" && !Array.isArray(u), s = (u) => {
    if (!o(u)) throw new Error("not a node");
    let m;
    if (typeof u.x == "string") m = new hr(u.x);
    else {
      if (typeof u.t != "string" || !/^[a-z][a-z0-9-]*$/i.test(u.t) || !o(u.p) || !Array.isArray(u.c)) throw new Error("not an element");
      m = new Zt(u.t, u.p, a);
      for (const f of u.c) m.appendChild(s(f));
    }
    return m.hidden = u.h === 1, m;
  };
  try {
    return [s(r)];
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
function $d(n) {
  for (let a = n; a instanceof Zt; a = a.parentElement) a.touch();
}
class n0 extends Vs {
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
    const r = this.perch?.bounds;
    if (typeof r != "function" || !this.measureKey) return null;
    a.measured || (a.measured = !0, a.touch(), this.restyled());
    const o = r(this.measureKey(a));
    if (Fi && (!o || this.stale?.())) throw { [im]: this };
    return o ?? null;
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(a) {
    this.activeElement && this.activeElement !== a && this.blur(this.activeElement), this.activeElement = a, a.state.focus = !0, a.state.pointerFocus = !1, $d(a), this.restyled(), this.perch?.focused?.(a);
  }
  blur(a) {
    a.state.focus = !1, $d(a), this.restyled(), this.activeElement === a && (this.activeElement = this.body);
  }
  querySelectorAll(a) {
    return Al(this.documentElement, a);
  }
  querySelector(a) {
    return this.querySelectorAll(a)[0] ?? null;
  }
  /** The element whose `id` prop is `id` (React's `useId` ids are not selectors). */
  getElementById(a) {
    return Al(this.documentElement, "*").find((r) => r.props?.id === a) ?? null;
  }
}
class a0 extends Vs {
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
  setTimeout(a, r, ...o) {
    return globalThis.setTimeout(a, r, ...o);
  }
  clearTimeout(a) {
    return globalThis.clearTimeout(a);
  }
}
function sm(n) {
  return {
    setTimeout: (a, r = 0, ...o) => n.setTimeout(() => a(...o), Math.max(0, Number(r) || 0)),
    clearTimeout: (a) => {
      a != null && n.clearTimeout(a);
    }
  };
}
const Id = Symbol.for("perch.react.globals");
function We(n, a, r) {
  Object.defineProperty(n, a, { value: r, configurable: !0, writable: !0, enumerable: !1 });
}
function l0(n, a = globalThis) {
  const r = new n0(n), o = new a0(n, r);
  r.defaultView = o;
  const s = n.storage ?? new e0();
  if (typeof a.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const f = sm(n);
    We(a, "setTimeout", f.setTimeout), We(a, "clearTimeout", f.clearTimeout);
  }
  typeof a.queueMicrotask != "function" && We(a, "queueMicrotask", (f) => {
    Promise.resolve().then(f);
  }), We(a, "requestAnimationFrame", (f) => a.setTimeout(() => f(Date.now()), 0)), We(a, "cancelAnimationFrame", (f) => a.clearTimeout(f));
  const u = { document: r, window: o, localStorage: s, HTMLElement: Zt, Element: Zt };
  for (const f of Object.keys(u))
    Object.defineProperty(a, f, { get: () => a[Id]?.[f], configurable: !0, enumerable: !1 });
  a[Id] = u, We(a, "DOMRect", ys), We(a, "getComputedStyle", i0), typeof a.ResizeObserver != "function" && We(a, "ResizeObserver", t0);
  const m = a.navigator && typeof a.navigator == "object" ? a.navigator : {};
  if (!m.clipboard && n.clipboard)
    try {
      We(m, "clipboard", n.clipboard);
    } catch {
    }
  return a.navigator || We(a, "navigator", m), { document: r, window: o, globals: u };
}
function i0(n) {
  const a = n?.ownerDocument?.computed?.(n) ?? {}, r = (o) => {
    const s = a[o];
    return typeof s == "string" || typeof s == "number" ? String(s) : "";
  };
  return new Proxy({}, {
    get: (o, s) => {
      if (typeof s == "string")
        return s === "getPropertyValue" ? (u) => r(String(u)) : r(s.replace(/[A-Z]/g, (u) => `-${u.toLowerCase()}`));
    }
  });
}
function _s(n, a = !1) {
  if (!(a ? n?.tagName === "input" && cm(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let o = n.parentElement; o; o = o.parentElement) if (o.tagName === "form") return o;
  return null;
}
const cm = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Pd = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Pd?.setTimeout == "function") {
  const n = sm(Pd);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function Qs(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function r0(n) {
  if (Object.prototype.hasOwnProperty.call(n, "__esModule")) return n;
  var a = n.default;
  if (typeof a == "function") {
    var r = function o() {
      return this instanceof o ? Reflect.construct(a, arguments, this.constructor) : a.apply(this, arguments);
    };
    r.prototype = a.prototype;
  } else r = {};
  return Object.defineProperty(r, "__esModule", { value: !0 }), Object.keys(n).forEach(function(o) {
    var s = Object.getOwnPropertyDescriptor(n, o);
    Object.defineProperty(r, o, s.get ? s : {
      enumerable: !0,
      get: function() {
        return n[o];
      }
    });
  }), r;
}
var ls = { exports: {} }, pt = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var tf;
function o0() {
  if (tf) return pt;
  tf = 1;
  var n = Symbol.for("react.transitional.element"), a = Symbol.for("react.portal"), r = Symbol.for("react.fragment"), o = Symbol.for("react.strict_mode"), s = Symbol.for("react.profiler"), u = Symbol.for("react.consumer"), m = Symbol.for("react.context"), f = Symbol.for("react.forward_ref"), p = Symbol.for("react.suspense"), v = Symbol.for("react.memo"), x = Symbol.for("react.lazy"), y = Symbol.for("react.activity"), b = Symbol.iterator;
  function S(C) {
    return C === null || typeof C != "object" ? null : (C = b && C[b] || C["@@iterator"], typeof C == "function" ? C : null);
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
  }, E = Object.assign, T = {};
  function j(C, Z, at) {
    this.props = C, this.context = Z, this.refs = T, this.updater = at || N;
  }
  j.prototype.isReactComponent = {}, j.prototype.setState = function(C, Z) {
    if (typeof C != "object" && typeof C != "function" && C != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, C, Z, "setState");
  }, j.prototype.forceUpdate = function(C) {
    this.updater.enqueueForceUpdate(this, C, "forceUpdate");
  };
  function R() {
  }
  R.prototype = j.prototype;
  function U(C, Z, at) {
    this.props = C, this.context = Z, this.refs = T, this.updater = at || N;
  }
  var F = U.prototype = new R();
  F.constructor = U, E(F, j.prototype), F.isPureReactComponent = !0;
  var J = Array.isArray;
  function B() {
  }
  var g = { H: null, A: null, T: null, S: null }, h = Object.prototype.hasOwnProperty;
  function _(C, Z, at) {
    var st = at.ref;
    return {
      $$typeof: n,
      type: C,
      key: Z,
      ref: st !== void 0 ? st : null,
      props: at
    };
  }
  function k(C, Z) {
    return _(C.type, Z, C.props);
  }
  function z(C) {
    return typeof C == "object" && C !== null && C.$$typeof === n;
  }
  function O(C) {
    var Z = { "=": "=0", ":": "=2" };
    return "$" + C.replace(/[=:]/g, function(at) {
      return Z[at];
    });
  }
  var A = /\/+/g;
  function G(C, Z) {
    return typeof C == "object" && C !== null && C.key != null ? O("" + C.key) : Z.toString(36);
  }
  function W(C) {
    switch (C.status) {
      case "fulfilled":
        return C.value;
      case "rejected":
        throw C.reason;
      default:
        switch (typeof C.status == "string" ? C.then(B, B) : (C.status = "pending", C.then(
          function(Z) {
            C.status === "pending" && (C.status = "fulfilled", C.value = Z);
          },
          function(Z) {
            C.status === "pending" && (C.status = "rejected", C.reason = Z);
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
  function D(C, Z, at, st, ct) {
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
                Z,
                at,
                st,
                ct
              );
          }
      }
    if (Et)
      return ct = ct(C), Et = st === "" ? "." + G(C, 0) : st, J(ct) ? (at = "", Et != null && (at = Et.replace(A, "$&/") + "/"), D(ct, Z, at, "", function(Qn) {
        return Qn;
      })) : ct != null && (z(ct) && (ct = k(
        ct,
        at + (ct.key == null || C && C.key === ct.key ? "" : ("" + ct.key).replace(
          A,
          "$&/"
        ) + "/") + Et
      )), Z.push(ct)), 1;
    Et = 0;
    var $t = st === "" ? "." : st + ":";
    if (J(C))
      for (var ht = 0; ht < C.length; ht++)
        st = C[ht], ut = $t + G(st, ht), Et += D(
          st,
          Z,
          at,
          ut,
          ct
        );
    else if (ht = S(C), typeof ht == "function")
      for (C = ht.call(C), ht = 0; !(st = C.next()).done; )
        st = st.value, ut = $t + G(st, ht++), Et += D(
          st,
          Z,
          at,
          ut,
          ct
        );
    else if (ut === "object") {
      if (typeof C.then == "function")
        return D(
          W(C),
          Z,
          at,
          st,
          ct
        );
      throw Z = String(C), Error(
        "Objects are not valid as a React child (found: " + (Z === "[object Object]" ? "object with keys {" + Object.keys(C).join(", ") + "}" : Z) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return Et;
  }
  function Q(C, Z, at) {
    if (C == null) return C;
    var st = [], ct = 0;
    return D(C, st, "", "", function(ut) {
      return Z.call(at, ut, ct++);
    }), st;
  }
  function I(C) {
    if (C._status === -1) {
      var Z = C._result;
      Z = Z(), Z.then(
        function(at) {
          (C._status === 0 || C._status === -1) && (C._status = 1, C._result = at);
        },
        function(at) {
          (C._status === 0 || C._status === -1) && (C._status = 2, C._result = at);
        }
      ), C._status === -1 && (C._status = 0, C._result = Z);
    }
    if (C._status === 1) return C._result.default;
    throw C._result;
  }
  var Y = typeof reportError == "function" ? reportError : function(C) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var Z = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof C == "object" && C !== null && typeof C.message == "string" ? String(C.message) : String(C),
        error: C
      });
      if (!window.dispatchEvent(Z)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", C);
      return;
    }
    console.error(C);
  }, K = {
    map: Q,
    forEach: function(C, Z, at) {
      Q(
        C,
        function() {
          Z.apply(this, arguments);
        },
        at
      );
    },
    count: function(C) {
      var Z = 0;
      return Q(C, function() {
        Z++;
      }), Z;
    },
    toArray: function(C) {
      return Q(C, function(Z) {
        return Z;
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
  return pt.Activity = y, pt.Children = K, pt.Component = j, pt.Fragment = r, pt.Profiler = s, pt.PureComponent = U, pt.StrictMode = o, pt.Suspense = p, pt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = g, pt.__COMPILER_RUNTIME = {
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
  }, pt.cloneElement = function(C, Z, at) {
    if (C == null)
      throw Error(
        "The argument must be a React element, but you passed " + C + "."
      );
    var st = E({}, C.props), ct = C.key;
    if (Z != null)
      for (ut in Z.key !== void 0 && (ct = "" + Z.key), Z)
        !h.call(Z, ut) || ut === "key" || ut === "__self" || ut === "__source" || ut === "ref" && Z.ref === void 0 || (st[ut] = Z[ut]);
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
  }, pt.createElement = function(C, Z, at) {
    var st, ct = {}, ut = null;
    if (Z != null)
      for (st in Z.key !== void 0 && (ut = "" + Z.key), Z)
        h.call(Z, st) && st !== "key" && st !== "__self" && st !== "__source" && (ct[st] = Z[st]);
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
  }, pt.memo = function(C, Z) {
    return {
      $$typeof: v,
      type: C,
      compare: Z === void 0 ? null : Z
    };
  }, pt.startTransition = function(C) {
    var Z = g.T, at = {};
    g.T = at;
    try {
      var st = C(), ct = g.S;
      ct !== null && ct(at, st), typeof st == "object" && st !== null && typeof st.then == "function" && st.then(B, Y);
    } catch (ut) {
      Y(ut);
    } finally {
      Z !== null && at.types !== null && (Z.types = at.types), g.T = Z;
    }
  }, pt.unstable_useCacheRefresh = function() {
    return g.H.useCacheRefresh();
  }, pt.use = function(C) {
    return g.H.use(C);
  }, pt.useActionState = function(C, Z, at) {
    return g.H.useActionState(C, Z, at);
  }, pt.useCallback = function(C, Z) {
    return g.H.useCallback(C, Z);
  }, pt.useContext = function(C) {
    return g.H.useContext(C);
  }, pt.useDebugValue = function() {
  }, pt.useDeferredValue = function(C, Z) {
    return g.H.useDeferredValue(C, Z);
  }, pt.useEffect = function(C, Z) {
    return g.H.useEffect(C, Z);
  }, pt.useEffectEvent = function(C) {
    return g.H.useEffectEvent(C);
  }, pt.useId = function() {
    return g.H.useId();
  }, pt.useImperativeHandle = function(C, Z, at) {
    return g.H.useImperativeHandle(C, Z, at);
  }, pt.useInsertionEffect = function(C, Z) {
    return g.H.useInsertionEffect(C, Z);
  }, pt.useLayoutEffect = function(C, Z) {
    return g.H.useLayoutEffect(C, Z);
  }, pt.useMemo = function(C, Z) {
    return g.H.useMemo(C, Z);
  }, pt.useOptimistic = function(C, Z) {
    return g.H.useOptimistic(C, Z);
  }, pt.useReducer = function(C, Z, at) {
    return g.H.useReducer(C, Z, at);
  }, pt.useRef = function(C) {
    return g.H.useRef(C);
  }, pt.useState = function(C) {
    return g.H.useState(C);
  }, pt.useSyncExternalStore = function(C, Z, at) {
    return g.H.useSyncExternalStore(
      C,
      Z,
      at
    );
  }, pt.useTransition = function() {
    return g.H.useTransition();
  }, pt.version = "19.2.8", pt;
}
var ef;
function s0() {
  return ef || (ef = 1, ls.exports = o0()), ls.exports;
}
var X = s0();
const um = /* @__PURE__ */ Qs(X), c0 = /* @__PURE__ */ Gs({
  __proto__: null,
  default: um
}, [X]);
//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
const u0 = um ?? c0;
function Lt(n, a) {
  return X.useEffect(om(n), a);
}
function jl(n, a) {
  return X.useLayoutEffect(om(n), a);
}
const d0 = /* @__PURE__ */ Gs({
  __proto__: null,
  default: u0,
  useEffect: Lt,
  useLayoutEffect: jl
}, [X]);
var is = { exports: {} }, _l = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var nf;
function f0() {
  if (nf) return _l;
  nf = 1;
  var n = Symbol.for("react.transitional.element"), a = Symbol.for("react.fragment");
  function r(o, s, u) {
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
  return _l.Fragment = a, _l.jsx = r, _l.jsxs = r, _l;
}
var af;
function m0() {
  return af || (af = 1, is.exports = f0()), is.exports;
}
var et = m0();
const p0 = /* @__PURE__ */ Qs(et), Zx = /* @__PURE__ */ Gs({
  __proto__: null,
  default: p0
}, [et]);
var rs = { exports: {} }, os = { exports: {} };
const h0 = /* @__PURE__ */ r0(d0);
var ss = { exports: {} }, cs = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var lf;
function g0() {
  return lf || (lf = 1, (function(n) {
    function a(D, Q) {
      var I = D.length;
      D.push(Q);
      t: for (; 0 < I; ) {
        var Y = I - 1 >>> 1, K = D[Y];
        if (0 < s(K, Q))
          D[Y] = Q, D[I] = K, I = Y;
        else break t;
      }
    }
    function r(D) {
      return D.length === 0 ? null : D[0];
    }
    function o(D) {
      if (D.length === 0) return null;
      var Q = D[0], I = D.pop();
      if (I !== Q) {
        D[0] = I;
        t: for (var Y = 0, K = D.length, C = K >>> 1; Y < C; ) {
          var Z = 2 * (Y + 1) - 1, at = D[Z], st = Z + 1, ct = D[st];
          if (0 > s(at, I))
            st < K && 0 > s(ct, at) ? (D[Y] = ct, D[st] = I, Y = st) : (D[Y] = at, D[Z] = I, Y = Z);
          else if (st < K && 0 > s(ct, I))
            D[Y] = ct, D[st] = I, Y = st;
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
    var p = [], v = [], x = 1, y = null, b = 3, S = !1, N = !1, E = !1, T = !1, j = typeof setTimeout == "function" ? setTimeout : null, R = typeof clearTimeout == "function" ? clearTimeout : null, U = typeof setImmediate < "u" ? setImmediate : null;
    function F(D) {
      for (var Q = r(v); Q !== null; ) {
        if (Q.callback === null) o(v);
        else if (Q.startTime <= D)
          o(v), Q.sortIndex = Q.expirationTime, a(p, Q);
        else break;
        Q = r(v);
      }
    }
    function J(D) {
      if (E = !1, F(D), !N)
        if (r(p) !== null)
          N = !0, B || (B = !0, O());
        else {
          var Q = r(v);
          Q !== null && W(J, Q.startTime - D);
        }
    }
    var B = !1, g = -1, h = 5, _ = -1;
    function k() {
      return T ? !0 : !(n.unstable_now() - _ < h);
    }
    function z() {
      if (T = !1, B) {
        var D = n.unstable_now();
        _ = D;
        var Q = !0;
        try {
          t: {
            N = !1, E && (E = !1, R(g), g = -1), S = !0;
            var I = b;
            try {
              e: {
                for (F(D), y = r(p); y !== null && !(y.expirationTime > D && k()); ) {
                  var Y = y.callback;
                  if (typeof Y == "function") {
                    y.callback = null, b = y.priorityLevel;
                    var K = Y(
                      y.expirationTime <= D
                    );
                    if (D = n.unstable_now(), typeof K == "function") {
                      y.callback = K, F(D), Q = !0;
                      break e;
                    }
                    y === r(p) && o(p), F(D);
                  } else o(p);
                  y = r(p);
                }
                if (y !== null) Q = !0;
                else {
                  var C = r(v);
                  C !== null && W(
                    J,
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
      var A = new MessageChannel(), G = A.port2;
      A.port1.onmessage = z, O = function() {
        G.postMessage(null);
      };
    } else
      O = function() {
        j(z, 0);
      };
    function W(D, Q) {
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
      T = !0;
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
      var Y = n.unstable_now();
      switch (typeof I == "object" && I !== null ? (I = I.delay, I = typeof I == "number" && 0 < I ? Y + I : Y) : I = Y, D) {
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
      }, I > Y ? (D.sortIndex = I, a(v, D), r(p) === null && D === r(v) && (E ? (R(g), g = -1) : E = !0, W(J, I - Y))) : (D.sortIndex = K, a(p, D), N || S || (N = !0, B || (B = !0, O()))), D;
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
      !S && !B || (S = !1, y = null, N = !1, B = !1, r(p) !== null && (N = !0, B = !0, O()));
    };
  })(cs)), cs;
}
var rf;
function dm() {
  return rf || (rf = 1, ss.exports = g0()), ss.exports;
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
var of;
function b0() {
  return of || (of = 1, (function(n) {
    n.exports = function(a) {
      function r(t, e, l, i) {
        return new Zp(t, e, l, i);
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
        for (var l = t, i = e; ; ) {
          var c = l.return;
          if (c === null) break;
          var d = c.alternate;
          if (d === null) {
            if (i = c.return, i !== null) {
              l = i;
              continue;
            }
            break;
          }
          if (c.child === d.child) {
            for (d = c.child; d; ) {
              if (d === l) return m(c), t;
              if (d === i) return m(c), e;
              d = d.sibling;
            }
            throw Error(s(188));
          }
          if (l.return !== i.return) l = c, i = d;
          else {
            for (var w = !1, M = c.child; M; ) {
              if (M === l) {
                w = !0, l = c, i = d;
                break;
              }
              if (M === i) {
                w = !0, i = c, l = d;
                break;
              }
              M = M.sibling;
            }
            if (!w) {
              for (M = d.child; M; ) {
                if (M === l) {
                  w = !0, l = d, i = c;
                  break;
                }
                if (M === i) {
                  w = !0, i = d, l = c;
                  break;
                }
                M = M.sibling;
              }
              if (!w) throw Error(s(189));
            }
          }
          if (l.alternate !== i) throw Error(s(190));
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
        return t === null || typeof t != "object" ? null : (t = pd && t[pd] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function y(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === Ip ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case xa:
            return "Fragment";
          case So:
            return "Profiler";
          case fd:
            return "StrictMode";
          case zo:
            return "Suspense";
          case No:
            return "SuspenseList";
          case Co:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case ya:
              return "Portal";
            case Sn:
              return t.displayName || "Context";
            case md:
              return (t._context.displayName || "Context") + ".Consumer";
            case Eo:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case To:
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
        0 > ka || (t.current = Do[ka], Do[ka] = null, ka--);
      }
      function N(t, e) {
        ka++, Do[ka] = t.current, t.current = e;
      }
      function E(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (zg(t) / Ng | 0) | 0;
      }
      function T(t) {
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
        var i = t.pendingLanes;
        if (i === 0) return 0;
        var c = 0, d = t.suspendedLanes, w = t.pingedLanes;
        t = t.warmLanes;
        var M = i & 134217727;
        return M !== 0 ? (i = M & ~d, i !== 0 ? c = T(i) : (w &= M, w !== 0 ? c = T(w) : l || (l = M & ~t, l !== 0 && (c = T(l))))) : (M = i & ~d, M !== 0 ? c = T(M) : w !== 0 ? c = T(w) : l || (l = i & ~t, l !== 0 && (c = T(l)))), c === 0 ? 0 : e !== 0 && e !== c && (e & d) === 0 && (d = c & -c, l = e & -e, d >= l || d === 32 && (l & 4194048) !== 0) ? e : c;
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
        var t = vi;
        return vi <<= 1, (vi & 62914560) === 0 && (vi = 4194304), t;
      }
      function J(t) {
        for (var e = [], l = 0; 31 > l; l++) e.push(t);
        return e;
      }
      function B(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function g(t, e, l, i, c, d) {
        var w = t.pendingLanes;
        t.pendingLanes = l, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= l, t.entangledLanes &= l, t.errorRecoveryDisabledLanes &= l, t.shellSuspendCounter = 0;
        var M = t.entanglements, V = t.expirationTimes, $ = t.hiddenUpdates;
        for (l = w & ~l; 0 < l; ) {
          var nt = 31 - _e(l), P = 1 << nt;
          M[nt] = 0, V[nt] = -1;
          var lt = $[nt];
          if (lt !== null)
            for ($[nt] = null, nt = 0; nt < lt.length; nt++) {
              var gt = lt[nt];
              gt !== null && (gt.lane &= -536870913);
            }
          l &= ~P;
        }
        i !== 0 && h(t, i, 0), d !== 0 && c === 0 && t.tag !== 0 && (t.suspendedLanes |= d & ~(w & ~e));
      }
      function h(t, e, l) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var i = 31 - _e(e);
        t.entangledLanes |= e, t.entanglements[i] = t.entanglements[i] | 1073741824 | l & 261930;
      }
      function _(t, e) {
        var l = t.entangledLanes |= e;
        for (t = t.entanglements; l; ) {
          var i = 31 - _e(l), c = 1 << i;
          c & e | t[i] & e && (t[i] |= e), l &= ~c;
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
      function A(t) {
        if (typeof jg == "function" && Og(t), ke && typeof ke.setStrictMode == "function")
          try {
            ke.setStrictMode(cl, t);
          } catch {
          }
      }
      function G(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function W(t) {
        if (Uo === void 0)
          try {
            throw Error();
          } catch (l) {
            var e = l.stack.trim().match(/\n( *(at )?)/);
            Uo = e && e[1] || "", Gd = -1 < l.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < l.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + Uo + t + Gd;
      }
      function D(t, e) {
        if (!t || qo) return "";
        qo = !0;
        var l = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var i = {
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
          var d = i.DetermineComponentFrameRoot(), w = d[0], M = d[1];
          if (w && M) {
            var V = w.split(`
`), $ = M.split(`
`);
            for (c = i = 0; i < V.length && !V[i].includes("DetermineComponentFrameRoot"); )
              i++;
            for (; c < $.length && !$[c].includes(
              "DetermineComponentFrameRoot"
            ); )
              c++;
            if (i === V.length || c === $.length)
              for (i = V.length - 1, c = $.length - 1; 1 <= i && 0 <= c && V[i] !== $[c]; )
                c--;
            for (; 1 <= i && 0 <= c; i--, c--)
              if (V[i] !== $[c]) {
                if (i !== 1 || c !== 1)
                  do
                    if (i--, c--, 0 > c || V[i] !== $[c]) {
                      var nt = `
` + V[i].replace(" at new ", " at ");
                      return t.displayName && nt.includes("<anonymous>") && (nt = nt.replace("<anonymous>", t.displayName)), nt;
                    }
                  while (1 <= i && 0 <= c);
                break;
              }
          }
        } finally {
          qo = !1, Error.prepareStackTrace = l;
        }
        return (l = t ? t.displayName || t.name : "") ? W(l) : "";
      }
      function Q(t, e) {
        switch (t.tag) {
          case 26:
          case 27:
          case 5:
            return W(t.type);
          case 16:
            return W("Lazy");
          case 13:
            return t.child !== e && e !== null ? W("Suspense Fallback") : W("Suspense");
          case 19:
            return W("SuspenseList");
          case 0:
          case 15:
            return D(t.type, !1);
          case 11:
            return D(t.type.render, !1);
          case 1:
            return D(t.type, !0);
          case 31:
            return W("Activity");
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
        } catch (i) {
          return `
Error generating stack: ` + i.message + `
` + i.stack;
        }
      }
      function Y(t, e) {
        if (typeof t == "object" && t !== null) {
          var l = Yd.get(t);
          return l !== void 0 ? l : (e = {
            value: t,
            source: e,
            stack: I(e)
          }, Yd.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: I(e)
        };
      }
      function K(t, e) {
        Ea[za++] = ul, Ea[za++] = xi, xi = t, ul = e;
      }
      function C(t, e, l) {
        Ce[Me++] = Ze, Ce[Me++] = Je, Ce[Me++] = zn, zn = t;
        var i = Ze;
        t = Je;
        var c = 32 - _e(i) - 1;
        i &= ~(1 << c), l += 1;
        var d = 32 - _e(e) + c;
        if (30 < d) {
          var w = c - c % 5;
          d = (i & (1 << w) - 1).toString(32), i >>= w, c -= w, Ze = 1 << 32 - _e(e) + c | l << c | i, Je = d + t;
        } else
          Ze = 1 << d | l << c | i, Je = t;
      }
      function Z(t) {
        t.return !== null && (K(t, 1), C(t, 1, 0));
      }
      function at(t) {
        for (; t === xi; )
          xi = Ea[--za], Ea[za] = null, ul = Ea[--za], Ea[za] = null;
        for (; t === zn; )
          zn = Ce[--Me], Ce[Me] = null, Je = Ce[--Me], Ce[Me] = null, Ze = Ce[--Me], Ce[Me] = null;
      }
      function st(t, e) {
        Ce[Me++] = Ze, Ce[Me++] = Je, Ce[Me++] = zn, Ze = e.id, Je = e.overflow, zn = t;
      }
      function ct(t, e) {
        N(Nn, e), N(dl, t), N(ae, null), t = eh(e), S(ae), N(ae, t);
      }
      function ut() {
        S(ae), S(dl), S(Nn);
      }
      function Et(t) {
        t.memoizedState !== null && N(wi, t);
        var e = ae.current, l = nh(e, t.type);
        e !== l && (N(dl, t), N(ae, l));
      }
      function $t(t) {
        dl.current === t && (S(ae), S(dl)), wi.current === t && (S(wi), rn ? ta._currentValue = wa : ta._currentValue2 = wa);
      }
      function ht(t) {
        var e = Error(
          s(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Ka(Y(e, t)), Go;
      }
      function Qn(t, e) {
        if (!ue) throw Error(s(175));
        ng(
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
        if (Jt ? e !== 3 && e !== 27 && (e !== 5 || Nd(t.type) && !hi(t.type, t.memoizedProps)) && Rt && ht(t) : e !== 3 && (e !== 5 || Nd(t.type) && !hi(t.type, t.memoizedProps)) && Rt && ht(t), Kn(t), e === 13) {
          if (!ue) throw Error(s(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Rt = og(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          Rt = rg(t);
        } else
          Rt = Jt && e === 27 ? Xh(
            t.type,
            Rt
          ) : le ? zd(t.stateNode) : null;
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
      function Ka(t) {
        Tn === null ? Tn = [t] : Tn.push(t);
      }
      function bn(t, e, l) {
        rn ? (N(_i, e._currentValue), e._currentValue = l) : (N(_i, e._currentValue2), e._currentValue2 = l);
      }
      function Pe(t) {
        var e = _i.current;
        rn ? t._currentValue = e : t._currentValue2 = e, S(_i);
      }
      function xr(t, e, l) {
        for (; t !== null; ) {
          var i = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, i !== null && (i.childLanes |= e)) : i !== null && (i.childLanes & e) !== e && (i.childLanes |= e), t === l) break;
          t = t.return;
        }
      }
      function wr(t, e, l, i) {
        var c = t.child;
        for (c !== null && (c.return = t); c !== null; ) {
          var d = c.dependencies;
          if (d !== null) {
            var w = c.child;
            d = d.firstContext;
            t: for (; d !== null; ) {
              var M = d;
              d = c;
              for (var V = 0; V < e.length; V++)
                if (M.context === e[V]) {
                  d.lanes |= l, M = d.alternate, M !== null && (M.lanes |= l), xr(
                    d.return,
                    l,
                    t
                  ), i || (w = null);
                  break t;
                }
              d = M.next;
            }
          } else if (c.tag === 18) {
            if (w = c.return, w === null) throw Error(s(341));
            w.lanes |= l, d = w.alternate, d !== null && (d.lanes |= l), xr(w, l, t), w = null;
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
      function ma(t, e, l, i) {
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
              var M = c.type;
              Se(c.pendingProps.value, w.value) || (t !== null ? t.push(M) : t = [M]);
            }
          } else if (c === wi.current) {
            if (w = c.alternate, w === null) throw Error(s(387));
            w.memoizedState.memoizedState !== c.memoizedState.memoizedState && (t !== null ? t.push(ta) : t = [ta]);
          }
          c = c.return;
        }
        t !== null && wr(
          e,
          t,
          l,
          i
        ), e.flags |= 262144;
      }
      function Ul(t) {
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
        return tc(ea, t);
      }
      function ql(t, e) {
        return ea === null && Xn(t), tc(t, e);
      }
      function tc(t, e) {
        var l = rn ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: l, next: null }, sn === null) {
          if (t === null) throw Error(s(308));
          sn = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else sn = sn.next = e;
        return l;
      }
      function _r() {
        return {
          controller: new Dg(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Xa(t) {
        t.refCount--, t.refCount === 0 && Bg(Hg, function() {
          t.controller.abort();
        });
      }
      function Gl() {
      }
      function Qe(t) {
        t !== Na && t.next === null && (Na === null ? ki = Na = t : Na = Na.next = t), Si = !0, Yo || (Yo = !0, kp());
      }
      function pa(t, e) {
        if (!Lo && Si) {
          Lo = !0;
          do
            for (var l = !1, i = ki; i !== null; ) {
              if (t !== 0) {
                var c = i.pendingLanes;
                if (c === 0) var d = 0;
                else {
                  var w = i.suspendedLanes, M = i.pingedLanes;
                  d = (1 << 31 - _e(42 | t) + 1) - 1, d &= c & ~(w & ~M), d = d & 201326741 ? d & 201326741 | 1 : d ? d | 2 : 0;
                }
                d !== 0 && (l = !0, ic(i, d));
              } else
                d = kt, d = j(
                  i,
                  i === At ? d : 0,
                  i.cancelPendingCommit !== null || i.timeoutHandle !== Pn
                ), (d & 3) === 0 || R(i, d) || (l = !0, ic(i, d));
              i = i.next;
            }
          while (l);
          Lo = !1;
        }
      }
      function ec() {
        nc();
      }
      function nc() {
        Si = Yo = !1;
        var t = 0;
        na !== 0 && dh() && (t = na);
        for (var e = ge(), l = null, i = ki; i !== null; ) {
          var c = i.next, d = ac(i, e);
          d === 0 ? (i.next = null, l === null ? ki = c : l.next = c, c === null && (Na = l)) : (l = i, (t !== 0 || (d & 3) !== 0) && (Si = !0)), i = c;
        }
        Wt !== 0 && Wt !== 5 || pa(t), na !== 0 && (na = 0);
      }
      function ac(t, e) {
        for (var l = t.suspendedLanes, i = t.pingedLanes, c = t.expirationTimes, d = t.pendingLanes & -62914561; 0 < d; ) {
          var w = 31 - _e(d), M = 1 << w, V = c[w];
          V === -1 ? ((M & l) === 0 || (M & i) !== 0) && (c[w] = U(M, e)) : V <= e && (t.expiredLanes |= M), d &= ~M;
        }
        if (e = At, l = kt, l = j(
          t,
          t === e ? l : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Pn
        ), i = t.callbackNode, l === 0 || t === e && (Ct === 2 || Ct === 9) || t.cancelPendingCommit !== null)
          return i !== null && i !== null && Bo(i), t.callbackNode = null, t.callbackPriority = 0;
        if ((l & 3) === 0 || R(t, l)) {
          if (e = l & -l, e === t.callbackPriority) return e;
          switch (i !== null && Bo(i), O(l)) {
            case 2:
            case 8:
              l = Mg;
              break;
            case 32:
              l = Ho;
              break;
            case 268435456:
              l = Ag;
              break;
            default:
              l = Ho;
          }
          return i = lc.bind(null, t), l = yi(l, i), t.callbackPriority = e, t.callbackNode = l, e;
        }
        return i !== null && i !== null && Bo(i), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function lc(t, e) {
        if (Wt !== 0 && Wt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var l = t.callbackNode;
        if (il() && t.callbackNode !== l)
          return null;
        var i = kt;
        return i = j(
          t,
          t === At ? i : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Pn
        ), i === 0 ? null : (Yu(t, i, e), ac(t, ge()), t.callbackNode != null && t.callbackNode === l ? lc.bind(null, t) : null);
      }
      function ic(t, e) {
        if (il()) return null;
        Yu(t, e, !0);
      }
      function kp() {
        vh ? yh(function() {
          (wt & 6) !== 0 ? yi(
            Ud,
            ec
          ) : nc();
        }) : yi(
          Ud,
          ec
        );
      }
      function kr() {
        if (na === 0) {
          var t = Ta;
          t === 0 && (t = gi, gi <<= 1, (gi & 261888) === 0 && (gi = 256)), na = t;
        }
        return na;
      }
      function Sp(t, e) {
        if (fl === null) {
          var l = fl = [];
          Vo = 0, Ta = kr(), Ca = {
            status: "pending",
            value: void 0,
            then: function(i) {
              l.push(i);
            }
          };
        }
        return Vo++, e.then(rc, rc), e;
      }
      function rc() {
        if (--Vo === 0 && fl !== null) {
          Ca !== null && (Ca.status = "fulfilled");
          var t = fl;
          fl = null, Ta = 0, Ca = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function Ep(t, e) {
        var l = [], i = {
          status: "pending",
          value: null,
          reason: null,
          then: function(c) {
            l.push(c);
          }
        };
        return t.then(
          function() {
            i.status = "fulfilled", i.value = e;
            for (var c = 0; c < l.length; c++) (0, l[c])(e);
          },
          function(c) {
            for (i.status = "rejected", i.reason = c, c = 0; c < l.length; c++)
              (0, l[c])(void 0);
          }
        ), i;
      }
      function Sr() {
        var t = aa.current;
        return t !== null ? t : At.pooledCache;
      }
      function Yl(t, e) {
        e === null ? N(aa, aa.current) : N(aa, e.pool);
      }
      function oc() {
        var t = Sr();
        return t === null ? null : {
          parent: rn ? Dt._currentValue : Dt._currentValue2,
          pool: t
        };
      }
      function Ll(t, e) {
        if (Se(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var l = Object.keys(t), i = Object.keys(e);
        if (l.length !== i.length) return !1;
        for (i = 0; i < l.length; i++) {
          var c = l[i];
          if (!Rg.call(e, c) || !Se(t[c], e[c]))
            return !1;
        }
        return !0;
      }
      function sc(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function cc(t, e, l) {
        switch (l = t[l], l === void 0 ? t.push(e) : l !== e && (e.then(Gl, Gl), e = l), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, dc(t), t;
          default:
            if (typeof e.status == "string") e.then(Gl, Gl);
            else {
              if (t = At, t !== null && 100 < t.shellSuspendCounter)
                throw Error(s(482));
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
                throw t = e.reason, dc(t), t;
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
      function uc() {
        if (la === null) throw Error(s(459));
        var t = la;
        return la = null, t;
      }
      function dc(t) {
        if (t === Ma || t === Ei)
          throw Error(s(483));
      }
      function Vl(t) {
        var e = ml;
        return ml += 1, Aa === null && (Aa = []), cc(Aa, t, e);
      }
      function Za(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function Ql(t, e) {
        throw e.$$typeof === Fp ? Error(s(525)) : (t = Object.prototype.toString.call(e), Error(
          s(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function fc(t) {
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
        function i(q) {
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
        function M(q, H, L, tt) {
          return H === null || H.tag !== 6 ? (H = xo(L, q.mode, tt), H.return = q, H) : (H = c(H, L), H.return = q, H);
        }
        function V(q, H, L, tt) {
          var ft = L.type;
          return ft === xa ? nt(
            q,
            H,
            L.props.children,
            tt,
            L.key
          ) : H !== null && (H.elementType === ft || typeof ft == "object" && ft !== null && ft.$$typeof === En && Zn(ft) === H.type) ? (H = c(H, L.props), Za(H, L), H.return = q, H) : (H = fi(
            L.type,
            L.key,
            L.props,
            null,
            q.mode,
            tt
          ), Za(H, L), H.return = q, H);
        }
        function $(q, H, L, tt) {
          return H === null || H.tag !== 4 || H.stateNode.containerInfo !== L.containerInfo || H.stateNode.implementation !== L.implementation ? (H = wo(L, q.mode, tt), H.return = q, H) : (H = c(H, L.children || []), H.return = q, H);
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
            return H = xo(
              "" + H,
              q.mode,
              L
            ), H.return = q, H;
          if (typeof H == "object" && H !== null) {
            switch (H.$$typeof) {
              case mi:
                return L = fi(
                  H.type,
                  H.key,
                  H.props,
                  null,
                  q.mode,
                  L
                ), Za(L, H), L.return = q, L;
              case ya:
                return H = wo(
                  H,
                  q.mode,
                  L
                ), H.return = q, H;
              case En:
                return H = Zn(H), P(q, H, L);
            }
            if (pi(H) || x(H))
              return H = In(
                H,
                q.mode,
                L,
                null
              ), H.return = q, H;
            if (typeof H.then == "function")
              return P(q, Vl(H), L);
            if (H.$$typeof === Sn)
              return P(
                q,
                ql(q, H),
                L
              );
            Ql(q, H);
          }
          return null;
        }
        function lt(q, H, L, tt) {
          var ft = H !== null ? H.key : null;
          if (typeof L == "string" && L !== "" || typeof L == "number" || typeof L == "bigint")
            return ft !== null ? null : M(q, H, "" + L, tt);
          if (typeof L == "object" && L !== null) {
            switch (L.$$typeof) {
              case mi:
                return L.key === ft ? V(q, H, L, tt) : null;
              case ya:
                return L.key === ft ? $(q, H, L, tt) : null;
              case En:
                return L = Zn(L), lt(q, H, L, tt);
            }
            if (pi(L) || x(L))
              return ft !== null ? null : nt(q, H, L, tt, null);
            if (typeof L.then == "function")
              return lt(
                q,
                H,
                Vl(L),
                tt
              );
            if (L.$$typeof === Sn)
              return lt(
                q,
                H,
                ql(q, L),
                tt
              );
            Ql(q, L);
          }
          return null;
        }
        function gt(q, H, L, tt, ft) {
          if (typeof tt == "string" && tt !== "" || typeof tt == "number" || typeof tt == "bigint")
            return q = q.get(L) || null, M(H, q, "" + tt, ft);
          if (typeof tt == "object" && tt !== null) {
            switch (tt.$$typeof) {
              case mi:
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
            if (pi(tt) || x(tt))
              return q = q.get(L) || null, nt(H, q, tt, ft, null);
            if (typeof tt.then == "function")
              return gt(
                q,
                H,
                L,
                Vl(tt),
                ft
              );
            if (tt.$$typeof === Sn)
              return gt(
                q,
                H,
                L,
                ql(H, tt),
                ft
              );
            Ql(H, tt);
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
          for (mt = i(mt); Nt < L.length; Nt++)
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
        function xl(q, H, L, tt) {
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
          for (mt = i(mt); !Tt.done; Nt++, Tt = L.next())
            Tt = gt(
              mt,
              q,
              Nt,
              Tt.value,
              tt
            ), Tt !== null && (t && Tt.alternate !== null && mt.delete(Tt.key === null ? Nt : Tt.key), H = d(Tt, H, Nt), Bt === null ? ft = Tt : Bt.sibling = Tt, Bt = Tt);
          return t && mt.forEach(function(Yg) {
            return e(q, Yg);
          }), St && K(q, Nt), ft;
        }
        function sa(q, H, L, tt) {
          if (typeof L == "object" && L !== null && L.type === xa && L.key === null && (L = L.props.children), typeof L == "object" && L !== null) {
            switch (L.$$typeof) {
              case mi:
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
                        ), tt = c(H, L.props), Za(tt, L), tt.return = q, q = tt;
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
                  ), tt.return = q, q = tt) : (tt = fi(
                    L.type,
                    L.key,
                    L.props,
                    null,
                    q.mode,
                    tt
                  ), Za(tt, L), tt.return = q, q = tt);
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
                  tt = wo(L, q.mode, tt), tt.return = q, q = tt;
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
            if (pi(L))
              return ie(
                q,
                H,
                L,
                tt
              );
            if (x(L)) {
              if (ft = x(L), typeof ft != "function")
                throw Error(s(150));
              return L = ft.call(L), xl(
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
                Vl(L),
                tt
              );
            if (L.$$typeof === Sn)
              return sa(
                q,
                H,
                ql(q, L),
                tt
              );
            Ql(q, L);
          }
          return typeof L == "string" && L !== "" || typeof L == "number" || typeof L == "bigint" ? (L = "" + L, H !== null && H.tag === 6 ? (l(q, H.sibling), tt = c(H, L), tt.return = q, q = tt) : (l(q, H), tt = xo(L, q.mode, tt), tt.return = q, q = tt), w(q)) : l(q, H);
        }
        return function(q, H, L, tt) {
          try {
            ml = 0;
            var ft = sa(
              q,
              H,
              L,
              tt
            );
            return Aa = null, ft;
          } catch (mt) {
            if (mt === Ma || mt === Ei) throw mt;
            var Bt = r(29, mt, null, q.mode);
            return Bt.lanes = tt, Bt.return = q, Bt;
          } finally {
          }
        };
      }
      function Kl() {
        for (var t = ja, e = Ko = ja = 0; e < t; ) {
          var l = je[e];
          je[e++] = null;
          var i = je[e];
          je[e++] = null;
          var c = je[e];
          je[e++] = null;
          var d = je[e];
          if (je[e++] = null, i !== null && c !== null) {
            var w = i.pending;
            w === null ? c.next = c : (c.next = w.next, w.next = c), i.pending = c;
          }
          d !== 0 && mc(l, c, d);
        }
      }
      function Xl(t, e, l, i) {
        je[ja++] = t, je[ja++] = e, je[ja++] = l, je[ja++] = i, Ko |= i, t.lanes |= i, t = t.alternate, t !== null && (t.lanes |= i);
      }
      function Er(t, e, l, i) {
        return Xl(t, e, l, i), Zl(t);
      }
      function Jn(t, e) {
        return Xl(t, null, null, e), Zl(t);
      }
      function mc(t, e, l) {
        t.lanes |= l;
        var i = t.alternate;
        i !== null && (i.lanes |= l);
        for (var c = !1, d = t.return; d !== null; )
          d.childLanes |= l, i = d.alternate, i !== null && (i.childLanes |= l), d.tag === 22 && (t = d.stateNode, t === null || t._visibility & 1 || (c = !0)), t = d, d = d.return;
        return t.tag === 3 ? (d = t.stateNode, c && e !== null && (c = 31 - _e(l), t = d.hiddenUpdates, i = t[c], i === null ? t[c] = [e] : i.push(e), e.lane = l | 536870912), d) : null;
      }
      function Zl(t) {
        if (50 < yl)
          throw yl = 0, as = null, Error(s(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function zr(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function Nr(t, e) {
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
        var i = t.updateQueue;
        if (i === null) return null;
        if (i = i.shared, (wt & 2) !== 0) {
          var c = i.pending;
          return c === null ? e.next = e : (e.next = c.next, c.next = e), i.pending = e, e = Zl(t), mc(t, null, l), e;
        }
        return Xl(t, i, e, l), Zl(t);
      }
      function Ja(t, e, l) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (l & 4194048) !== 0)) {
          var i = e.lanes;
          i &= t.pendingLanes, l |= i, e.lanes = l, _(t, l);
        }
      }
      function Tr(t, e) {
        var l = t.updateQueue, i = t.alternate;
        if (i !== null && (i = i.updateQueue, l === i)) {
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
            baseState: i.baseState,
            firstBaseUpdate: c,
            lastBaseUpdate: d,
            shared: i.shared,
            callbacks: i.callbacks
          }, t.updateQueue = l;
          return;
        }
        t = l.lastBaseUpdate, t === null ? l.firstBaseUpdate = e : t.next = e, l.lastBaseUpdate = e;
      }
      function Wa() {
        if (Xo) {
          var t = Ca;
          if (t !== null) throw t;
        }
      }
      function Fa(t, e, l, i) {
        Xo = !1;
        var c = t.updateQueue;
        Cn = !1;
        var d = c.firstBaseUpdate, w = c.lastBaseUpdate, M = c.shared.pending;
        if (M !== null) {
          c.shared.pending = null;
          var V = M, $ = V.next;
          V.next = null, w === null ? d = $ : w.next = $, w = V;
          var nt = t.alternate;
          nt !== null && (nt = nt.updateQueue, M = nt.lastBaseUpdate, M !== w && (M === null ? nt.firstBaseUpdate = $ : M.next = $, nt.lastBaseUpdate = V));
        }
        if (d !== null) {
          var P = c.baseState;
          w = 0, nt = $ = V = null, M = d;
          do {
            var lt = M.lane & -536870913, gt = lt !== M.lane;
            if (gt ? (kt & lt) === lt : (i & lt) === lt) {
              lt !== 0 && lt === Ta && (Xo = !0), nt !== null && (nt = nt.next = {
                lane: 0,
                tag: M.tag,
                payload: M.payload,
                callback: null,
                next: null
              });
              t: {
                var ie = t, xl = M;
                lt = e;
                var sa = l;
                switch (xl.tag) {
                  case 1:
                    if (ie = xl.payload, typeof ie == "function") {
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
                    if (ie = xl.payload, lt = typeof ie == "function" ? ie.call(sa, P, lt) : ie, lt == null) break t;
                    P = ko({}, P, lt);
                    break t;
                  case 2:
                    Cn = !0;
                }
              }
              lt = M.callback, lt !== null && (t.flags |= 64, gt && (t.flags |= 8192), gt = c.callbacks, gt === null ? c.callbacks = [lt] : gt.push(lt));
            } else
              gt = {
                lane: lt,
                tag: M.tag,
                payload: M.payload,
                callback: M.callback,
                next: null
              }, nt === null ? ($ = nt = gt, V = P) : nt = nt.next = gt, w |= lt;
            if (M = M.next, M === null) {
              if (M = c.shared.pending, M === null)
                break;
              gt = M, M = gt.next, gt.next = null, c.lastBaseUpdate = gt, c.shared.pending = null;
            }
          } while (!0);
          nt === null && (V = P), c.baseState = V, c.firstBaseUpdate = $, c.lastBaseUpdate = nt, d === null && (c.shared.lanes = 0), An |= w, t.lanes = w, t.memoizedState = P;
        }
      }
      function pc(t, e) {
        if (typeof t != "function")
          throw Error(s(191, t));
        t.call(e);
      }
      function hc(t, e) {
        var l = t.callbacks;
        if (l !== null)
          for (t.callbacks = null, t = 0; t < l.length; t++)
            pc(l[t], e);
      }
      function gc(t, e) {
        t = dn, N(Ni, t), N(Oa, e), dn = t | e.baseLanes;
      }
      function Cr() {
        N(Ni, dn), N(Oa, Oa.current);
      }
      function Mr() {
        dn = Ni.current, S(Oa), S(Ni);
      }
      function xn(t) {
        var e = t.alternate;
        N(Yt, Yt.current & 1), N(Ee, t), Oe === null && (e === null || Oa.current !== null || e.memoizedState !== null) && (Oe = t);
      }
      function Ar(t) {
        N(Yt, Yt.current), N(Ee, t), Oe === null && (Oe = t);
      }
      function bc(t) {
        t.tag === 22 ? (N(Yt, Yt.current), N(Ee, t), Oe === null && (Oe = t)) : wn();
      }
      function wn() {
        N(Yt, Yt.current), N(Ee, Ee.current);
      }
      function ye(t) {
        S(Ee), Oe === t && (Oe = null), S(Yt);
      }
      function Jl(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var l = e.memoizedState;
            if (l !== null && (l = l.dehydrated, l === null || jo(l) || Oo(l)))
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
      function jr(t, e) {
        if (e === null) return !1;
        for (var l = 0; l < e.length && l < t.length; l++)
          if (!Se(t[l], e[l])) return !1;
        return !0;
      }
      function Or(t, e, l, i, c, d) {
        return cn = d, vt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, dt.H = t === null || t.memoizedState === null ? Qd : Zo, ra = !1, d = l(i, c), ra = !1, Ra && (d = yc(
          e,
          l,
          i,
          c
        )), vc(t), d;
      }
      function vc(t) {
        dt.H = hl;
        var e = Mt !== null && Mt.next !== null;
        if (cn = 0, Vt = Mt = vt = null, Ti = !1, pl = 0, Da = null, e) throw Error(s(300));
        t === null || Qt || (t = t.dependencies, t !== null && Ul(t) && (Qt = !0));
      }
      function yc(t, e, l, i) {
        vt = t;
        var c = 0;
        do {
          if (Ra && (Da = null), pl = 0, Ra = !1, 25 <= c) throw Error(s(301));
          if (c += 1, Vt = Mt = null, t.updateQueue != null) {
            var d = t.updateQueue;
            d.lastEffect = null, d.events = null, d.stores = null, d.memoCache != null && (d.memoCache.index = 0);
          }
          dt.H = Kd, d = e(l, i);
        } while (Ra);
        return d;
      }
      function zp() {
        var t = dt.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? $a(e) : e, t = t.useState()[0], (Mt !== null ? Mt.memoizedState : null) !== t && (vt.flags |= 1024), e;
      }
      function Rr() {
        var t = Ci !== 0;
        return Ci = 0, t;
      }
      function Dr(t, e, l) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~l;
      }
      function Br(t) {
        if (Ti) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          Ti = !1;
        }
        cn = 0, Vt = Mt = vt = null, Ra = !1, pl = Ci = 0, Da = null;
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
      function Wl() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function $a(t) {
        var e = pl;
        return pl += 1, Da === null && (Da = []), t = cc(Da, t, e), e = vt, (Vt === null ? e.memoizedState : Vt.next) === null && (e = e.alternate, dt.H = e === null || e.memoizedState === null ? Qd : Zo), t;
      }
      function Fl(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return $a(t);
          if (t.$$typeof === Sn) return ee(t);
        }
        throw Error(s(438, String(t)));
      }
      function Hr(t) {
        var e = null, l = vt.updateQueue;
        if (l !== null && (e = l.memoCache), e == null) {
          var i = vt.alternate;
          i !== null && (i = i.updateQueue, i !== null && (i = i.memoCache, i != null && (e = {
            data: i.data.map(function(c) {
              return c.slice();
            }),
            index: 0
          })));
        }
        if (e == null && (e = { data: [], index: 0 }), l === null && (l = Wl(), vt.updateQueue = l), l.memoCache = e, l = e.data[e.index], l === void 0)
          for (l = e.data[e.index] = Array(t), i = 0; i < t; i++)
            l[i] = $p;
        return e.index++, l;
      }
      function tn(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function $l(t) {
        var e = Gt();
        return Ur(e, Mt, t);
      }
      function Ur(t, e, l) {
        var i = t.queue;
        if (i === null) throw Error(s(311));
        i.lastRenderedReducer = l;
        var c = t.baseQueue, d = i.pending;
        if (d !== null) {
          if (c !== null) {
            var w = c.next;
            c.next = d.next, d.next = w;
          }
          e.baseQueue = c = d, i.pending = null;
        }
        if (d = t.baseState, c === null) t.memoizedState = d;
        else {
          e = c.next;
          var M = w = null, V = null, $ = e, nt = !1;
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
                }, V === null ? (M = V = P, w = d) : V = V.next = P, vt.lanes |= lt, An |= lt;
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
              }, V === null ? (M = V = lt, w = d) : V = V.next = lt, vt.lanes |= P, An |= P;
            $ = $.next;
          } while ($ !== null && $ !== e);
          if (V === null ? w = d : V.next = M, !Se(d, t.memoizedState) && (Qt = !0, nt && (l = Ca, l !== null)))
            throw l;
          t.memoizedState = d, t.baseState = w, t.baseQueue = V, i.lastRenderedState = d;
        }
        return c === null && (i.lanes = 0), [t.memoizedState, i.dispatch];
      }
      function qr(t) {
        var e = Gt(), l = e.queue;
        if (l === null) throw Error(s(311));
        l.lastRenderedReducer = t;
        var i = l.dispatch, c = l.pending, d = e.memoizedState;
        if (c !== null) {
          l.pending = null;
          var w = c = c.next;
          do
            d = t(d, w.action), w = w.next;
          while (w !== c);
          Se(d, e.memoizedState) || (Qt = !0), e.memoizedState = d, e.baseQueue === null && (e.baseState = d), l.lastRenderedState = d;
        }
        return [d, i];
      }
      function xc(t, e, l) {
        var i = vt, c = Gt(), d = St;
        if (d) {
          if (l === void 0)
            throw Error(s(407));
          l = l();
        } else l = e();
        var w = !Se(
          (Mt || c).memoizedState,
          l
        );
        if (w && (c.memoizedState = l, Qt = !0), c = c.queue, Lr(kc.bind(null, i, c, t), [
          t
        ]), c.getSnapshot !== e || w || Vt !== null && Vt.memoizedState.tag & 1) {
          if (i.flags |= 2048, ha(
            9,
            { destroy: void 0 },
            _c.bind(
              null,
              i,
              c,
              l,
              e
            ),
            null
          ), At === null) throw Error(s(349));
          d || (cn & 127) !== 0 || wc(i, e, l);
        }
        return l;
      }
      function wc(t, e, l) {
        t.flags |= 16384, t = { getSnapshot: e, value: l }, e = vt.updateQueue, e === null ? (e = Wl(), vt.updateQueue = e, e.stores = [t]) : (l = e.stores, l === null ? e.stores = [t] : l.push(t));
      }
      function _c(t, e, l, i) {
        e.value = l, e.getSnapshot = i, Sc(e) && Ec(t);
      }
      function kc(t, e, l) {
        return l(function() {
          Sc(e) && Ec(t);
        });
      }
      function Sc(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var l = e();
          return !Se(t, l);
        } catch {
          return !0;
        }
      }
      function Ec(t) {
        var e = Jn(t, 2);
        e !== null && he(e, t, 2);
      }
      function Gr(t) {
        var e = fe();
        if (typeof t == "function") {
          var l = t;
          if (t = l(), ra) {
            A(!0);
            try {
              l();
            } finally {
              A(!1);
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
      function zc(t, e, l, i) {
        return t.baseState = l, Ur(
          t,
          Mt,
          typeof i == "function" ? i : tn
        );
      }
      function Np(t, e, l, i, c) {
        if (ti(t)) throw Error(s(485));
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
          dt.T !== null ? l(!0) : d.isTransition = !1, i(d), l = e.pending, l === null ? (d.next = e.pending = d, Nc(e, d)) : (d.next = l.next, e.pending = l.next = d);
        }
      }
      function Nc(t, e) {
        var l = e.action, i = e.payload, c = t.state;
        if (e.isTransition) {
          var d = dt.T, w = {};
          dt.T = w;
          try {
            var M = l(c, i), V = dt.S;
            V !== null && V(w, M), Tc(t, e, M);
          } catch ($) {
            Yr(t, e, $);
          } finally {
            d !== null && w.types !== null && (d.types = w.types), dt.T = d;
          }
        } else
          try {
            d = l(c, i), Tc(t, e, d);
          } catch ($) {
            Yr(t, e, $);
          }
      }
      function Tc(t, e, l) {
        l !== null && typeof l == "object" && typeof l.then == "function" ? l.then(
          function(i) {
            Cc(t, e, i);
          },
          function(i) {
            return Yr(t, e, i);
          }
        ) : Cc(t, e, l);
      }
      function Cc(t, e, l) {
        e.status = "fulfilled", e.value = l, Mc(e), t.state = l, e = t.pending, e !== null && (l = e.next, l === e ? t.pending = null : (l = l.next, e.next = l, Nc(t, l)));
      }
      function Yr(t, e, l) {
        var i = t.pending;
        if (t.pending = null, i !== null) {
          i = i.next;
          do
            e.status = "rejected", e.reason = l, Mc(e), e = e.next;
          while (e !== i);
        }
        t.action = null;
      }
      function Mc(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function Ac(t, e) {
        return e;
      }
      function jc(t, e) {
        if (St) {
          var l = At.formState;
          if (l !== null) {
            t: {
              var i = vt;
              if (St) {
                if (Rt) {
                  var c = Qh(
                    Rt,
                    Ae
                  );
                  if (c) {
                    Rt = zd(c), i = Kh(c);
                    break t;
                  }
                }
                ht(i);
              }
              i = !1;
            }
            i && (e = l[0]);
          }
        }
        l = fe(), l.memoizedState = l.baseState = e, i = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Ac,
          lastRenderedState: e
        }, l.queue = i, l = Fc.bind(
          null,
          vt,
          i
        ), i.dispatch = l, i = Gr(!1);
        var d = Xr.bind(
          null,
          vt,
          !1,
          i.queue
        );
        return i = fe(), c = {
          state: e,
          dispatch: null,
          action: t,
          pending: null
        }, i.queue = c, l = Np.bind(
          null,
          vt,
          c,
          d,
          l
        ), c.dispatch = l, i.memoizedState = t, [e, l, !1];
      }
      function Oc(t) {
        var e = Gt();
        return Rc(e, Mt, t);
      }
      function Rc(t, e, l) {
        if (e = Ur(
          t,
          e,
          Ac
        )[0], t = $l(tn)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var i = $a(e);
          } catch (w) {
            throw w === Ma ? Ei : w;
          }
        else i = e;
        e = Gt();
        var c = e.queue, d = c.dispatch;
        return l !== e.memoizedState && (vt.flags |= 2048, ha(
          9,
          { destroy: void 0 },
          Tp.bind(null, c, l),
          null
        )), [i, d, t];
      }
      function Tp(t, e) {
        t.action = e;
      }
      function Dc(t) {
        var e = Gt(), l = Mt;
        if (l !== null)
          return Rc(e, l, t);
        Gt(), e = e.memoizedState, l = Gt();
        var i = l.queue.dispatch;
        return l.memoizedState = t, [e, i, !1];
      }
      function ha(t, e, l, i) {
        return t = { tag: t, create: l, deps: i, inst: e, next: null }, e = vt.updateQueue, e === null && (e = Wl(), vt.updateQueue = e), l = e.lastEffect, l === null ? e.lastEffect = t.next = t : (i = l.next, l.next = t, t.next = i, e.lastEffect = t), t;
      }
      function Bc() {
        return Gt().memoizedState;
      }
      function Il(t, e, l, i) {
        var c = fe();
        vt.flags |= t, c.memoizedState = ha(
          1 | e,
          { destroy: void 0 },
          l,
          i === void 0 ? null : i
        );
      }
      function Pl(t, e, l, i) {
        var c = Gt();
        i = i === void 0 ? null : i;
        var d = c.memoizedState.inst;
        Mt !== null && i !== null && jr(i, Mt.memoizedState.deps) ? c.memoizedState = ha(e, d, l, i) : (vt.flags |= t, c.memoizedState = ha(
          1 | e,
          d,
          l,
          i
        ));
      }
      function Hc(t, e) {
        Il(8390656, 8, t, e);
      }
      function Lr(t, e) {
        Pl(2048, 8, t, e);
      }
      function Cp(t) {
        vt.flags |= 4;
        var e = vt.updateQueue;
        if (e === null)
          e = Wl(), vt.updateQueue = e, e.events = [t];
        else {
          var l = e.events;
          l === null ? e.events = [t] : l.push(t);
        }
      }
      function Uc(t) {
        var e = Gt().memoizedState;
        return Cp({ ref: e, nextImpl: t }), function() {
          if ((wt & 2) !== 0)
            throw Error(s(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function qc(t, e) {
        return Pl(4, 2, t, e);
      }
      function Gc(t, e) {
        return Pl(4, 4, t, e);
      }
      function Yc(t, e) {
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
      function Lc(t, e, l) {
        l = l != null ? l.concat([t]) : null, Pl(
          4,
          4,
          Yc.bind(null, e, t),
          l
        );
      }
      function Vr() {
      }
      function Vc(t, e) {
        var l = Gt();
        e = e === void 0 ? null : e;
        var i = l.memoizedState;
        return e !== null && jr(e, i[1]) ? i[0] : (l.memoizedState = [t, e], t);
      }
      function Qc(t, e) {
        var l = Gt();
        e = e === void 0 ? null : e;
        var i = l.memoizedState;
        if (e !== null && jr(e, i[1]))
          return i[0];
        if (i = t(), ra) {
          A(!0);
          try {
            t();
          } finally {
            A(!1);
          }
        }
        return l.memoizedState = [i, e], i;
      }
      function Qr(t, e, l) {
        return l === void 0 || (cn & 1073741824) !== 0 && (kt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = l, t = Gu(), vt.lanes |= t, An |= t, l);
      }
      function Kc(t, e, l, i) {
        return Se(l, e) ? l : Oa.current !== null ? (t = Qr(t, l, i), Se(t, e) || (Qt = !0), t) : (cn & 42) === 0 || (cn & 1073741824) !== 0 && (kt & 261930) === 0 ? (Qt = !0, t.memoizedState = l) : (t = Gu(), vt.lanes |= t, An |= t, e);
      }
      function Xc(t, e, l, i, c) {
        var d = on();
        It(
          d !== 0 && 8 > d ? d : 8
        );
        var w = dt.T, M = {};
        dt.T = M, Xr(t, !1, e, l);
        try {
          var V = c(), $ = dt.S;
          if ($ !== null && $(M, V), V !== null && typeof V == "object" && typeof V.then == "function") {
            var nt = Ep(
              V,
              i
            );
            Ia(
              t,
              e,
              nt,
              xe(t)
            );
          } else
            Ia(
              t,
              e,
              i,
              xe(t)
            );
        } catch (P) {
          Ia(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: P },
            xe()
          );
        } finally {
          It(d), w !== null && M.types !== null && (w.types = M.types), dt.T = w;
        }
      }
      function Zc(t) {
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
      function Kr() {
        return ee(ta);
      }
      function Jc() {
        return Gt().memoizedState;
      }
      function Wc() {
        return Gt().memoizedState;
      }
      function Mp(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var l = xe();
              t = vn(l);
              var i = yn(e, t, l);
              i !== null && (he(i, e, l), Ja(i, e, l)), e = { cache: _r() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function Ap(t, e, l) {
        var i = xe();
        l = {
          lane: i,
          revertLane: 0,
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, ti(t) ? $c(e, l) : (l = Er(t, e, l, i), l !== null && (he(l, t, i), Ic(l, e, i)));
      }
      function Fc(t, e, l) {
        var i = xe();
        Ia(t, e, l, i);
      }
      function Ia(t, e, l, i) {
        var c = {
          lane: i,
          revertLane: 0,
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (ti(t)) $c(e, c);
        else {
          var d = t.alternate;
          if (t.lanes === 0 && (d === null || d.lanes === 0) && (d = e.lastRenderedReducer, d !== null))
            try {
              var w = e.lastRenderedState, M = d(w, l);
              if (c.hasEagerState = !0, c.eagerState = M, Se(M, w))
                return Xl(t, e, c, 0), At === null && Kl(), !1;
            } catch {
            } finally {
            }
          if (l = Er(t, e, c, i), l !== null)
            return he(l, t, i), Ic(l, e, i), !0;
        }
        return !1;
      }
      function Xr(t, e, l, i) {
        if (i = {
          lane: 2,
          revertLane: kr(),
          gesture: null,
          action: i,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, ti(t)) {
          if (e) throw Error(s(479));
        } else
          e = Er(
            t,
            l,
            i,
            2
          ), e !== null && he(e, t, 2);
      }
      function ti(t) {
        var e = t.alternate;
        return t === vt || e !== null && e === vt;
      }
      function $c(t, e) {
        Ra = Ti = !0;
        var l = t.pending;
        l === null ? e.next = e : (e.next = l.next, l.next = e), t.pending = e;
      }
      function Ic(t, e, l) {
        if ((l & 4194048) !== 0) {
          var i = e.lanes;
          i &= t.pendingLanes, l |= i, e.lanes = l, _(t, l);
        }
      }
      function Zr(t, e, l, i) {
        e = t.memoizedState, l = l(i, e), l = l == null ? e : ko({}, e, l), t.memoizedState = l, t.lanes === 0 && (t.updateQueue.baseState = l);
      }
      function Pc(t, e, l, i, c, d, w) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(i, d, w) : e.prototype && e.prototype.isPureReactComponent ? !Ll(l, i) || !Ll(c, d) : !0;
      }
      function tu(t, e, l, i) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(l, i), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(l, i), e.state !== t && Jo.enqueueReplaceState(e, e.state, null);
      }
      function Wn(t, e) {
        var l = e;
        if ("ref" in e) {
          l = {};
          for (var i in e)
            i !== "ref" && (l[i] = e[i]);
        }
        if (t = t.defaultProps) {
          l === e && (l = ko({}, l));
          for (var c in t)
            l[c] === void 0 && (l[c] = t[c]);
        }
        return l;
      }
      function ei(t, e) {
        try {
          var l = t.onUncaughtError;
          l(e.value, { componentStack: e.stack });
        } catch (i) {
          setTimeout(function() {
            throw i;
          });
        }
      }
      function eu(t, e, l) {
        try {
          var i = t.onCaughtError;
          i(l.value, {
            componentStack: l.stack,
            errorBoundary: e.tag === 1 ? e.stateNode : null
          });
        } catch (c) {
          setTimeout(function() {
            throw c;
          });
        }
      }
      function Jr(t, e, l) {
        return l = vn(l), l.tag = 3, l.payload = { element: null }, l.callback = function() {
          ei(t, e);
        }, l;
      }
      function nu(t) {
        return t = vn(t), t.tag = 3, t;
      }
      function au(t, e, l, i) {
        var c = l.type.getDerivedStateFromError;
        if (typeof c == "function") {
          var d = i.value;
          t.payload = function() {
            return c(d);
          }, t.callback = function() {
            eu(e, l, i);
          };
        }
        var w = l.stateNode;
        w !== null && typeof w.componentDidCatch == "function" && (t.callback = function() {
          eu(e, l, i), typeof c != "function" && (jn === null ? jn = /* @__PURE__ */ new Set([this]) : jn.add(this));
          var M = i.stack;
          this.componentDidCatch(i.value, {
            componentStack: M !== null ? M : ""
          });
        });
      }
      function jp(t, e, l, i, c) {
        if (l.flags |= 32768, i !== null && typeof i == "object" && typeof i.then == "function") {
          if (e = l.alternate, e !== null && ma(
            e,
            l,
            c,
            !0
          ), l = Ee.current, l !== null) {
            switch (l.tag) {
              case 31:
              case 13:
                return Oe === null ? ui() : l.alternate === null && qt === 0 && (qt = 3), l.flags &= -257, l.flags |= 65536, l.lanes = c, i === zi ? l.flags |= 16384 : (e = l.updateQueue, e === null ? l.updateQueue = /* @__PURE__ */ new Set([i]) : e.add(i), vo(t, i, c)), !1;
              case 22:
                return l.flags |= 65536, i === zi ? l.flags |= 16384 : (e = l.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([i])
                }, l.updateQueue = e) : (l = e.retryQueue, l === null ? e.retryQueue = /* @__PURE__ */ new Set([i]) : l.add(i)), vo(t, i, c)), !1;
            }
            throw Error(s(435, l.tag));
          }
          return vo(t, i, c), ui(), !1;
        }
        if (St)
          return e = Ee.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = c, i !== Go && (t = Error(s(422), { cause: i }), Ka(
            Y(t, l)
          ))) : (i !== Go && (e = Error(s(423), {
            cause: i
          }), Ka(
            Y(e, l)
          )), t = t.current.alternate, t.flags |= 65536, c &= -c, t.lanes |= c, i = Y(i, l), c = Jr(
            t.stateNode,
            i,
            c
          ), Tr(t, c), qt !== 4 && (qt = 2)), !1;
        var d = Error(s(520), { cause: i });
        if (d = Y(d, l), bl === null ? bl = [d] : bl.push(d), qt !== 4 && (qt = 2), e === null) return !0;
        i = Y(i, l), l = e;
        do {
          switch (l.tag) {
            case 3:
              return l.flags |= 65536, t = c & -c, l.lanes |= t, t = Jr(l.stateNode, i, t), Tr(l, t), !1;
            case 1:
              if (e = l.type, d = l.stateNode, (l.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || d !== null && typeof d.componentDidCatch == "function" && (jn === null || !jn.has(
                d
              ))))
                return l.flags |= 65536, c &= -c, l.lanes |= c, c = nu(c), au(
                  c,
                  t,
                  l,
                  i
                ), Tr(l, c), !1;
          }
          l = l.return;
        } while (l !== null);
        return !1;
      }
      function ne(t, e, l, i) {
        e.child = t === null ? Vd(e, null, l, i) : ia(
          e,
          t.child,
          l,
          i
        );
      }
      function lu(t, e, l, i, c) {
        l = l.render;
        var d = e.ref;
        if ("ref" in i) {
          var w = {};
          for (var M in i)
            M !== "ref" && (w[M] = i[M]);
        } else w = i;
        return Xn(e), i = Or(
          t,
          e,
          l,
          w,
          d,
          c
        ), M = Rr(), t !== null && !Qt ? (Dr(t, e, c), en(t, e, c)) : (St && M && Z(e), e.flags |= 1, ne(t, e, i, c), e.child);
      }
      function iu(t, e, l, i, c) {
        if (t === null) {
          var d = l.type;
          return typeof d == "function" && !yo(d) && d.defaultProps === void 0 && l.compare === null ? (e.tag = 15, e.type = d, ru(
            t,
            e,
            d,
            i,
            c
          )) : (t = fi(
            l.type,
            null,
            i,
            e,
            e.mode,
            c
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (d = t.child, !eo(t, c)) {
          var w = d.memoizedProps;
          if (l = l.compare, l = l !== null ? l : Ll, l(w, i) && t.ref === e.ref)
            return en(
              t,
              e,
              c
            );
        }
        return e.flags |= 1, t = ln(d, i), t.ref = e.ref, t.return = e, e.child = t;
      }
      function ru(t, e, l, i, c) {
        if (t !== null) {
          var d = t.memoizedProps;
          if (Ll(d, i) && t.ref === e.ref)
            if (Qt = !1, e.pendingProps = i = d, eo(t, c))
              (t.flags & 131072) !== 0 && (Qt = !0);
            else
              return e.lanes = t.lanes, en(t, e, c);
        }
        return Wr(
          t,
          e,
          l,
          i,
          c
        );
      }
      function ou(t, e, l, i) {
        var c = i.children, d = t !== null ? t.memoizedState : null;
        if (t === null && e.stateNode === null && (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), i.mode === "hidden") {
          if ((e.flags & 128) !== 0) {
            if (d = d !== null ? d.baseLanes | l : l, t !== null) {
              for (i = e.child = t.child, c = 0; i !== null; )
                c = c | i.lanes | i.childLanes, i = i.sibling;
              i = c & ~d;
            } else i = 0, e.child = null;
            return su(
              t,
              e,
              d,
              l,
              i
            );
          }
          if ((l & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && Yl(
              e,
              d !== null ? d.cachePool : null
            ), d !== null ? gc(e, d) : Cr(), bc(e);
          else
            return i = e.lanes = 536870912, su(
              t,
              e,
              d !== null ? d.baseLanes | l : l,
              l,
              i
            );
        } else
          d !== null ? (Yl(e, d.cachePool), gc(e, d), wn(), e.memoizedState = null) : (t !== null && Yl(e, null), Cr(), wn());
        return ne(t, e, c, l), e.child;
      }
      function Pa(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function su(t, e, l, i, c) {
        var d = Sr();
        return d = d === null ? null : {
          parent: rn ? Dt._currentValue : Dt._currentValue2,
          pool: d
        }, e.memoizedState = {
          baseLanes: l,
          cachePool: d
        }, t !== null && Yl(e, null), Cr(), bc(e), t !== null && ma(t, e, i, !0), e.childLanes = c, null;
      }
      function ni(t, e) {
        return e = li(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function cu(t, e, l) {
        return ia(e, t.child, null, l), t = ni(
          e,
          e.pendingProps
        ), t.flags |= 2, ye(e), e.memoizedState = null, t;
      }
      function Op(t, e, l) {
        var i = e.pendingProps, c = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (St) {
            if (i.mode === "hidden")
              return t = ni(e, i), e.lanes = 536870912, Pa(null, t);
            if (Ar(e), (t = Rt) ? (t = tg(
              t,
              Ae
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: zn !== null ? { id: Ze, overflow: Je } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, l = rd(t), l.return = e, e.child = l, le = e, Rt = null)) : t = null, t === null) throw ht(e);
            return e.lanes = 536870912, null;
          }
          return ni(e, i);
        }
        var d = t.memoizedState;
        if (d !== null) {
          var w = d.dehydrated;
          if (Ar(e), c)
            if (e.flags & 256)
              e.flags &= -257, e = cu(
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
            if (i = At, i !== null && (w = k(i, l), w !== 0 && w !== d.retryLane))
              throw d.retryLane = w, Jn(t, w), he(i, t, w), Wo;
            ui(), e = cu(
              t,
              e,
              l
            );
          } else
            t = d.treeContext, ue && (Rt = Wh(w), le = e, St = !0, Tn = null, Ae = !1, t !== null && st(e, t)), e = ni(e, i), e.flags |= 4096;
          return e;
        }
        return t = ln(t.child, {
          mode: i.mode,
          children: i.children
        }), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function ai(t, e) {
        var l = e.ref;
        if (l === null)
          t !== null && t.ref !== null && (e.flags |= 4194816);
        else {
          if (typeof l != "function" && typeof l != "object")
            throw Error(s(284));
          (t === null || t.ref !== l) && (e.flags |= 4194816);
        }
      }
      function Wr(t, e, l, i, c) {
        return Xn(e), l = Or(
          t,
          e,
          l,
          i,
          void 0,
          c
        ), i = Rr(), t !== null && !Qt ? (Dr(t, e, c), en(t, e, c)) : (St && i && Z(e), e.flags |= 1, ne(t, e, l, c), e.child);
      }
      function uu(t, e, l, i, c, d) {
        return Xn(e), e.updateQueue = null, l = yc(
          e,
          i,
          l,
          c
        ), vc(t), i = Rr(), t !== null && !Qt ? (Dr(t, e, d), en(t, e, d)) : (St && i && Z(e), e.flags |= 1, ne(t, e, l, d), e.child);
      }
      function du(t, e, l, i, c) {
        if (Xn(e), e.stateNode === null) {
          var d = Sa, w = l.contextType;
          typeof w == "object" && w !== null && (d = ee(w)), d = new l(i, d), e.memoizedState = d.state !== null && d.state !== void 0 ? d.state : null, d.updater = Jo, e.stateNode = d, d._reactInternals = e, d = e.stateNode, d.props = i, d.state = e.memoizedState, d.refs = {}, zr(e), w = l.contextType, d.context = typeof w == "object" && w !== null ? ee(w) : Sa, d.state = e.memoizedState, w = l.getDerivedStateFromProps, typeof w == "function" && (Zr(
            e,
            l,
            w,
            i
          ), d.state = e.memoizedState), typeof l.getDerivedStateFromProps == "function" || typeof d.getSnapshotBeforeUpdate == "function" || typeof d.UNSAFE_componentWillMount != "function" && typeof d.componentWillMount != "function" || (w = d.state, typeof d.componentWillMount == "function" && d.componentWillMount(), typeof d.UNSAFE_componentWillMount == "function" && d.UNSAFE_componentWillMount(), w !== d.state && Jo.enqueueReplaceState(
            d,
            d.state,
            null
          ), Fa(e, i, d, c), Wa(), d.state = e.memoizedState), typeof d.componentDidMount == "function" && (e.flags |= 4194308), i = !0;
        } else if (t === null) {
          d = e.stateNode;
          var M = e.memoizedProps, V = Wn(l, M);
          d.props = V;
          var $ = d.context, nt = l.contextType;
          w = Sa, typeof nt == "object" && nt !== null && (w = ee(nt));
          var P = l.getDerivedStateFromProps;
          nt = typeof P == "function" || typeof d.getSnapshotBeforeUpdate == "function", M = e.pendingProps !== M, nt || typeof d.UNSAFE_componentWillReceiveProps != "function" && typeof d.componentWillReceiveProps != "function" || (M || $ !== w) && tu(
            e,
            d,
            i,
            w
          ), Cn = !1;
          var lt = e.memoizedState;
          d.state = lt, Fa(e, i, d, c), Wa(), $ = e.memoizedState, M || lt !== $ || Cn ? (typeof P == "function" && (Zr(
            e,
            l,
            P,
            i
          ), $ = e.memoizedState), (V = Cn || Pc(
            e,
            l,
            V,
            i,
            lt,
            $,
            w
          )) ? (nt || typeof d.UNSAFE_componentWillMount != "function" && typeof d.componentWillMount != "function" || (typeof d.componentWillMount == "function" && d.componentWillMount(), typeof d.UNSAFE_componentWillMount == "function" && d.UNSAFE_componentWillMount()), typeof d.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof d.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = i, e.memoizedState = $), d.props = i, d.state = $, d.context = w, i = V) : (typeof d.componentDidMount == "function" && (e.flags |= 4194308), i = !1);
        } else {
          d = e.stateNode, Nr(t, e), w = e.memoizedProps, nt = Wn(l, w), d.props = nt, P = e.pendingProps, lt = d.context, $ = l.contextType, V = Sa, typeof $ == "object" && $ !== null && (V = ee($)), M = l.getDerivedStateFromProps, ($ = typeof M == "function" || typeof d.getSnapshotBeforeUpdate == "function") || typeof d.UNSAFE_componentWillReceiveProps != "function" && typeof d.componentWillReceiveProps != "function" || (w !== P || lt !== V) && tu(
            e,
            d,
            i,
            V
          ), Cn = !1, lt = e.memoizedState, d.state = lt, Fa(e, i, d, c), Wa();
          var gt = e.memoizedState;
          w !== P || lt !== gt || Cn || t !== null && t.dependencies !== null && Ul(t.dependencies) ? (typeof M == "function" && (Zr(
            e,
            l,
            M,
            i
          ), gt = e.memoizedState), (nt = Cn || Pc(
            e,
            l,
            nt,
            i,
            lt,
            gt,
            V
          ) || t !== null && t.dependencies !== null && Ul(t.dependencies)) ? ($ || typeof d.UNSAFE_componentWillUpdate != "function" && typeof d.componentWillUpdate != "function" || (typeof d.componentWillUpdate == "function" && d.componentWillUpdate(i, gt, V), typeof d.UNSAFE_componentWillUpdate == "function" && d.UNSAFE_componentWillUpdate(
            i,
            gt,
            V
          )), typeof d.componentDidUpdate == "function" && (e.flags |= 4), typeof d.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof d.componentDidUpdate != "function" || w === t.memoizedProps && lt === t.memoizedState || (e.flags |= 4), typeof d.getSnapshotBeforeUpdate != "function" || w === t.memoizedProps && lt === t.memoizedState || (e.flags |= 1024), e.memoizedProps = i, e.memoizedState = gt), d.props = i, d.state = gt, d.context = V, i = nt) : (typeof d.componentDidUpdate != "function" || w === t.memoizedProps && lt === t.memoizedState || (e.flags |= 4), typeof d.getSnapshotBeforeUpdate != "function" || w === t.memoizedProps && lt === t.memoizedState || (e.flags |= 1024), i = !1);
        }
        return d = i, ai(t, e), i = (e.flags & 128) !== 0, d || i ? (d = e.stateNode, l = i && typeof l.getDerivedStateFromError != "function" ? null : d.render(), e.flags |= 1, t !== null && i ? (e.child = ia(
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
      function fu(t, e, l, i) {
        return Be(), e.flags |= 256, ne(t, e, l, i), e.child;
      }
      function Fr(t) {
        return { baseLanes: t, cachePool: oc() };
      }
      function $r(t, e, l) {
        return t = t !== null ? t.childLanes & ~l : 0, e && (t |= Ne), t;
      }
      function mu(t, e, l) {
        var i = e.pendingProps, c = !1, d = (e.flags & 128) !== 0, w;
        if ((w = d) || (w = t !== null && t.memoizedState === null ? !1 : (Yt.current & 2) !== 0), w && (c = !0, e.flags &= -129), w = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (St) {
            if (c ? xn(e) : wn(), (t = Rt) ? (t = eg(
              t,
              Ae
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: zn !== null ? { id: Ze, overflow: Je } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, l = rd(t), l.return = e, e.child = l, le = e, Rt = null)) : t = null, t === null) throw ht(e);
            return Oo(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var M = i.children;
          return i = i.fallback, c ? (wn(), c = e.mode, M = li(
            { mode: "hidden", children: M },
            c
          ), i = In(
            i,
            c,
            l,
            null
          ), M.return = e, i.return = e, M.sibling = i, e.child = M, i = e.child, i.memoizedState = Fr(l), i.childLanes = $r(
            t,
            w,
            l
          ), e.memoizedState = Fo, Pa(null, i)) : (xn(e), Ir(e, M));
        }
        var V = t.memoizedState;
        if (V !== null && (M = V.dehydrated, M !== null)) {
          if (d)
            e.flags & 256 ? (xn(e), e.flags &= -257, e = Pr(
              t,
              e,
              l
            )) : e.memoizedState !== null ? (wn(), e.child = t.child, e.flags |= 128, e = null) : (wn(), M = i.fallback, c = e.mode, i = li(
              { mode: "visible", children: i.children },
              c
            ), M = In(
              M,
              c,
              l,
              null
            ), M.flags |= 2, i.return = e, M.return = e, i.sibling = M, e.child = i, ia(
              e,
              t.child,
              null,
              l
            ), i = e.child, i.memoizedState = Fr(l), i.childLanes = $r(
              t,
              w,
              l
            ), e.memoizedState = Fo, e = Pa(null, i));
          else if (xn(e), Oo(M))
            w = Lh(M).digest, i = Error(s(419)), i.stack = "", i.digest = w, Ka({ value: i, source: null, stack: null }), e = Pr(
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
            if (w = At, w !== null && (i = k(
              w,
              l
            ), i !== 0 && i !== V.retryLane))
              throw V.retryLane = i, Jn(t, i), he(w, t, i), Wo;
            jo(M) || ui(), e = Pr(
              t,
              e,
              l
            );
          } else
            jo(M) ? (e.flags |= 192, e.child = t.child, e = null) : (t = V.treeContext, ue && (Rt = Fh(
              M
            ), le = e, St = !0, Tn = null, Ae = !1, t !== null && st(e, t)), e = Ir(
              e,
              i.children
            ), e.flags |= 4096);
          return e;
        }
        return c ? (wn(), M = i.fallback, c = e.mode, V = t.child, d = V.sibling, i = ln(V, {
          mode: "hidden",
          children: i.children
        }), i.subtreeFlags = V.subtreeFlags & 65011712, d !== null ? M = ln(
          d,
          M
        ) : (M = In(
          M,
          c,
          l,
          null
        ), M.flags |= 2), M.return = e, i.return = e, i.sibling = M, e.child = i, Pa(null, i), i = e.child, M = t.child.memoizedState, M === null ? M = Fr(l) : (c = M.cachePool, c !== null ? (V = rn ? Dt._currentValue : Dt._currentValue2, c = c.parent !== V ? { parent: V, pool: V } : c) : c = oc(), M = {
          baseLanes: M.baseLanes | l,
          cachePool: c
        }), i.memoizedState = M, i.childLanes = $r(
          t,
          w,
          l
        ), e.memoizedState = Fo, Pa(t.child, i)) : (xn(e), l = t.child, t = l.sibling, l = ln(l, {
          mode: "visible",
          children: i.children
        }), l.return = e, l.sibling = null, t !== null && (w = e.deletions, w === null ? (e.deletions = [t], e.flags |= 16) : w.push(t)), e.child = l, e.memoizedState = null, l);
      }
      function Ir(t, e) {
        return e = li(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function li(t, e) {
        return t = r(22, t, null, e), t.lanes = 0, t;
      }
      function Pr(t, e, l) {
        return ia(e, t.child, null, l), t = Ir(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function pu(t, e, l) {
        t.lanes |= e;
        var i = t.alternate;
        i !== null && (i.lanes |= e), xr(t.return, e, l);
      }
      function to(t, e, l, i, c, d) {
        var w = t.memoizedState;
        w === null ? t.memoizedState = {
          isBackwards: e,
          rendering: null,
          renderingStartTime: 0,
          last: i,
          tail: l,
          tailMode: c,
          treeForkCount: d
        } : (w.isBackwards = e, w.rendering = null, w.renderingStartTime = 0, w.last = i, w.tail = l, w.tailMode = c, w.treeForkCount = d);
      }
      function hu(t, e, l) {
        var i = e.pendingProps, c = i.revealOrder, d = i.tail;
        i = i.children;
        var w = Yt.current, M = (w & 2) !== 0;
        if (M ? (w = w & 1 | 2, e.flags |= 128) : w &= 1, N(Yt, w), ne(t, e, i, l), i = St ? ul : 0, !M && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && pu(t, l, e);
            else if (t.tag === 19)
              pu(t, l, e);
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
              t = l.alternate, t !== null && Jl(t) === null && (c = l), l = l.sibling;
            l = c, l === null ? (c = e.child, e.child = null) : (c = l.sibling, l.sibling = null), to(
              e,
              !1,
              c,
              l,
              d,
              i
            );
            break;
          case "backwards":
          case "unstable_legacy-backwards":
            for (l = null, c = e.child, e.child = null; c !== null; ) {
              if (t = c.alternate, t !== null && Jl(t) === null) {
                e.child = c;
                break;
              }
              t = c.sibling, c.sibling = l, l = c, c = t;
            }
            to(
              e,
              !0,
              l,
              null,
              d,
              i
            );
            break;
          case "together":
            to(
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
      function eo(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && Ul(t)));
      }
      function Rp(t, e, l) {
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
              return e.flags |= 128, Ar(e), null;
            break;
          case 13:
            var i = e.memoizedState;
            if (i !== null)
              return i.dehydrated !== null ? (xn(e), e.flags |= 128, null) : (l & e.child.childLanes) !== 0 ? mu(
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
            if (i = (l & e.childLanes) !== 0, i || (ma(
              t,
              e,
              l,
              !1
            ), i = (l & e.childLanes) !== 0), c) {
              if (i)
                return hu(
                  t,
                  e,
                  l
                );
              e.flags |= 128;
            }
            if (c = e.memoizedState, c !== null && (c.rendering = null, c.tail = null, c.lastEffect = null), N(Yt, Yt.current), i) break;
            return null;
          case 22:
            return e.lanes = 0, ou(
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
      function gu(t, e, l) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Qt = !0;
          else {
            if (!eo(t, l) && (e.flags & 128) === 0)
              return Qt = !1, Rp(
                t,
                e,
                l
              );
            Qt = (t.flags & 131072) !== 0;
          }
        else
          Qt = !1, St && (e.flags & 1048576) !== 0 && C(e, ul, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var i = e.pendingProps;
              if (t = Zn(e.elementType), e.type = t, typeof t == "function")
                yo(t) ? (i = Wn(t, i), e.tag = 1, e = du(
                  null,
                  e,
                  t,
                  i,
                  l
                )) : (e.tag = 0, e = Wr(
                  null,
                  e,
                  t,
                  i,
                  l
                ));
              else {
                if (t != null) {
                  var c = t.$$typeof;
                  if (c === Eo) {
                    e.tag = 11, e = lu(
                      null,
                      e,
                      t,
                      i,
                      l
                    );
                    break t;
                  } else if (c === To) {
                    e.tag = 14, e = iu(
                      null,
                      e,
                      t,
                      i,
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
            return Wr(
              t,
              e,
              e.type,
              e.pendingProps,
              l
            );
          case 1:
            return i = e.type, c = Wn(
              i,
              e.pendingProps
            ), du(
              t,
              e,
              i,
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
              c = e.memoizedState, i = c.element, Nr(t, e), Fa(e, d, null, l);
              var w = e.memoizedState;
              if (d = w.cache, bn(e, Dt, d), d !== c.cache && wr(
                e,
                [Dt],
                l,
                !0
              ), Wa(), d = w.element, ue && c.isDehydrated)
                if (c = {
                  element: d,
                  isDehydrated: !1,
                  cache: w.cache
                }, e.updateQueue.baseState = c, e.memoizedState = c, e.flags & 256) {
                  e = fu(
                    t,
                    e,
                    d,
                    l
                  );
                  break t;
                } else if (d !== i) {
                  i = Y(
                    Error(s(424)),
                    e
                  ), Ka(i), e = fu(
                    t,
                    e,
                    d,
                    l
                  );
                  break t;
                } else
                  for (ue && (Rt = Jh(
                    e.stateNode.containerInfo
                  ), le = e, St = !0, Tn = null, Ae = !0), l = Vd(
                    e,
                    null,
                    d,
                    l
                  ), e.child = l; l; )
                    l.flags = l.flags & -3 | 4096, l = l.sibling;
              else {
                if (Be(), d === i) {
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
              return ai(t, e), t === null ? (l = Cd(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = l : St || (e.stateNode = wg(
                e.type,
                e.pendingProps,
                Nn.current,
                e
              )) : e.memoizedState = Cd(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Jt)
              return Et(e), t === null && Jt && St && (i = e.stateNode = Dd(
                e.type,
                e.pendingProps,
                Nn.current,
                ae.current,
                !1
              ), le = e, Ae = !0, Rt = $h(
                e.type,
                i,
                Rt
              )), ne(
                t,
                e,
                e.pendingProps.children,
                l
              ), ai(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && St && (vg(
              e.type,
              e.pendingProps,
              ae.current
            ), (c = i = Rt) && (i = Ih(
              i,
              e.type,
              e.pendingProps,
              Ae
            ), i !== null ? (e.stateNode = i, le = e, Rt = Zh(i), Ae = !1, c = !0) : c = !1), c || ht(e)), Et(e), c = e.type, d = e.pendingProps, w = t !== null ? t.memoizedProps : null, i = d.children, hi(c, d) ? i = null : w !== null && hi(c, w) && (e.flags |= 32), e.memoizedState !== null && (c = Or(
              t,
              e,
              zp,
              null,
              null,
              l
            ), rn ? ta._currentValue = c : ta._currentValue2 = c), ai(t, e), ne(t, e, i, l), e.child;
          case 6:
            return t === null && St && (yg(
              e.pendingProps,
              ae.current
            ), (t = l = Rt) && (l = Ph(
              l,
              e.pendingProps,
              Ae
            ), l !== null ? (e.stateNode = l, le = e, Rt = null, t = !0) : t = !1), t || ht(e)), null;
          case 13:
            return mu(t, e, l);
          case 4:
            return ct(
              e,
              e.stateNode.containerInfo
            ), i = e.pendingProps, t === null ? e.child = ia(
              e,
              null,
              i,
              l
            ) : ne(t, e, i, l), e.child;
          case 11:
            return lu(
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
            return i = e.pendingProps, bn(e, e.type, i.value), ne(
              t,
              e,
              i.children,
              l
            ), e.child;
          case 9:
            return c = e.type._context, i = e.pendingProps.children, Xn(e), c = ee(c), i = i(c), e.flags |= 1, ne(t, e, i, l), e.child;
          case 14:
            return iu(
              t,
              e,
              e.type,
              e.pendingProps,
              l
            );
          case 15:
            return ru(
              t,
              e,
              e.type,
              e.pendingProps,
              l
            );
          case 19:
            return hu(
              t,
              e,
              l
            );
          case 31:
            return Op(t, e, l);
          case 22:
            return ou(
              t,
              e,
              l,
              e.pendingProps
            );
          case 24:
            return Xn(e), i = ee(Dt), t === null ? (c = Sr(), c === null && (c = At, d = _r(), c.pooledCache = d, d.refCount++, d !== null && (c.pooledCacheLanes |= l), c = d), e.memoizedState = {
              parent: i,
              cache: c
            }, zr(e), bn(e, Dt, c)) : ((t.lanes & l) !== 0 && (Nr(t, e), Fa(e, null, null, l), Wa()), c = t.memoizedState, d = e.memoizedState, c.parent !== i ? (c = { parent: i, cache: i }, e.memoizedState = c, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = c), bn(e, Dt, i)) : (i = d.cache, bn(e, Dt, i), i !== c.cache && wr(
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
      function ii(t) {
        Xe && (t.flags |= 8);
      }
      function bu(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function no(t, e, l, i) {
        if (ce)
          for (l = e.child; l !== null; ) {
            if (l.tag === 5 || l.tag === 6)
              Mo(t, l.stateNode);
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
              l && i && (d = Sd(
                d,
                c.type,
                c.memoizedProps
              )), Mo(t, d);
            } else if (c.tag === 6)
              d = c.stateNode, l && i && (d = Ed(
                d,
                c.memoizedProps
              )), Mo(t, d);
            else if (c.tag !== 4) {
              if (c.tag === 22 && c.memoizedState !== null)
                d = c.child, d !== null && (d.return = c), no(t, c, !0, !0);
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
      function vu(t, e, l, i) {
        var c = !1;
        if (Xe)
          for (var d = e.child; d !== null; ) {
            if (d.tag === 5) {
              var w = d.stateNode;
              l && i && (w = Sd(
                w,
                d.type,
                d.memoizedProps
              )), _d(t, w);
            } else if (d.tag === 6)
              w = d.stateNode, l && i && (w = Ed(
                w,
                d.memoizedProps
              )), _d(t, w);
            else if (d.tag !== 4) {
              if (d.tag === 22 && d.memoizedState !== null)
                c = d.child, c !== null && (c.return = d), vu(t, d, !0, !0), c = !0;
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
      function yu(t, e) {
        if (Xe && bu(t, e)) {
          t = e.stateNode;
          var l = t.containerInfo, i = wd();
          vu(i, e, !1, !1), t.pendingChildren = i, He(e), Yh(l, i);
        }
      }
      function ao(t, e, l, i) {
        if (ce)
          t.memoizedProps !== i && He(e);
        else if (Xe) {
          var c = t.stateNode, d = t.memoizedProps;
          if ((t = bu(t, e)) || d !== i) {
            var w = ae.current;
            d = Gh(
              c,
              l,
              d,
              i,
              !t,
              null
            ), d === c ? e.stateNode = c : (ii(e), gd(
              d,
              l,
              i,
              w
            ) && He(e), e.stateNode = d, t && no(d, e, !1, !1));
          } else e.stateNode = c;
        }
      }
      function lo(t, e, l, i, c) {
        if ((t.mode & 32) !== 0 && (l === null ? mh(e, i) : ph(e, l, i))) {
          if (t.flags |= 16777216, (c & 335544128) === c || Ao(e, i))
            if (vd(t.stateNode, e, i))
              t.flags |= 8192;
            else if (Ku()) t.flags |= 8192;
            else
              throw la = zi, Qo;
        } else t.flags &= -16777217;
      }
      function xu(t, e) {
        if (kg(e)) {
          if (t.flags |= 16777216, !Rd(e))
            if (Ku()) t.flags |= 8192;
            else
              throw la = zi, Qo;
        } else t.flags &= -16777217;
      }
      function ri(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? F() : 536870912, t.lanes |= e, Ua |= e);
      }
      function tl(t, e) {
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
              for (var i = null; l !== null; )
                l.alternate !== null && (i = l), l = l.sibling;
              i === null ? e || t.tail === null ? t.tail = null : t.tail.sibling = null : i.sibling = null;
          }
      }
      function Ot(t) {
        var e = t.alternate !== null && t.alternate.child === t.child, l = 0, i = 0;
        if (e)
          for (var c = t.child; c !== null; )
            l |= c.lanes | c.childLanes, i |= c.subtreeFlags & 65011712, i |= c.flags & 65011712, c.return = t, c = c.sibling;
        else
          for (c = t.child; c !== null; )
            l |= c.lanes | c.childLanes, i |= c.subtreeFlags, i |= c.flags, c.return = t, c = c.sibling;
        return t.subtreeFlags |= i, t.childLanes = l, e;
      }
      function Dp(t, e, l) {
        var i = e.pendingProps;
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
            return l = e.stateNode, i = null, t !== null && (i = t.memoizedState.cache), e.memoizedState.cache !== i && (e.flags |= 2048), Pe(Dt), ut(), l.pendingContext && (l.context = l.pendingContext, l.pendingContext = null), (t === null || t.child === null) && (De(e) ? He(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, gn())), yu(t, e), Ot(e), null;
          case 26:
            if (Ge) {
              var c = e.type, d = e.memoizedState;
              return t === null ? (He(e), d !== null ? (Ot(e), xu(
                e,
                d
              )) : (Ot(e), lo(
                e,
                c,
                null,
                i,
                l
              ))) : d ? d !== t.memoizedState ? (He(e), Ot(e), xu(
                e,
                d
              )) : (Ot(e), e.flags &= -16777217) : (d = t.memoizedProps, ce ? d !== i && He(e) : ao(
                t,
                e,
                c,
                i
              ), Ot(e), lo(
                e,
                c,
                d,
                i,
                l
              )), null;
            }
          case 27:
            if (Jt) {
              if ($t(e), l = Nn.current, c = e.type, t !== null && e.stateNode != null)
                ce ? t.memoizedProps !== i && He(e) : ao(t, e, c, i);
              else {
                if (!i) {
                  if (e.stateNode === null)
                    throw Error(s(166));
                  return Ot(e), null;
                }
                t = ae.current, De(e) ? Qn(e, t) : (t = Dd(
                  c,
                  i,
                  l,
                  t,
                  !0
                ), e.stateNode = t, He(e));
              }
              return Ot(e), null;
            }
          case 5:
            if ($t(e), c = e.type, t !== null && e.stateNode != null)
              ao(t, e, c, i);
            else {
              if (!i) {
                if (e.stateNode === null)
                  throw Error(s(166));
                return Ot(e), null;
              }
              if (d = ae.current, De(e))
                Qn(e, d), fg(
                  e.stateNode,
                  c,
                  i,
                  d
                ) && (e.flags |= 64);
              else {
                var w = ih(
                  c,
                  i,
                  Nn.current,
                  d,
                  e
                );
                ii(e), no(w, e, !1, !1), e.stateNode = w, gd(
                  w,
                  c,
                  i,
                  d
                ) && He(e);
              }
            }
            return Ot(e), lo(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              l
            ), null;
          case 6:
            if (t && e.stateNode != null)
              l = t.memoizedProps, ce ? l !== i && He(e) : Xe && (l !== i ? (t = Nn.current, l = ae.current, ii(e), e.stateNode = bd(
                i,
                t,
                l,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof i != "string" && e.stateNode === null)
                throw Error(s(166));
              if (t = Nn.current, l = ae.current, De(e)) {
                if (!ue) throw Error(s(176));
                if (t = e.stateNode, l = e.memoizedProps, i = null, c = le, c !== null)
                  switch (c.tag) {
                    case 27:
                    case 5:
                      i = c.memoizedProps;
                  }
                ag(
                  t,
                  l,
                  e,
                  i
                ) || ht(e, !0);
              } else
                ii(e), e.stateNode = bd(
                  i,
                  t,
                  l,
                  e
                );
            }
            return Ot(e), null;
          case 31:
            if (l = e.memoizedState, t === null || t.memoizedState !== null) {
              if (i = De(e), l !== null) {
                if (t === null) {
                  if (!i) throw Error(s(318));
                  if (!ue) throw Error(s(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(557));
                  lg(t, e);
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
            if (i = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (c = De(e), i !== null && i.dehydrated !== null) {
                if (t === null) {
                  if (!c) throw Error(s(318));
                  if (!ue) throw Error(s(344));
                  if (c = e.memoizedState, c = c !== null ? c.dehydrated : null, !c) throw Error(s(317));
                  ig(c, e);
                } else
                  Be(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                Ot(e), c = !1;
              } else
                c = gn(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = c), c = !0;
              if (!c)
                return e.flags & 256 ? (ye(e), e) : (ye(e), null);
            }
            return ye(e), (e.flags & 128) !== 0 ? (e.lanes = l, e) : (l = i !== null, t = t !== null && t.memoizedState !== null, l && (i = e.child, c = null, i.alternate !== null && i.alternate.memoizedState !== null && i.alternate.memoizedState.cachePool !== null && (c = i.alternate.memoizedState.cachePool.pool), d = null, i.memoizedState !== null && i.memoizedState.cachePool !== null && (d = i.memoizedState.cachePool.pool), d !== c && (i.flags |= 2048)), l !== t && l && (e.child.flags |= 8192), ri(e, e.updateQueue), Ot(e), null);
          case 4:
            return ut(), yu(t, e), t === null && ch(e.stateNode.containerInfo), Ot(e), null;
          case 10:
            return Pe(e.type), Ot(e), null;
          case 19:
            if (S(Yt), i = e.memoizedState, i === null) return Ot(e), null;
            if (c = (e.flags & 128) !== 0, d = i.rendering, d === null)
              if (c) tl(i, !1);
              else {
                if (qt !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (d = Jl(t), d !== null) {
                      for (e.flags |= 128, tl(i, !1), t = d.updateQueue, e.updateQueue = t, ri(e, t), e.subtreeFlags = 0, t = l, l = e.child; l !== null; )
                        id(l, t), l = l.sibling;
                      return N(
                        Yt,
                        Yt.current & 1 | 2
                      ), St && K(e, i.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                i.tail !== null && ge() > vl && (e.flags |= 128, c = !0, tl(i, !1), e.lanes = 4194304);
              }
            else {
              if (!c)
                if (t = Jl(d), t !== null) {
                  if (e.flags |= 128, c = !0, t = t.updateQueue, e.updateQueue = t, ri(e, t), tl(i, !0), i.tail === null && i.tailMode === "hidden" && !d.alternate && !St)
                    return Ot(e), null;
                } else
                  2 * ge() - i.renderingStartTime > vl && l !== 536870912 && (e.flags |= 128, c = !0, tl(i, !1), e.lanes = 4194304);
              i.isBackwards ? (d.sibling = e.child, e.child = d) : (t = i.last, t !== null ? t.sibling = d : e.child = d, i.last = d);
            }
            return i.tail !== null ? (t = i.tail, i.rendering = t, i.tail = t.sibling, i.renderingStartTime = ge(), t.sibling = null, l = Yt.current, N(
              Yt,
              c ? l & 1 | 2 : l & 1
            ), St && K(e, i.treeForkCount), t) : (Ot(e), null);
          case 22:
          case 23:
            return ye(e), Mr(), i = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== i && (e.flags |= 8192) : i && (e.flags |= 8192), i ? (l & 536870912) !== 0 && (e.flags & 128) === 0 && (Ot(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : Ot(e), l = e.updateQueue, l !== null && ri(e, l.retryQueue), l = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (l = t.memoizedState.cachePool.pool), i = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (i = e.memoizedState.cachePool.pool), i !== l && (e.flags |= 2048), t !== null && S(aa), null;
          case 24:
            return l = null, t !== null && (l = t.memoizedState.cache), e.memoizedState.cache !== l && (e.flags |= 2048), Pe(Dt), Ot(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(s(156, e.tag));
      }
      function Bp(t, e) {
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
            return ye(e), Mr(), t !== null && S(aa), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Pe(Dt), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function wu(t, e) {
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
            ye(e), Mr(), t !== null && S(aa);
            break;
          case 24:
            Pe(Dt);
        }
      }
      function el(t, e) {
        try {
          var l = e.updateQueue, i = l !== null ? l.lastEffect : null;
          if (i !== null) {
            var c = i.next;
            l = c;
            do {
              if ((l.tag & t) === t) {
                i = void 0;
                var d = l.create, w = l.inst;
                i = d(), w.destroy = i;
              }
              l = l.next;
            } while (l !== c);
          }
        } catch (M) {
          zt(e, e.return, M);
        }
      }
      function _n(t, e, l) {
        try {
          var i = e.updateQueue, c = i !== null ? i.lastEffect : null;
          if (c !== null) {
            var d = c.next;
            i = d;
            do {
              if ((i.tag & t) === t) {
                var w = i.inst, M = w.destroy;
                if (M !== void 0) {
                  w.destroy = void 0, c = e;
                  var V = l, $ = M;
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
              i = i.next;
            } while (i !== d);
          }
        } catch (nt) {
          zt(e, e.return, nt);
        }
      }
      function _u(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var l = t.stateNode;
          try {
            hc(e, l);
          } catch (i) {
            zt(t, t.return, i);
          }
        }
      }
      function ku(t, e, l) {
        l.props = Wn(
          t.type,
          t.memoizedProps
        ), l.state = t.memoizedState;
        try {
          l.componentWillUnmount();
        } catch (i) {
          zt(t, e, i);
        }
      }
      function nl(t, e) {
        try {
          var l = t.ref;
          if (l !== null) {
            switch (t.tag) {
              case 26:
              case 27:
              case 5:
                var i = rl(t.stateNode);
                break;
              case 30:
                i = t.stateNode;
                break;
              default:
                i = t.stateNode;
            }
            typeof l == "function" ? t.refCleanup = l(i) : l.current = i;
          }
        } catch (c) {
          zt(t, e, c);
        }
      }
      function Ke(t, e) {
        var l = t.ref, i = t.refCleanup;
        if (l !== null)
          if (typeof i == "function")
            try {
              i();
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
      function Su(t) {
        var e = t.type, l = t.memoizedProps, i = t.stateNode;
        try {
          Ch(i, e, l, t);
        } catch (c) {
          zt(t, t.return, c);
        }
      }
      function io(t, e, l) {
        try {
          Mh(
            t.stateNode,
            t.type,
            l,
            e,
            t
          );
        } catch (i) {
          zt(t, t.return, i);
        }
      }
      function Eu(t) {
        return t.tag === 5 || t.tag === 3 || (Ge ? t.tag === 26 : !1) || (Jt ? t.tag === 27 && _a(t.type) : !1) || t.tag === 4;
      }
      function ro(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || Eu(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Jt && t.tag === 27 && _a(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function oo(t, e, l) {
        var i = t.tag;
        if (i === 5 || i === 6)
          t = t.stateNode, e ? jh(l, t, e) : Nh(l, t);
        else if (i !== 4 && (Jt && i === 27 && _a(t.type) && (l = t.stateNode, e = null), t = t.child, t !== null))
          for (oo(t, e, l), t = t.sibling; t !== null; )
            oo(t, e, l), t = t.sibling;
      }
      function oi(t, e, l) {
        var i = t.tag;
        if (i === 5 || i === 6)
          t = t.stateNode, e ? Ah(l, t, e) : zh(l, t);
        else if (i !== 4 && (Jt && i === 27 && _a(t.type) && (l = t.stateNode), t = t.child, t !== null))
          for (oi(t, e, l), t = t.sibling; t !== null; )
            oi(t, e, l), t = t.sibling;
      }
      function zu(t, e, l) {
        t = t.containerInfo;
        try {
          kd(t, l);
        } catch (i) {
          zt(e, e.return, i);
        }
      }
      function Nu(t) {
        var e = t.stateNode, l = t.memoizedProps;
        try {
          Eg(
            t.type,
            l,
            e,
            t
          );
        } catch (i) {
          zt(t, t.return, i);
        }
      }
      function Hp(t, e) {
        for (ah(t.containerInfo), Pt = e; Pt !== null; )
          if (t = Pt, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null)
            e.return = t, Pt = e;
          else
            for (; Pt !== null; ) {
              t = Pt;
              var l = t.alternate;
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
                  if ((e & 1024) !== 0 && l !== null) {
                    e = void 0, i = t, c = l.memoizedProps, l = l.memoizedState;
                    var d = i.stateNode;
                    try {
                      var w = Wn(
                        i.type,
                        c
                      );
                      e = d.getSnapshotBeforeUpdate(
                        w,
                        l
                      ), d.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (M) {
                      zt(i, i.return, M);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && ce && qh(t.stateNode.containerInfo);
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
      function Tu(t, e, l) {
        var i = l.flags;
        switch (l.tag) {
          case 0:
          case 11:
          case 15:
            nn(t, l), i & 4 && el(5, l);
            break;
          case 1:
            if (nn(t, l), i & 4)
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
            i & 64 && _u(l), i & 512 && nl(l, l.return);
            break;
          case 3:
            if (nn(t, l), i & 64 && (i = l.updateQueue, i !== null)) {
              if (t = null, l.child !== null)
                switch (l.child.tag) {
                  case 27:
                  case 5:
                    t = rl(l.child.stateNode);
                    break;
                  case 1:
                    t = l.child.stateNode;
                }
              try {
                hc(i, t);
              } catch (w) {
                zt(l, l.return, w);
              }
            }
            break;
          case 27:
            Jt && e === null && i & 4 && Nu(l);
          case 26:
          case 5:
            if (nn(t, l), e === null) {
              if (i & 4) Su(l);
              else if (i & 64) {
                t = l.type, e = l.memoizedProps, c = l.stateNode;
                try {
                  sg(
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
            i & 512 && nl(l, l.return);
            break;
          case 12:
            nn(t, l);
            break;
          case 31:
            nn(t, l), i & 4 && Mu(t, l);
            break;
          case 13:
            nn(t, l), i & 4 && Au(t, l), i & 64 && (i = l.memoizedState, i !== null && (i = i.dehydrated, i !== null && (l = Qp.bind(
              null,
              l
            ), Vh(i, l))));
            break;
          case 22:
            if (i = l.memoizedState !== null || un, !i) {
              e = e !== null && e.memoizedState !== null || Kt, c = un;
              var d = Kt;
              un = i, (Kt = e) && !d ? an(
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
      function Cu(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, Cu(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && fh(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function Ue(t, e, l) {
        for (l = l.child; l !== null; )
          so(
            t,
            e,
            l
          ), l = l.sibling;
      }
      function so(t, e, l) {
        if (ke && typeof ke.onCommitFiberUnmount == "function")
          try {
            ke.onCommitFiberUnmount(cl, l);
          } catch {
          }
        switch (l.tag) {
          case 26:
            if (Ge) {
              Kt || Ke(l, e), Ue(
                t,
                e,
                l
              ), l.memoizedState ? Ad(l.memoizedState) : l.stateNode && Od(l.stateNode);
              break;
            }
          case 27:
            if (Jt) {
              Kt || Ke(l, e);
              var i = Xt, c = be;
              _a(l.type) && (Xt = l.stateNode, be = !1), Ue(
                t,
                e,
                l
              ), Bd(l.stateNode), Xt = i, be = c;
              break;
            }
          case 5:
            Kt || Ke(l, e);
          case 6:
            if (ce) {
              if (i = Xt, c = be, Xt = null, Ue(
                t,
                e,
                l
              ), Xt = i, be = c, Xt !== null)
                if (be)
                  try {
                    Rh(Xt, l.stateNode);
                  } catch (d) {
                    zt(
                      l,
                      e,
                      d
                    );
                  }
                else
                  try {
                    Oh(Xt, l.stateNode);
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
            ce && Xt !== null && (be ? hg(
              Xt,
              l.stateNode
            ) : pg(Xt, l.stateNode));
            break;
          case 4:
            ce ? (i = Xt, c = be, Xt = l.stateNode.containerInfo, be = !0, Ue(
              t,
              e,
              l
            ), Xt = i, be = c) : (Xe && zu(
              l.stateNode,
              l,
              wd()
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
            Kt || (Ke(l, e), i = l.stateNode, typeof i.componentWillUnmount == "function" && ku(
              l,
              e,
              i
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
            Kt = (i = Kt) || l.memoizedState !== null, Ue(
              t,
              e,
              l
            ), Kt = i;
            break;
          default:
            Ue(
              t,
              e,
              l
            );
        }
      }
      function Mu(t, e) {
        if (ue && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            ug(t);
          } catch (l) {
            zt(e, e.return, l);
          }
        }
      }
      function Au(t, e) {
        if (ue && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            dg(t);
          } catch (l) {
            zt(e, e.return, l);
          }
      }
      function Up(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new Xd()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Xd()), e;
          default:
            throw Error(s(435, t.tag));
        }
      }
      function si(t, e) {
        var l = Up(t);
        e.forEach(function(i) {
          if (!l.has(i)) {
            l.add(i);
            var c = Kp.bind(null, t, i);
            i.then(c, c);
          }
        });
      }
      function se(t, e) {
        var l = e.deletions;
        if (l !== null)
          for (var i = 0; i < l.length; i++) {
            var c = l[i], d = t, w = e;
            if (ce) {
              var M = w;
              t: for (; M !== null; ) {
                switch (M.tag) {
                  case 27:
                    if (Jt) {
                      if (_a(M.type)) {
                        Xt = M.stateNode, be = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Xt = M.stateNode, be = !1;
                    break t;
                  case 3:
                  case 4:
                    Xt = M.stateNode.containerInfo, be = !0;
                    break t;
                }
                M = M.return;
              }
              if (Xt === null) throw Error(s(160));
              so(d, w, c), Xt = null, be = !1;
            } else so(d, w, c);
            d = c.alternate, d !== null && (d.return = null), c.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            ju(e, t), e = e.sibling;
      }
      function ju(t, e) {
        var l = t.alternate, i = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            se(e, t), me(t), i & 4 && (_n(3, t, t.return), el(3, t), _n(5, t, t.return));
            break;
          case 1:
            se(e, t), me(t), i & 512 && (Kt || l === null || Ke(l, l.return)), i & 64 && un && (t = t.updateQueue, t !== null && (i = t.callbacks, i !== null && (l = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = l === null ? i : l.concat(i))));
            break;
          case 26:
            if (Ge) {
              var c = Ye;
              if (se(e, t), me(t), i & 512 && (Kt || l === null || Ke(l, l.return)), i & 4) {
                i = l !== null ? l.memoizedState : null;
                var d = t.memoizedState;
                l === null ? d === null ? t.stateNode === null ? t.stateNode = xg(
                  c,
                  t.type,
                  t.memoizedProps,
                  t
                ) : jd(
                  c,
                  t.type,
                  t.stateNode
                ) : t.stateNode = Md(
                  c,
                  d,
                  t.memoizedProps
                ) : i !== d ? (i === null ? l.stateNode !== null && Od(l.stateNode) : Ad(i), d === null ? jd(
                  c,
                  t.type,
                  t.stateNode
                ) : Md(
                  c,
                  d,
                  t.memoizedProps
                )) : d === null && t.stateNode !== null && io(
                  t,
                  t.memoizedProps,
                  l.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Jt) {
              se(e, t), me(t), i & 512 && (Kt || l === null || Ke(l, l.return)), l !== null && i & 4 && io(
                t,
                t.memoizedProps,
                l.memoizedProps
              );
              break;
            }
          case 5:
            if (se(e, t), me(t), i & 512 && (Kt || l === null || Ke(l, l.return)), ce) {
              if (t.flags & 32) {
                c = t.stateNode;
                try {
                  xd(c);
                } catch (P) {
                  zt(t, t.return, P);
                }
              }
              i & 4 && t.stateNode != null && (c = t.memoizedProps, io(
                t,
                c,
                l !== null ? l.memoizedProps : c
              )), i & 1024 && ($o = !0);
            } else
              Xe && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (se(e, t), me(t), i & 4 && ce) {
              if (t.stateNode === null)
                throw Error(s(162));
              i = t.memoizedProps, l = l !== null ? l.memoizedProps : i, c = t.stateNode;
              try {
                Th(c, l, i);
              } catch (P) {
                zt(t, t.return, P);
              }
            }
            break;
          case 3:
            if (Ge ? (_g(), c = Ye, Ye = Ro(e.containerInfo), se(e, t), Ye = c) : se(e, t), me(t), i & 4) {
              if (ce && ue && l !== null && l.memoizedState.isDehydrated)
                try {
                  cg(e.containerInfo);
                } catch (P) {
                  zt(t, t.return, P);
                }
              if (Xe) {
                i = e.containerInfo, l = e.pendingChildren;
                try {
                  kd(i, l);
                } catch (P) {
                  zt(t, t.return, P);
                }
              }
            }
            $o && ($o = !1, Ou(t));
            break;
          case 4:
            Ge ? (l = Ye, Ye = Ro(
              t.stateNode.containerInfo
            ), se(e, t), me(t), Ye = l) : (se(e, t), me(t)), i & 4 && Xe && zu(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            se(e, t), me(t);
            break;
          case 31:
            se(e, t), me(t), i & 4 && (i = t.updateQueue, i !== null && (t.updateQueue = null, si(t, i)));
            break;
          case 13:
            se(e, t), me(t), t.child.flags & 8192 && t.memoizedState !== null != (l !== null && l.memoizedState !== null) && (Di = ge()), i & 4 && (i = t.updateQueue, i !== null && (t.updateQueue = null, si(t, i)));
            break;
          case 22:
            c = t.memoizedState !== null;
            var w = l !== null && l.memoizedState !== null, M = un, V = Kt;
            if (un = M || c, Kt = V || w, se(e, t), Kt = V, un = M, me(t), i & 8192 && (e = t.stateNode, e._visibility = c ? e._visibility & -2 : e._visibility | 1, c && (l === null || w || un || Kt || Fn(t)), ce)) {
              t: if (l = null, ce)
                for (e = t; ; ) {
                  if (e.tag === 5 || Ge && e.tag === 26) {
                    if (l === null) {
                      w = l = e;
                      try {
                        d = w.stateNode, c ? Dh(d) : Hh(
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
                        c ? Bh($) : Uh($, w.memoizedProps);
                      } catch (P) {
                        zt(w, w.return, P);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (l === null) {
                      w = e;
                      try {
                        var nt = w.stateNode;
                        c ? gg(nt) : bg(w.stateNode);
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
            i & 4 && (i = t.updateQueue, i !== null && (l = i.retryQueue, l !== null && (i.retryQueue = null, si(t, l))));
            break;
          case 19:
            se(e, t), me(t), i & 4 && (i = t.updateQueue, i !== null && (t.updateQueue = null, si(t, i)));
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
            for (var l, i = t.return; i !== null; ) {
              if (Eu(i)) {
                l = i;
                break;
              }
              i = i.return;
            }
            if (ce) {
              if (l == null) throw Error(s(160));
              switch (l.tag) {
                case 27:
                  if (Jt) {
                    var c = l.stateNode, d = ro(t);
                    oi(t, d, c);
                    break;
                  }
                case 5:
                  var w = l.stateNode;
                  l.flags & 32 && (xd(w), l.flags &= -33);
                  var M = ro(t);
                  oi(t, M, w);
                  break;
                case 3:
                case 4:
                  var V = l.stateNode.containerInfo, $ = ro(t);
                  oo(
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
      function Ou(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            Ou(e), e.tag === 5 && e.flags & 1024 && bh(e.stateNode), t = t.sibling;
          }
      }
      function nn(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            Tu(t, e.alternate, e), e = e.sibling;
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
              typeof l.componentWillUnmount == "function" && ku(
                e,
                e.return,
                l
              ), Fn(e);
              break;
            case 27:
              Jt && Bd(e.stateNode);
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
          var i = e.alternate, c = t, d = e, w = d.flags;
          switch (d.tag) {
            case 0:
            case 11:
            case 15:
              an(
                c,
                d,
                l
              ), el(4, d);
              break;
            case 1:
              if (an(
                c,
                d,
                l
              ), i = d, c = i.stateNode, typeof c.componentDidMount == "function")
                try {
                  c.componentDidMount();
                } catch ($) {
                  zt(i, i.return, $);
                }
              if (i = d, c = i.updateQueue, c !== null) {
                var M = i.stateNode;
                try {
                  var V = c.shared.hiddenCallbacks;
                  if (V !== null)
                    for (c.shared.hiddenCallbacks = null, c = 0; c < V.length; c++)
                      pc(V[c], M);
                } catch ($) {
                  zt(i, i.return, $);
                }
              }
              l && w & 64 && _u(d), nl(d, d.return);
              break;
            case 27:
              Jt && Nu(d);
            case 26:
            case 5:
              an(
                c,
                d,
                l
              ), l && i === null && w & 4 && Su(d), nl(d, d.return);
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
              ), l && w & 4 && Mu(c, d);
              break;
            case 13:
              an(
                c,
                d,
                l
              ), l && w & 4 && Au(c, d);
              break;
            case 22:
              d.memoizedState === null && an(
                c,
                d,
                l
              ), nl(d, d.return);
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
      function co(t, e) {
        var l = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (l = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== l && (t != null && t.refCount++, l != null && Xa(l));
      }
      function uo(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Xa(t));
      }
      function qe(t, e, l, i) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            Ru(
              t,
              e,
              l,
              i
            ), e = e.sibling;
      }
      function Ru(t, e, l, i) {
        var c = e.flags;
        switch (e.tag) {
          case 0:
          case 11:
          case 15:
            qe(
              t,
              e,
              l,
              i
            ), c & 2048 && el(9, e);
            break;
          case 1:
            qe(
              t,
              e,
              l,
              i
            );
            break;
          case 3:
            qe(
              t,
              e,
              l,
              i
            ), c & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Xa(t)));
            break;
          case 12:
            if (c & 2048) {
              qe(
                t,
                e,
                l,
                i
              ), t = e.stateNode;
              try {
                var d = e.memoizedProps, w = d.id, M = d.onPostCommit;
                typeof M == "function" && M(
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
                i
              );
            break;
          case 31:
            qe(
              t,
              e,
              l,
              i
            );
            break;
          case 13:
            qe(
              t,
              e,
              l,
              i
            );
            break;
          case 23:
            break;
          case 22:
            d = e.stateNode, w = e.alternate, e.memoizedState !== null ? d._visibility & 2 ? qe(
              t,
              e,
              l,
              i
            ) : al(
              t,
              e
            ) : d._visibility & 2 ? qe(
              t,
              e,
              l,
              i
            ) : (d._visibility |= 2, ga(
              t,
              e,
              l,
              i,
              (e.subtreeFlags & 10256) !== 0 || !1
            )), c & 2048 && co(w, e);
            break;
          case 24:
            qe(
              t,
              e,
              l,
              i
            ), c & 2048 && uo(e.alternate, e);
            break;
          default:
            qe(
              t,
              e,
              l,
              i
            );
        }
      }
      function ga(t, e, l, i, c) {
        for (c = c && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var d = t, w = e, M = l, V = i, $ = w.flags;
          switch (w.tag) {
            case 0:
            case 11:
            case 15:
              ga(
                d,
                w,
                M,
                V,
                c
              ), el(8, w);
              break;
            case 23:
              break;
            case 22:
              var nt = w.stateNode;
              w.memoizedState !== null ? nt._visibility & 2 ? ga(
                d,
                w,
                M,
                V,
                c
              ) : al(
                d,
                w
              ) : (nt._visibility |= 2, ga(
                d,
                w,
                M,
                V,
                c
              )), c && $ & 2048 && co(
                w.alternate,
                w
              );
              break;
            case 24:
              ga(
                d,
                w,
                M,
                V,
                c
              ), c && $ & 2048 && uo(w.alternate, w);
              break;
            default:
              ga(
                d,
                w,
                M,
                V,
                c
              );
          }
          e = e.sibling;
        }
      }
      function al(t, e) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; ) {
            var l = t, i = e, c = i.flags;
            switch (i.tag) {
              case 22:
                al(l, i), c & 2048 && co(
                  i.alternate,
                  i
                );
                break;
              case 24:
                al(l, i), c & 2048 && uo(
                  i.alternate,
                  i
                );
                break;
              default:
                al(l, i);
            }
            e = e.sibling;
          }
      }
      function $n(t, e, l) {
        if (t.subtreeFlags & Ba)
          for (t = t.child; t !== null; )
            Du(
              t,
              e,
              l
            ), t = t.sibling;
      }
      function Du(t, e, l) {
        switch (t.tag) {
          case 26:
            if ($n(
              t,
              e,
              l
            ), t.flags & Ba)
              if (t.memoizedState !== null)
                Sg(
                  l,
                  Ye,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var i = t.stateNode, c = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || Ao(c, t)) && yd(l, i, c, t);
              }
            break;
          case 5:
            $n(
              t,
              e,
              l
            ), t.flags & Ba && (i = t.stateNode, c = t.type, t = t.memoizedProps, ((e & 335544128) === e || Ao(c, t)) && yd(l, i, c, t));
            break;
          case 3:
          case 4:
            Ge ? (i = Ye, Ye = Ro(
              t.stateNode.containerInfo
            ), $n(
              t,
              e,
              l
            ), Ye = i) : $n(
              t,
              e,
              l
            );
            break;
          case 22:
            t.memoizedState === null && (i = t.alternate, i !== null && i.memoizedState !== null ? (i = Ba, Ba = 16777216, $n(
              t,
              e,
              l
            ), Ba = i) : $n(
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
      function Bu(t) {
        var e = t.alternate;
        if (e !== null && (t = e.child, t !== null)) {
          e.child = null;
          do
            e = t.sibling, t.sibling = null, t = e;
          while (t !== null);
        }
      }
      function ll(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var l = 0; l < e.length; l++) {
              var i = e[l];
              Pt = i, Uu(
                i,
                t
              );
            }
          Bu(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            Hu(t), t = t.sibling;
      }
      function Hu(t) {
        switch (t.tag) {
          case 0:
          case 11:
          case 15:
            ll(t), t.flags & 2048 && _n(9, t, t.return);
            break;
          case 3:
            ll(t);
            break;
          case 12:
            ll(t);
            break;
          case 22:
            var e = t.stateNode;
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, ci(t)) : ll(t);
            break;
          default:
            ll(t);
        }
      }
      function ci(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var l = 0; l < e.length; l++) {
              var i = e[l];
              Pt = i, Uu(
                i,
                t
              );
            }
          Bu(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              _n(8, e, e.return), ci(e);
              break;
            case 22:
              l = e.stateNode, l._visibility & 2 && (l._visibility &= -3, ci(e));
              break;
            default:
              ci(e);
          }
          t = t.sibling;
        }
      }
      function Uu(t, e) {
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
                var i = l.memoizedState.cachePool.pool;
                i != null && i.refCount++;
              }
              break;
            case 24:
              Xa(l.memoizedState.cache);
          }
          if (i = l.child, i !== null) i.return = l, Pt = i;
          else
            t: for (l = t; Pt !== null; ) {
              i = Pt;
              var c = i.sibling, d = i.return;
              if (Cu(i), i === l) {
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
      function fo(t) {
        var e = sh(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(s(364));
          return e;
        }
        if (t = xh(t), t === null) throw Error(s(362));
        return t.stateNode.current;
      }
      function mo(t, e) {
        var l = t.tag;
        switch (e.$$typeof) {
          case Mi:
            if (t.type === e.value) return !0;
            break;
          case Ai:
            t: {
              for (e = e.value, t = [t, 0], l = 0; l < t.length; ) {
                var i = t[l++], c = i.tag, d = t[l++], w = e[d];
                if (c !== 5 && c !== 26 && c !== 27 || !sl(i)) {
                  for (; w != null && mo(i, w); )
                    d++, w = e[d];
                  if (d === e.length) {
                    e = !0;
                    break t;
                  } else
                    for (i = i.child; i !== null; )
                      t.push(i, d), i = i.sibling;
                }
              }
              e = !1;
            }
            return e;
          case ji:
            if ((l === 5 || l === 26 || l === 27) && kh(t.stateNode, e.value))
              return !0;
            break;
          case Ri:
            if ((l === 5 || l === 6 || l === 26 || l === 27) && (t = _h(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case Oi:
            if ((l === 5 || l === 26 || l === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(s(365));
        }
        return !1;
      }
      function po(t) {
        switch (t.$$typeof) {
          case Mi:
            return "<" + (y(t.value) || "Unknown") + ">";
          case Ai:
            return ":has(" + (po(t) || "") + ")";
          case ji:
            return '[role="' + t.value + '"]';
          case Ri:
            return '"' + t.value + '"';
          case Oi:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(s(365));
        }
      }
      function qu(t, e) {
        var l = [];
        t = [t, 0];
        for (var i = 0; i < t.length; ) {
          var c = t[i++], d = c.tag, w = t[i++], M = e[w];
          if (d !== 5 && d !== 26 && d !== 27 || !sl(c)) {
            for (; M != null && mo(c, M); )
              w++, M = e[w];
            if (w === e.length) l.push(c);
            else
              for (c = c.child; c !== null; )
                t.push(c, w), c = c.sibling;
          }
        }
        return l;
      }
      function ho(t, e) {
        if (!ol) throw Error(s(363));
        t = fo(t), t = qu(t, e), e = [], t = Array.from(t);
        for (var l = 0; l < t.length; ) {
          var i = t[l++], c = i.tag;
          if (c === 5 || c === 26 || c === 27)
            sl(i) || e.push(i.stateNode);
          else
            for (i = i.child; i !== null; )
              t.push(i), i = i.sibling;
        }
        return e;
      }
      function xe() {
        return (wt & 2) !== 0 && kt !== 0 ? kt & -kt : dt.T !== null ? kr() : uh();
      }
      function Gu() {
        if (Ne === 0)
          if ((kt & 536870912) === 0 || St) {
            var t = bi;
            bi <<= 1, (bi & 3932160) === 0 && (bi = 262144), Ne = t;
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
      function Yu(t, e, l) {
        if ((wt & 6) !== 0) throw Error(s(327));
        var i = !l && (e & 127) === 0 && (e & t.expiredLanes) === 0 || R(t, e), c = i ? Yp(t, e) : bo(t, e, !0), d = i;
        do {
          if (c === 0) {
            Ha && !i && kn(t, e, 0, !1);
            break;
          } else {
            if (l = t.current.alternate, d && !qp(l)) {
              c = bo(t, e, !1), d = !1;
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
                  var M = t;
                  c = bl;
                  var V = ue && M.current.memoizedState.isDehydrated;
                  if (V && (ba(M, w).flags |= 256), w = bo(
                    M,
                    w,
                    !1
                  ), w !== 2) {
                    if (Io && !V) {
                      M.errorRecoveryDisabledLanes |= d, oa |= d, c = 4;
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
              switch (i = t, d = c, d) {
                case 0:
                case 1:
                  throw Error(s(345));
                case 4:
                  if ((e & 4194048) !== e) break;
                case 6:
                  kn(
                    i,
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
              if ((e & 62914560) === e && (c = Di + 300 - ge(), 10 < c)) {
                if (kn(
                  i,
                  e,
                  Ne,
                  !Mn
                ), j(i, 0, !0) !== 0) break t;
                fn = e, i.timeoutHandle = rh(
                  Lu.bind(
                    null,
                    i,
                    l,
                    ve,
                    Bi,
                    ts,
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
              Lu(
                i,
                l,
                ve,
                Bi,
                ts,
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
      function Lu(t, e, l, i, c, d, w, M, V, $, nt, P, lt, gt) {
        if (t.timeoutHandle = Pn, P = e.subtreeFlags, P & 8192 || (P & 16785408) === 16785408) {
          P = hh(), Du(
            e,
            d,
            P
          );
          var ie = (d & 62914560) === d ? Di - ge() : (d & 4194048) === d ? Zd - ge() : 0;
          if (ie = gh(
            P,
            ie
          ), ie !== null) {
            fn = d, t.cancelPendingCommit = ie(
              $u.bind(
                null,
                t,
                e,
                d,
                l,
                i,
                c,
                w,
                M,
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
        $u(
          t,
          e,
          d,
          l,
          i,
          c,
          w,
          M,
          V
        );
      }
      function qp(t) {
        for (var e = t; ; ) {
          var l = e.tag;
          if ((l === 0 || l === 11 || l === 15) && e.flags & 16384 && (l = e.updateQueue, l !== null && (l = l.stores, l !== null)))
            for (var i = 0; i < l.length; i++) {
              var c = l[i], d = c.getSnapshot;
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
      function kn(t, e, l, i) {
        e &= ~Po, e &= ~oa, t.suspendedLanes |= e, t.pingedLanes &= ~e, i && (t.warmLanes |= e), i = t.expirationTimes;
        for (var c = e; 0 < c; ) {
          var d = 31 - _e(c), w = 1 << d;
          i[d] = -1, c &= ~w;
        }
        l !== 0 && h(t, l, e);
      }
      function Vu() {
        return (wt & 6) === 0 ? (pa(0), !1) : !0;
      }
      function go() {
        if (_t !== null) {
          if (Ct === 0)
            var t = _t.return;
          else
            t = _t, sn = ea = null, Br(t), Aa = null, ml = 0, t = _t;
          for (; t !== null; )
            wu(t.alternate, t), t = t.return;
          _t = null;
        }
      }
      function ba(t, e) {
        var l = t.timeoutHandle;
        l !== Pn && (t.timeoutHandle = Pn, oh(l)), l = t.cancelPendingCommit, l !== null && (t.cancelPendingCommit = null, l()), fn = 0, go(), At = t, _t = l = ln(t.current, null), kt = e, Ct = 0, ze = null, Mn = !1, Ha = R(t, e), Io = !1, Ua = Ne = Po = oa = An = qt = 0, ve = bl = null, ts = !1, (e & 8) !== 0 && (e |= e & 32);
        var i = t.entangledLanes;
        if (i !== 0)
          for (t = t.entanglements, i &= e; 0 < i; ) {
            var c = 31 - _e(i), d = 1 << c;
            e |= t[c], i &= ~d;
          }
        return dn = e, Kl(), l;
      }
      function Qu(t, e) {
        vt = null, dt.H = hl, e === Ma || e === Ei ? (e = uc(), Ct = 3) : e === Qo ? (e = uc(), Ct = 4) : Ct = e === Wo ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, ze = e, _t === null && (qt = 1, ei(
          t,
          Y(e, t.current)
        ));
      }
      function Ku() {
        var t = Ee.current;
        return t === null ? !0 : (kt & 4194048) === kt ? Oe === null : (kt & 62914560) === kt || (kt & 536870912) !== 0 ? t === Oe : !1;
      }
      function Xu() {
        var t = dt.H;
        return dt.H = hl, t === null ? hl : t;
      }
      function Zu() {
        var t = dt.A;
        return dt.A = qg, t;
      }
      function ui() {
        qt = 4, Mn || (kt & 4194048) !== kt && Ee.current !== null || (Ha = !0), (An & 134217727) === 0 && (oa & 134217727) === 0 || At === null || kn(
          At,
          kt,
          Ne,
          !1
        );
      }
      function bo(t, e, l) {
        var i = wt;
        wt |= 2;
        var c = Xu(), d = Zu();
        (At !== t || kt !== e) && (Bi = null, ba(t, e)), e = !1;
        var w = qt;
        t: do
          try {
            if (Ct !== 0 && _t !== null) {
              var M = _t, V = ze;
              switch (Ct) {
                case 8:
                  go(), w = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  Ee.current === null && (e = !0);
                  var $ = Ct;
                  if (Ct = 0, ze = null, va(t, M, V, $), l && Ha) {
                    w = 0;
                    break t;
                  }
                  break;
                default:
                  $ = Ct, Ct = 0, ze = null, va(t, M, V, $);
              }
            }
            Gp(), w = qt;
            break;
          } catch (nt) {
            Qu(t, nt);
          }
        while (!0);
        return e && t.shellSuspendCounter++, sn = ea = null, wt = i, dt.H = c, dt.A = d, _t === null && (At = null, kt = 0, Kl()), w;
      }
      function Gp() {
        for (; _t !== null; ) Ju(_t);
      }
      function Yp(t, e) {
        var l = wt;
        wt |= 2;
        var i = Xu(), c = Zu();
        At !== t || kt !== e ? (Bi = null, vl = ge() + 500, ba(t, e)) : Ha = R(
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
                  if (sc(d)) {
                    Ct = 0, ze = null, Wu(e);
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
                  sc(d) ? (Ct = 0, ze = null, Wu(e)) : (Ct = 0, ze = null, va(t, e, d, 7));
                  break;
                case 5:
                  var w = null;
                  switch (_t.tag) {
                    case 26:
                      w = _t.memoizedState;
                    case 5:
                    case 27:
                      var M = _t, V = M.type, $ = M.pendingProps;
                      if (w ? Rd(w) : vd(M.stateNode, V, $)) {
                        Ct = 0, ze = null;
                        var nt = M.sibling;
                        if (nt !== null) _t = nt;
                        else {
                          var P = M.return;
                          P !== null ? (_t = P, di(P)) : _t = null;
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
                  go(), qt = 6;
                  break t;
                default:
                  throw Error(s(462));
              }
            }
            Lp();
            break;
          } catch (lt) {
            Qu(t, lt);
          }
        while (!0);
        return sn = ea = null, dt.H = i, dt.A = c, wt = l, _t !== null ? 0 : (At = null, kt = 0, Kl(), qt);
      }
      function Lp() {
        for (; _t !== null && !Tg(); )
          Ju(_t);
      }
      function Ju(t) {
        var e = gu(
          t.alternate,
          t,
          dn
        );
        t.memoizedProps = t.pendingProps, e === null ? di(t) : _t = e;
      }
      function Wu(t) {
        var e = t, l = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = uu(
              l,
              e,
              e.pendingProps,
              e.type,
              void 0,
              kt
            );
            break;
          case 11:
            e = uu(
              l,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              kt
            );
            break;
          case 5:
            Br(e);
          default:
            wu(l, e), e = _t = id(e, dn), e = gu(l, e, dn);
        }
        t.memoizedProps = t.pendingProps, e === null ? di(t) : _t = e;
      }
      function va(t, e, l, i) {
        sn = ea = null, Br(e), Aa = null, ml = 0;
        var c = e.return;
        try {
          if (jp(
            t,
            c,
            e,
            l,
            kt
          )) {
            qt = 1, ei(
              t,
              Y(l, t.current)
            ), _t = null;
            return;
          }
        } catch (d) {
          if (c !== null) throw _t = c, d;
          qt = 1, ei(
            t,
            Y(l, t.current)
          ), _t = null;
          return;
        }
        e.flags & 32768 ? (St || i === 1 ? t = !0 : Ha || (kt & 536870912) !== 0 ? t = !1 : (Mn = t = !0, (i === 2 || i === 9 || i === 3 || i === 6) && (i = Ee.current, i !== null && i.tag === 13 && (i.flags |= 16384))), Fu(e, t)) : di(e);
      }
      function di(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            Fu(
              e,
              Mn
            );
            return;
          }
          t = e.return;
          var l = Dp(
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
      function Fu(t, e) {
        do {
          var l = Bp(t.alternate, t);
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
      function $u(t, e, l, i, c, d, w, M, V) {
        t.cancelPendingCommit = null;
        do
          il();
        while (Wt !== 0);
        if ((wt & 6) !== 0) throw Error(s(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(s(177));
          if (d = e.lanes | e.childLanes, d |= Ko, g(
            t,
            l,
            d,
            w,
            M,
            V
          ), t === At && (_t = At = null, kt = 0), qa = e, On = t, fn = l, es = d, ns = c, Jd = i, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, Xp(Ho, function() {
            return nd(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), i = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || i) {
            i = dt.T, dt.T = null, c = on(), It(2), w = wt, wt |= 4;
            try {
              Hp(t, e, l);
            } finally {
              wt = w, It(c), dt.T = i;
            }
          }
          Wt = 1, Iu(), Pu(), td();
        }
      }
      function Iu() {
        if (Wt === 1) {
          Wt = 0;
          var t = On, e = qa, l = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || l) {
            l = dt.T, dt.T = null;
            var i = on();
            It(2);
            var c = wt;
            wt |= 4;
            try {
              ju(e, t), lh(t.containerInfo);
            } finally {
              wt = c, It(i), dt.T = l;
            }
          }
          t.current = e, Wt = 2;
        }
      }
      function Pu() {
        if (Wt === 2) {
          Wt = 0;
          var t = On, e = qa, l = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || l) {
            l = dt.T, dt.T = null;
            var i = on();
            It(2);
            var c = wt;
            wt |= 4;
            try {
              Tu(t, e.alternate, e);
            } finally {
              wt = c, It(i), dt.T = l;
            }
          }
          Wt = 3;
        }
      }
      function td() {
        if (Wt === 4 || Wt === 3) {
          Wt = 0, Cg();
          var t = On, e = qa, l = fn, i = Jd;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Wt = 5 : (Wt = 0, qa = On = null, ed(t, t.pendingLanes));
          var c = t.pendingLanes;
          if (c === 0 && (jn = null), O(l), e = e.stateNode, ke && typeof ke.onCommitFiberRoot == "function")
            try {
              ke.onCommitFiberRoot(
                cl,
                e,
                void 0,
                (e.current.flags & 128) === 128
              );
            } catch {
            }
          if (i !== null) {
            e = dt.T, c = on(), It(2), dt.T = null;
            try {
              for (var d = t.onRecoverableError, w = 0; w < i.length; w++) {
                var M = i[w];
                d(M.value, {
                  componentStack: M.stack
                });
              }
            } finally {
              dt.T = e, It(c);
            }
          }
          (fn & 3) !== 0 && il(), Qe(t), c = t.pendingLanes, (l & 261930) !== 0 && (c & 42) !== 0 ? t === as ? yl++ : (yl = 0, as = t) : yl = 0, ue && mg(), pa(0);
        }
      }
      function ed(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Xa(e)));
      }
      function il() {
        return Iu(), Pu(), td(), nd();
      }
      function nd() {
        if (Wt !== 5) return !1;
        var t = On, e = es;
        es = 0;
        var l = O(fn), i = 32 > l ? 32 : l;
        l = dt.T;
        var c = on();
        try {
          It(i), dt.T = null, i = ns, ns = null;
          var d = On, w = fn;
          if (Wt = 0, qa = On = null, fn = 0, (wt & 6) !== 0)
            throw Error(s(331));
          var M = wt;
          if (wt |= 4, Hu(d.current), Ru(
            d,
            d.current,
            w,
            i
          ), wt = M, pa(0, !1), ke && typeof ke.onPostCommitFiberRoot == "function")
            try {
              ke.onPostCommitFiberRoot(cl, d);
            } catch {
            }
          return !0;
        } finally {
          It(c), dt.T = l, ed(t, e);
        }
      }
      function ad(t, e, l) {
        e = Y(l, e), e = Jr(t.stateNode, e, 2), t = yn(t, e, 2), t !== null && (B(t, 2), Qe(t));
      }
      function zt(t, e, l) {
        if (t.tag === 3)
          ad(t, t, l);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              ad(
                e,
                t,
                l
              );
              break;
            } else if (e.tag === 1) {
              var i = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof i.componentDidCatch == "function" && (jn === null || !jn.has(i))) {
                t = Y(l, t), l = nu(2), i = yn(e, l, 2), i !== null && (au(
                  l,
                  i,
                  e,
                  t
                ), B(i, 2), Qe(i));
                break;
              }
            }
            e = e.return;
          }
      }
      function vo(t, e, l) {
        var i = t.pingCache;
        if (i === null) {
          i = t.pingCache = new Gg();
          var c = /* @__PURE__ */ new Set();
          i.set(e, c);
        } else
          c = i.get(e), c === void 0 && (c = /* @__PURE__ */ new Set(), i.set(e, c));
        c.has(l) || (Io = !0, c.add(l), t = Vp.bind(null, t, e, l), e.then(t, t));
      }
      function Vp(t, e, l) {
        var i = t.pingCache;
        i !== null && i.delete(e), t.pingedLanes |= t.suspendedLanes & l, t.warmLanes &= ~l, At === t && (kt & l) === l && (qt === 4 || qt === 3 && (kt & 62914560) === kt && 300 > ge() - Di ? (wt & 2) === 0 && ba(t, 0) : Po |= l, Ua === kt && (Ua = 0)), Qe(t);
      }
      function ld(t, e) {
        e === 0 && (e = F()), t = Jn(t, e), t !== null && (B(t, e), Qe(t));
      }
      function Qp(t) {
        var e = t.memoizedState, l = 0;
        e !== null && (l = e.retryLane), ld(t, l);
      }
      function Kp(t, e) {
        var l = 0;
        switch (t.tag) {
          case 31:
          case 13:
            var i = t.stateNode, c = t.memoizedState;
            c !== null && (l = c.retryLane);
            break;
          case 19:
            i = t.stateNode;
            break;
          case 22:
            i = t.stateNode._retryCache;
            break;
          default:
            throw Error(s(314));
        }
        i !== null && i.delete(e), ld(t, l);
      }
      function Xp(t, e) {
        return yi(t, e);
      }
      function Zp(t, e, l, i) {
        this.tag = t, this.key = l, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = i, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function yo(t) {
        return t = t.prototype, !(!t || !t.isReactComponent);
      }
      function ln(t, e) {
        var l = t.alternate;
        return l === null ? (l = r(
          t.tag,
          e,
          t.key,
          t.mode
        ), l.elementType = t.elementType, l.type = t.type, l.stateNode = t.stateNode, l.alternate = t, t.alternate = l) : (l.pendingProps = e, l.type = t.type, l.flags = 0, l.subtreeFlags = 0, l.deletions = null), l.flags = t.flags & 65011712, l.childLanes = t.childLanes, l.lanes = t.lanes, l.child = t.child, l.memoizedProps = t.memoizedProps, l.memoizedState = t.memoizedState, l.updateQueue = t.updateQueue, e = t.dependencies, l.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }, l.sibling = t.sibling, l.index = t.index, l.ref = t.ref, l.refCleanup = t.refCleanup, l;
      }
      function id(t, e) {
        t.flags &= 65011714;
        var l = t.alternate;
        return l === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = l.childLanes, t.lanes = l.lanes, t.child = l.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = l.memoizedProps, t.memoizedState = l.memoizedState, t.updateQueue = l.updateQueue, t.type = l.type, e = l.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function fi(t, e, l, i, c, d) {
        var w = 0;
        if (i = t, typeof t == "function") yo(t) && (w = 1);
        else if (typeof t == "string")
          w = Ge && Jt ? Td(t, l, ae.current) ? 26 : Hd(t) ? 27 : 5 : Ge ? Td(
            t,
            l,
            ae.current
          ) ? 26 : 5 : Jt && Hd(t) ? 27 : 5;
        else
          t: switch (t) {
            case Co:
              return t = r(31, l, e, c), t.elementType = Co, t.lanes = d, t;
            case xa:
              return In(
                l.children,
                c,
                d,
                e
              );
            case fd:
              w = 8, c |= 24;
              break;
            case So:
              return t = r(12, l, e, c | 2), t.elementType = So, t.lanes = d, t;
            case zo:
              return t = r(13, l, e, c), t.elementType = zo, t.lanes = d, t;
            case No:
              return t = r(19, l, e, c), t.elementType = No, t.lanes = d, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case Sn:
                    w = 10;
                    break t;
                  case md:
                    w = 9;
                    break t;
                  case Eo:
                    w = 11;
                    break t;
                  case To:
                    w = 14;
                    break t;
                  case En:
                    w = 16, i = null;
                    break t;
                }
              w = 29, l = Error(
                s(
                  130,
                  t === null ? "null" : typeof t,
                  ""
                )
              ), i = null;
          }
        return e = r(w, l, e, c), e.elementType = t, e.type = i, e.lanes = d, e;
      }
      function In(t, e, l, i) {
        return t = r(7, t, i, e), t.lanes = l, t;
      }
      function xo(t, e, l) {
        return t = r(6, t, null, e), t.lanes = l, t;
      }
      function rd(t) {
        var e = r(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function wo(t, e, l) {
        return e = r(
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
      function Jp(t, e, l, i, c, d, w, M, V) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Pn, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = J(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = J(0), this.hiddenUpdates = J(null), this.identifierPrefix = i, this.onUncaughtError = c, this.onCaughtError = d, this.onRecoverableError = w, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = V, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function od(t, e, l, i, c, d, w, M, V, $, nt, P) {
        return t = new Jp(
          t,
          e,
          l,
          w,
          V,
          $,
          nt,
          P,
          M
        ), e = 1, d === !0 && (e |= 24), d = r(3, null, null, e), t.current = d, d.stateNode = t, e = _r(), e.refCount++, t.pooledCache = e, e.refCount++, d.memoizedState = {
          element: i,
          isDehydrated: l,
          cache: e
        }, zr(d), t;
      }
      function sd(t) {
        return t ? (t = Sa, t) : Sa;
      }
      function cd(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(s(188)) : (t = Object.keys(t).join(","), Error(s(268, t)));
        return t = f(e), t = t !== null ? p(t) : null, t === null ? null : rl(t.stateNode);
      }
      function ud(t, e, l, i, c, d) {
        c = sd(c), i.context === null ? i.context = c : i.pendingContext = c, i = vn(e), i.payload = { element: l }, d = d === void 0 ? null : d, d !== null && (i.callback = d), l = yn(t, i, e), l !== null && (he(l, t, e), Ja(l, t, e));
      }
      function dd(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var l = t.retryLane;
          t.retryLane = l !== 0 && l < e ? l : e;
        }
      }
      function _o(t, e) {
        dd(t, e), (t = t.alternate) && dd(t, e);
      }
      var xt = {}, Wp = h0, we = dm(), ko = Object.assign, Fp = Symbol.for("react.element"), mi = Symbol.for("react.transitional.element"), ya = Symbol.for("react.portal"), xa = Symbol.for("react.fragment"), fd = Symbol.for("react.strict_mode"), So = Symbol.for("react.profiler"), md = Symbol.for("react.consumer"), Sn = Symbol.for("react.context"), Eo = Symbol.for("react.forward_ref"), zo = Symbol.for("react.suspense"), No = Symbol.for("react.suspense_list"), To = Symbol.for("react.memo"), En = Symbol.for("react.lazy"), Co = Symbol.for("react.activity"), $p = Symbol.for("react.memo_cache_sentinel"), pd = Symbol.iterator, Ip = Symbol.for("react.client.reference"), pi = Array.isArray, dt = Wp.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Pp = a.rendererVersion, th = a.rendererPackageName, hd = a.extraDevToolsConfig, rl = a.getPublicInstance, eh = a.getRootHostContext, nh = a.getChildHostContext, ah = a.prepareForCommit, lh = a.resetAfterCommit, ih = a.createInstance;
      a.cloneMutableInstance;
      var Mo = a.appendInitialChild, gd = a.finalizeInitialChildren, hi = a.shouldSetTextContent, bd = a.createTextInstance;
      a.cloneMutableTextInstance;
      var rh = a.scheduleTimeout, oh = a.cancelTimeout, Pn = a.noTimeout, rn = a.isPrimaryRenderer;
      a.warnsIfNotActing;
      var ce = a.supportsMutation, Xe = a.supportsPersistence, ue = a.supportsHydration, sh = a.getInstanceFromNode;
      a.beforeActiveInstanceBlur;
      var ch = a.preparePortalMount;
      a.prepareScopeUpdate, a.getInstanceFromScope;
      var It = a.setCurrentUpdatePriority, on = a.getCurrentUpdatePriority, uh = a.resolveUpdatePriority;
      a.trackSchedulerEvent, a.resolveEventType, a.resolveEventTimeStamp;
      var dh = a.shouldAttemptEagerTransition, fh = a.detachDeletedInstance;
      a.requestPostPaintCallback;
      var mh = a.maySuspendCommit, ph = a.maySuspendCommitOnUpdate, Ao = a.maySuspendCommitInSyncRender, vd = a.preloadInstance, hh = a.startSuspendingCommit, yd = a.suspendInstance;
      a.suspendOnActiveViewTransition;
      var gh = a.waitForCommitToBeReady;
      a.getSuspendedCommitReason;
      var wa = a.NotPendingTransition, ta = a.HostTransitionContext, bh = a.resetFormInstance;
      a.bindToConsole;
      var vh = a.supportsMicrotasks, yh = a.scheduleMicrotask, ol = a.supportsTestSelectors, xh = a.findFiberRoot, wh = a.getBoundingRect, _h = a.getTextContent, sl = a.isHiddenSubtree, kh = a.matchAccessibilityRole, Sh = a.setFocusIfFocusable, Eh = a.setupIntersectionObserver, zh = a.appendChild, Nh = a.appendChildToContainer, Th = a.commitTextUpdate, Ch = a.commitMount, Mh = a.commitUpdate, Ah = a.insertBefore, jh = a.insertInContainerBefore, Oh = a.removeChild, Rh = a.removeChildFromContainer, xd = a.resetTextContent, Dh = a.hideInstance, Bh = a.hideTextInstance, Hh = a.unhideInstance, Uh = a.unhideTextInstance;
      a.cancelViewTransitionName, a.cancelRootViewTransitionName, a.restoreRootViewTransitionName, a.cloneRootViewTransitionContainer, a.removeRootViewTransitionClone, a.measureClonedInstance, a.hasInstanceChanged, a.hasInstanceAffectedParent, a.startViewTransition, a.startGestureTransition, a.stopViewTransition, a.getCurrentGestureOffset, a.createViewTransitionInstance;
      var qh = a.clearContainer;
      a.createFragmentInstance, a.updateFragmentInstanceFiber, a.commitNewChildToFragmentInstance, a.deleteChildFromFragmentInstance;
      var Gh = a.cloneInstance, wd = a.createContainerChildSet, _d = a.appendChildToContainerChildSet, Yh = a.finalizeContainerChildren, kd = a.replaceContainerChildren, Sd = a.cloneHiddenInstance, Ed = a.cloneHiddenTextInstance, jo = a.isSuspenseInstancePending, Oo = a.isSuspenseInstanceFallback, Lh = a.getSuspenseInstanceFallbackErrorDetails, Vh = a.registerSuspenseInstanceRetry, Qh = a.canHydrateFormStateMarker, Kh = a.isFormStateMarkerMatching, zd = a.getNextHydratableSibling, Xh = a.getNextHydratableSiblingAfterSingleton, Zh = a.getFirstHydratableChild, Jh = a.getFirstHydratableChildWithinContainer, Wh = a.getFirstHydratableChildWithinActivityInstance, Fh = a.getFirstHydratableChildWithinSuspenseInstance, $h = a.getFirstHydratableChildWithinSingleton, Ih = a.canHydrateInstance, Ph = a.canHydrateTextInstance, tg = a.canHydrateActivityInstance, eg = a.canHydrateSuspenseInstance, ng = a.hydrateInstance, ag = a.hydrateTextInstance, lg = a.hydrateActivityInstance, ig = a.hydrateSuspenseInstance, rg = a.getNextHydratableInstanceAfterActivityInstance, og = a.getNextHydratableInstanceAfterSuspenseInstance, sg = a.commitHydratedInstance, cg = a.commitHydratedContainer, ug = a.commitHydratedActivityInstance, dg = a.commitHydratedSuspenseInstance, fg = a.finalizeHydratedChildren, mg = a.flushHydrationEvents;
      a.clearActivityBoundary;
      var pg = a.clearSuspenseBoundary;
      a.clearActivityBoundaryFromContainer;
      var hg = a.clearSuspenseBoundaryFromContainer, gg = a.hideDehydratedBoundary, bg = a.unhideDehydratedBoundary, Nd = a.shouldDeleteUnhydratedTailInstances;
      a.diffHydratedPropsForDevWarnings, a.diffHydratedTextForDevWarnings, a.describeHydratableInstanceForDevWarnings;
      var vg = a.validateHydratableInstance, yg = a.validateHydratableTextInstance, Ge = a.supportsResources, Td = a.isHostHoistableType, Ro = a.getHoistableRoot, Cd = a.getResource, Md = a.acquireResource, Ad = a.releaseResource, xg = a.hydrateHoistable, jd = a.mountHoistable, Od = a.unmountHoistable, wg = a.createHoistableInstance, _g = a.prepareToCommitHoistables, kg = a.mayResourceSuspendCommit, Rd = a.preloadResource, Sg = a.suspendResource, Jt = a.supportsSingletons, Dd = a.resolveSingletonInstance, Eg = a.acquireSingletonInstance, Bd = a.releaseSingletonInstance, Hd = a.isHostSingletonType, _a = a.isSingletonScope, Do = [], ka = -1, Sa = {}, _e = Math.clz32 ? Math.clz32 : E, zg = Math.log, Ng = Math.LN2, gi = 256, bi = 262144, vi = 4194304, yi = we.unstable_scheduleCallback, Bo = we.unstable_cancelCallback, Tg = we.unstable_shouldYield, Cg = we.unstable_requestPaint, ge = we.unstable_now, Ud = we.unstable_ImmediatePriority, Mg = we.unstable_UserBlockingPriority, Ho = we.unstable_NormalPriority, Ag = we.unstable_IdlePriority, jg = we.log, Og = we.unstable_setDisableYieldValue, cl = null, ke = null, Se = typeof Object.is == "function" ? Object.is : G, qd = typeof reportError == "function" ? reportError : function(t) {
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
      }, Rg = Object.prototype.hasOwnProperty, Uo, Gd, qo = !1, Yd = /* @__PURE__ */ new WeakMap(), Ea = [], za = 0, xi = null, ul = 0, Ce = [], Me = 0, zn = null, Ze = 1, Je = "", ae = b(null), dl = b(null), Nn = b(null), wi = b(null), le = null, Rt = null, St = !1, Tn = null, Ae = !1, Go = Error(s(519)), _i = b(null), ea = null, sn = null, Dg = typeof AbortController < "u" ? AbortController : function() {
        var t = [], e = this.signal = {
          aborted: !1,
          addEventListener: function(l, i) {
            t.push(i);
          }
        };
        this.abort = function() {
          e.aborted = !0, t.forEach(function(l) {
            return l();
          });
        };
      }, Bg = we.unstable_scheduleCallback, Hg = we.unstable_NormalPriority, Dt = {
        $$typeof: Sn,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, ki = null, Na = null, Yo = !1, Si = !1, Lo = !1, na = 0, fl = null, Vo = 0, Ta = 0, Ca = null, Ld = dt.S;
      dt.S = function(t, e) {
        Zd = ge(), typeof e == "object" && e !== null && typeof e.then == "function" && Sp(t, e), Ld !== null && Ld(t, e);
      };
      var aa = b(null), Ma = Error(s(460)), Qo = Error(s(474)), Ei = Error(s(542)), zi = { then: function() {
      } }, la = null, Aa = null, ml = 0, ia = fc(!0), Vd = fc(!1), je = [], ja = 0, Ko = 0, Cn = !1, Xo = !1, Oa = b(null), Ni = b(0), Ee = b(null), Oe = null, Yt = b(0), cn = 0, vt = null, Mt = null, Vt = null, Ti = !1, Ra = !1, ra = !1, Ci = 0, pl = 0, Da = null, Ug = 0, hl = {
        readContext: ee,
        use: Fl,
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
      hl.useEffectEvent = Ut;
      var Qd = {
        readContext: ee,
        use: Fl,
        useCallback: function(t, e) {
          return fe().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: ee,
        useEffect: Hc,
        useImperativeHandle: function(t, e, l) {
          l = l != null ? l.concat([t]) : null, Il(
            4194308,
            4,
            Yc.bind(null, e, t),
            l
          );
        },
        useLayoutEffect: function(t, e) {
          return Il(4194308, 4, t, e);
        },
        useInsertionEffect: function(t, e) {
          Il(4, 2, t, e);
        },
        useMemo: function(t, e) {
          var l = fe();
          e = e === void 0 ? null : e;
          var i = t();
          if (ra) {
            A(!0);
            try {
              t();
            } finally {
              A(!1);
            }
          }
          return l.memoizedState = [i, e], i;
        },
        useReducer: function(t, e, l) {
          var i = fe();
          if (l !== void 0) {
            var c = l(e);
            if (ra) {
              A(!0);
              try {
                l(e);
              } finally {
                A(!1);
              }
            }
          } else c = e;
          return i.memoizedState = i.baseState = c, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: c
          }, i.queue = t, t = t.dispatch = Ap.bind(
            null,
            vt,
            t
          ), [i.memoizedState, t];
        },
        useRef: function(t) {
          var e = fe();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = Gr(t);
          var e = t.queue, l = Fc.bind(
            null,
            vt,
            e
          );
          return e.dispatch = l, [t.memoizedState, l];
        },
        useDebugValue: Vr,
        useDeferredValue: function(t, e) {
          var l = fe();
          return Qr(l, t, e);
        },
        useTransition: function() {
          var t = Gr(!1);
          return t = Xc.bind(
            null,
            vt,
            t.queue,
            !0,
            !1
          ), fe().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, l) {
          var i = vt, c = fe();
          if (St) {
            if (l === void 0)
              throw Error(s(407));
            l = l();
          } else {
            if (l = e(), At === null)
              throw Error(s(349));
            (kt & 127) !== 0 || wc(i, e, l);
          }
          c.memoizedState = l;
          var d = { value: l, getSnapshot: e };
          return c.queue = d, Hc(kc.bind(null, i, d, t), [
            t
          ]), i.flags |= 2048, ha(
            9,
            { destroy: void 0 },
            _c.bind(
              null,
              i,
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
            var l = Je, i = Ze;
            l = (i & ~(1 << 32 - _e(i) - 1)).toString(32) + l, e = "_" + e + "R_" + l, l = Ci++, 0 < l && (e += "H" + l.toString(32)), e += "_";
          } else
            l = Ug++, e = "_" + e + "r_" + l.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: Kr,
        useFormState: jc,
        useActionState: jc,
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
          return e.queue = l, e = Xr.bind(
            null,
            vt,
            !0,
            l
          ), l.dispatch = e, [t, e];
        },
        useMemoCache: Hr,
        useCacheRefresh: function() {
          return fe().memoizedState = Mp.bind(
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
      }, Zo = {
        readContext: ee,
        use: Fl,
        useCallback: Vc,
        useContext: ee,
        useEffect: Lr,
        useImperativeHandle: Lc,
        useInsertionEffect: qc,
        useLayoutEffect: Gc,
        useMemo: Qc,
        useReducer: $l,
        useRef: Bc,
        useState: function() {
          return $l(tn);
        },
        useDebugValue: Vr,
        useDeferredValue: function(t, e) {
          var l = Gt();
          return Kc(
            l,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = $l(tn)[0], e = Gt().memoizedState;
          return [
            typeof t == "boolean" ? t : $a(t),
            e
          ];
        },
        useSyncExternalStore: xc,
        useId: Jc,
        useHostTransitionStatus: Kr,
        useFormState: Oc,
        useActionState: Oc,
        useOptimistic: function(t, e) {
          var l = Gt();
          return zc(l, Mt, t, e);
        },
        useMemoCache: Hr,
        useCacheRefresh: Wc
      };
      Zo.useEffectEvent = Uc;
      var Kd = {
        readContext: ee,
        use: Fl,
        useCallback: Vc,
        useContext: ee,
        useEffect: Lr,
        useImperativeHandle: Lc,
        useInsertionEffect: qc,
        useLayoutEffect: Gc,
        useMemo: Qc,
        useReducer: qr,
        useRef: Bc,
        useState: function() {
          return qr(tn);
        },
        useDebugValue: Vr,
        useDeferredValue: function(t, e) {
          var l = Gt();
          return Mt === null ? Qr(l, t, e) : Kc(
            l,
            Mt.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = qr(tn)[0], e = Gt().memoizedState;
          return [
            typeof t == "boolean" ? t : $a(t),
            e
          ];
        },
        useSyncExternalStore: xc,
        useId: Jc,
        useHostTransitionStatus: Kr,
        useFormState: Dc,
        useActionState: Dc,
        useOptimistic: function(t, e) {
          var l = Gt();
          return Mt !== null ? zc(l, Mt, t, e) : (l.baseState = t, [t, l.queue.dispatch]);
        },
        useMemoCache: Hr,
        useCacheRefresh: Wc
      };
      Kd.useEffectEvent = Uc;
      var Jo = {
        enqueueSetState: function(t, e, l) {
          t = t._reactInternals;
          var i = xe(), c = vn(i);
          c.payload = e, l != null && (c.callback = l), e = yn(t, c, i), e !== null && (he(e, t, i), Ja(e, t, i));
        },
        enqueueReplaceState: function(t, e, l) {
          t = t._reactInternals;
          var i = xe(), c = vn(i);
          c.tag = 1, c.payload = e, l != null && (c.callback = l), e = yn(t, c, i), e !== null && (he(e, t, i), Ja(e, t, i));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var l = xe(), i = vn(l);
          i.tag = 2, e != null && (i.callback = e), e = yn(t, i, l), e !== null && (he(e, t, l), Ja(e, t, l));
        }
      }, Wo = Error(s(461)), Qt = !1, Fo = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, un = !1, Kt = !1, $o = !1, Xd = typeof WeakSet == "function" ? WeakSet : Set, Pt = null, Xt = null, be = !1, Ye = null, Ba = 8192, qg = {
        getCacheForType: function(t) {
          var e = ee(Dt), l = e.data.get(t);
          return l === void 0 && (l = t(), e.data.set(t, l)), l;
        },
        cacheSignal: function() {
          return ee(Dt).controller.signal;
        }
      }, Mi = 0, Ai = 1, ji = 2, Oi = 3, Ri = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var gl = Symbol.for;
        Mi = gl("selector.component"), Ai = gl("selector.has_pseudo_class"), ji = gl("selector.role"), Oi = gl("selector.test_id"), Ri = gl("selector.text");
      }
      var Gg = typeof WeakMap == "function" ? WeakMap : Map, wt = 0, At = null, _t = null, kt = 0, Ct = 0, ze = null, Mn = !1, Ha = !1, Io = !1, dn = 0, qt = 0, An = 0, oa = 0, Po = 0, Ne = 0, Ua = 0, bl = null, ve = null, ts = !1, Di = 0, Zd = 0, vl = 1 / 0, Bi = null, jn = null, Wt = 0, On = null, qa = null, fn = 0, es = 0, ns = null, Jd = null, yl = 0, as = null;
      return xt.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Jn(t, 67108864);
          e !== null && he(e, t, 67108864), _o(t, 67108864);
        }
      }, xt.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = xe();
          e = z(e);
          var l = Jn(t, e);
          l !== null && he(l, t, e), _o(t, e);
        }
      }, xt.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = T(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var l = 1 << 31 - _e(e);
                  t.entanglements[1] |= l, e &= ~l;
                }
                Qe(t), (wt & 6) === 0 && (vl = ge() + 500, pa(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Jn(t, 2), e !== null && he(e, t, 2), Vu(), _o(t, 2);
        }
      }, xt.batchedUpdates = function(t, e) {
        return t(e);
      }, xt.createComponentSelector = function(t) {
        return { $$typeof: Mi, value: t };
      }, xt.createContainer = function(t, e, l, i, c, d, w, M, V, $) {
        return od(
          t,
          e,
          !1,
          null,
          l,
          i,
          d,
          null,
          w,
          M,
          V,
          $
        );
      }, xt.createHasPseudoClassSelector = function(t) {
        return { $$typeof: Ai, value: t };
      }, xt.createHydrationContainer = function(t, e, l, i, c, d, w, M, V, $, nt, P, lt, gt) {
        return t = od(
          l,
          i,
          !0,
          t,
          c,
          d,
          M,
          gt,
          V,
          $,
          nt,
          P
        ), t.context = sd(null), l = t.current, i = xe(), i = z(i), c = vn(i), c.callback = e ?? null, yn(l, c, i), e = i, t.current.lanes = e, B(t, e), Qe(t), t;
      }, xt.createPortal = function(t, e, l) {
        var i = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: ya,
          key: i == null ? null : "" + i,
          children: t,
          containerInfo: e,
          implementation: l
        };
      }, xt.createRoleSelector = function(t) {
        return { $$typeof: ji, value: t };
      }, xt.createTestNameSelector = function(t) {
        return { $$typeof: Oi, value: t };
      }, xt.createTextSelector = function(t) {
        return { $$typeof: Ri, value: t };
      }, xt.defaultOnCaughtError = function(t) {
        console.error(t);
      }, xt.defaultOnRecoverableError = function(t) {
        qd(t);
      }, xt.defaultOnUncaughtError = function(t) {
        qd(t);
      }, xt.deferredUpdates = function(t) {
        var e = dt.T, l = on();
        try {
          return It(32), dt.T = null, t();
        } finally {
          It(l), dt.T = e;
        }
      }, xt.discreteUpdates = function(t, e, l, i, c) {
        var d = dt.T, w = on();
        try {
          return It(2), dt.T = null, t(e, l, i, c);
        } finally {
          It(w), dt.T = d, wt === 0 && (vl = ge() + 500);
        }
      }, xt.findAllNodes = ho, xt.findBoundingRects = function(t, e) {
        if (!ol) throw Error(s(363));
        e = ho(t, e), t = [];
        for (var l = 0; l < e.length; l++)
          t.push(wh(e[l]));
        for (e = t.length - 1; 0 < e; e--) {
          l = t[e];
          for (var i = l.x, c = i + l.width, d = l.y, w = d + l.height, M = e - 1; 0 <= M; M--)
            if (e !== M) {
              var V = t[M], $ = V.x, nt = $ + V.width, P = V.y, lt = P + V.height;
              if (i >= $ && d >= P && c <= nt && w <= lt) {
                t.splice(e, 1);
                break;
              } else if (i !== $ || l.width !== V.width || lt < d || P > w) {
                if (!(d !== P || l.height !== V.height || nt < i || $ > c)) {
                  $ > i && (V.width += $ - i, V.x = i), nt < c && (V.width = c - $), t.splice(e, 1);
                  break;
                }
              } else {
                P > d && (V.height += P - d, V.y = d), lt < w && (V.height = w - P), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, xt.findHostInstance = cd, xt.findHostInstanceWithNoPortals = function(t) {
        return t = f(t), t = t !== null ? v(t) : null, t === null ? null : rl(t.stateNode);
      }, xt.findHostInstanceWithWarning = function(t) {
        return cd(t);
      }, xt.flushPassiveEffects = il, xt.flushSyncFromReconciler = function(t) {
        var e = wt;
        wt |= 1;
        var l = dt.T, i = on();
        try {
          if (It(2), dt.T = null, t)
            return t();
        } finally {
          It(i), dt.T = l, wt = e, (wt & 6) === 0 && pa(0);
        }
      }, xt.flushSyncWork = Vu, xt.focusWithin = function(t, e) {
        if (!ol) throw Error(s(363));
        for (t = fo(t), e = qu(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var l = e[t++], i = l.tag;
          if (!sl(l)) {
            if ((i === 5 || i === 26 || i === 27) && Sh(l.stateNode))
              return !0;
            for (l = l.child; l !== null; )
              e.push(l), l = l.sibling;
          }
        }
        return !1;
      }, xt.getFindAllNodesFailureDescription = function(t, e) {
        if (!ol) throw Error(s(363));
        var l = 0, i = [];
        t = [fo(t), 0];
        for (var c = 0; c < t.length; ) {
          var d = t[c++], w = d.tag, M = t[c++], V = e[M];
          if ((w !== 5 && w !== 26 && w !== 27 || !sl(d)) && (mo(d, V) && (i.push(po(V)), M++, M > l && (l = M)), M < e.length))
            for (d = d.child; d !== null; )
              t.push(d, M), d = d.sibling;
        }
        if (l < e.length) {
          for (t = []; l < e.length; l++)
            t.push(po(e[l]));
          return `findAllNodes was able to match part of the selector:
  ` + (i.join(" > ") + `

No matching component was found for:
  `) + t.join(" > ");
        }
        return null;
      }, xt.getPublicRootInstance = function(t) {
        if (t = t.current, !t.child) return null;
        switch (t.child.tag) {
          case 27:
          case 5:
            return rl(t.child.stateNode);
          default:
            return t.child.stateNode;
        }
      }, xt.injectIntoDevTools = function() {
        var t = {
          bundleType: 0,
          version: Pp,
          rendererPackageName: th,
          currentDispatcherRef: dt,
          reconcilerVersion: "19.2.0"
        };
        if (hd !== null && (t.rendererConfig = hd), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
        else {
          var e = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (e.isDisabled || !e.supportsFiber) t = !0;
          else {
            try {
              cl = e.inject(t), ke = e;
            } catch {
            }
            t = !!e.checkDCE;
          }
        }
        return t;
      }, xt.isAlreadyRendering = function() {
        return (wt & 6) !== 0;
      }, xt.observeVisibleRects = function(t, e, l, i) {
        if (!ol) throw Error(s(363));
        t = ho(t, e);
        var c = Eh(
          t,
          l,
          i
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
      }, xt.startHostTransition = function(t, e, l, i) {
        if (t.tag !== 5) throw Error(s(476));
        var c = Zc(t).queue;
        Xc(
          t,
          c,
          e,
          wa,
          l === null ? o : function() {
            var d = Zc(t);
            return d.next === null && (d = t.alternate.memoizedState), Ia(
              t,
              d.next.queue,
              {},
              xe()
            ), l(i);
          }
        );
      }, xt.updateContainer = function(t, e, l, i) {
        var c = e.current, d = xe();
        return ud(
          c,
          d,
          t,
          e,
          l,
          i
        ), d;
      }, xt.updateContainerSync = function(t, e, l, i) {
        return ud(
          e.current,
          2,
          t,
          e,
          l,
          i
        ), 2;
      }, xt;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(os)), os.exports;
}
var sf;
function v0() {
  return sf || (sf = 1, rs.exports = b0()), rs.exports;
}
var y0 = v0();
const fm = /* @__PURE__ */ Qs(y0);
var x0 = dm(), us = { exports: {} }, mn = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var cf;
function w0() {
  return cf || (cf = 1, mn.ConcurrentRoot = 1, mn.ContinuousEventPriority = 8, mn.DefaultEventPriority = 32, mn.DiscreteEventPriority = 2, mn.IdleEventPriority = 268435456, mn.LegacyRoot = 0, mn.NoEventPriority = 0), mn;
}
var uf;
function _0() {
  return uf || (uf = 1, us.exports = w0()), us.exports;
}
var Va = _0();
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
const mm = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], ks = 16, gr = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), k0 = [
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
], df = {
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
}, S0 = /* @__PURE__ */ new Set([
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
]), pm = {
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
}, hm = {
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
}, Ss = ["font-size", "color", ...new Set([...Object.keys(pm), ...Object.keys(hm)].filter((n) => n !== "font-size" && n !== "color"))], E0 = new Set(Ss);
function oe(n, a = " ") {
  const r = [];
  let o = 0, s = "";
  for (let u = 0; u < n.length; u++) {
    const m = n[u];
    if (m === "(" ? o++ : m === ")" && o--, o === 0 && (a === " " ? /\s/.test(m) : m === a)) {
      (s.trim() || a !== " ") && r.push(s.trim()), s = "";
      continue;
    }
    s += m;
  }
  return (s.trim() || a !== " " && r.length) && r.push(s.trim()), r;
}
function Es(n, a, r = 0) {
  if (r > 32) return null;
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
    const S = Es(b, a, r + 1);
    if (S === null) return null;
    o += S, s = f;
  }
}
function z0(n) {
  const a = [], r = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let o, s = 0;
  for (; s < n.length; ) {
    if (r.lastIndex = s, o = r.exec(n), !o || o.index !== s) {
      if (/^\s+$/.test(n.slice(s))) break;
      return null;
    }
    s = r.lastIndex, o[1] !== void 0 ? a.push({ num: parseFloat(o[1]), unit: (o[2] ?? "").toLowerCase() }) : o[3] ? a.push({ fn: o[3].toLowerCase() }) : o[4] ? a.push({ num: 1 / 0, unit: "" }) : a.push({ op: o[5] ?? o[6] });
  }
  return a;
}
function Yn(n, a) {
  const r = z0(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!r) return null;
  let o = 0;
  const s = ({ num: b, unit: S }) => {
    switch (S) {
      case "":
        return { px: 0, pct: 0, num: b, unitless: !0 };
      case "px":
        return { px: b, pct: 0, num: 0 };
      case "rem":
        return { px: b * ks, pct: 0, num: 0 };
      case "em":
        return { px: b * (a.fontSize ?? ks), pct: 0, num: 0 };
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
  }, u = (b, S, N) => b && S ? { px: b.px + N * S.px, pct: b.pct + N * S.pct, num: b.num + N * S.num, unitless: b.unitless && S.unitless } : null, m = (b, S) => b ? { px: b.px * S, pct: b.pct * S, num: b.num * S, unitless: b.unitless } : null, f = (b) => b && b.unitless;
  function p() {
    const b = r[o++];
    if (!b) return null;
    if (b.num !== void 0) return s(b);
    if (b.op === "(") {
      const S = x();
      return r[o]?.op !== ")" ? null : (o++, S);
    }
    if (b.op === "-" || b.op === "+") {
      const S = p();
      return b.op === "-" ? m(S, -1) : S;
    }
    if (b.fn) {
      const S = [];
      for (; ; ) {
        S.push(x());
        const T = r[o++];
        if (!T) return null;
        if (T.op === ")") break;
        if (T.op !== ",") return null;
      }
      if (S.some((T) => !T)) return null;
      if (b.fn === "calc") return S[0];
      if (!(S.every((T) => !T.pct) || S.every((T) => !T.px && !T.num))) return null;
      const E = (T) => T.px + T.pct + T.num;
      return b.fn === "min" ? S.reduce((T, j) => E(j) < E(T) ? j : T) : b.fn === "max" ? S.reduce((T, j) => E(j) > E(T) ? j : T) : b.fn === "clamp" && S.length === 3 ? E(S[1]) < E(S[0]) ? S[0] : E(S[1]) > E(S[2]) ? S[2] : S[1] : null;
    }
    return null;
  }
  function v() {
    let b = p();
    for (; r[o] && (r[o].op === "*" || r[o].op === "/"); ) {
      const S = r[o++].op, N = p();
      if (!b || !N) return null;
      S === "*" ? b = f(N) ? m(b, N.num) : f(b) ? m(N, b.num) : null : b = f(N) && N.num !== 0 ? m(b, 1 / N.num) : null;
    }
    return b;
  }
  function x() {
    let b = v();
    for (; r[o] && (r[o].op === "+" || r[o].op === "-"); ) {
      const S = r[o++].op;
      b = u(b, v(), S === "-" ? -1 : 1);
    }
    return b;
  }
  const y = x();
  return o !== r.length || !y ? null : y;
}
function zs(n, a) {
  const r = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(r))
    return r === "thin" ? { px: 1 } : r === "medium" ? { px: 3 } : r === "thick" ? { px: 5 } : r;
  const o = Yn(r, a);
  return o ? o.unitless ? o.num === 0 ? { px: 0 } : { expr: n.trim() } : o.pct && (o.px || o.num) ? { expr: n.trim() } : o.pct ? { pct: o.pct } : { px: N0(o.px) } : { expr: n.trim() };
}
const N0 = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, Ui = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), T0 = ([n, a, r, o]) => `#${Ui(n)}${Ui(a)}${Ui(r)}${Ui(o * 255)}`;
function ff(n) {
  const a = n.slice(1), r = a.length <= 4 ? a.split("").map((s) => s + s).join("") : a;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(r)) return null;
  const o = (s) => parseInt(r.slice(s, s + 2), 16);
  return [o(0), o(2), o(4), r.length === 8 ? o(6) / 255 : 1];
}
function er(n, a) {
  const r = n.trim().toLowerCase();
  if (r === "currentcolor") return "currentcolor";
  const o = /^perchtoken\(([a-z0-9-]+)\)$/.exec(r);
  if (o) {
    const v = a(o[1]), x = v && ff(v);
    return x ? { rgba: x, token: o[1] } : null;
  }
  if (r.startsWith("#")) {
    const v = ff(r);
    return v ? { rgba: v, token: null } : null;
  }
  if (df[r]) return { rgba: [...df[r]], token: null };
  const s = /^(rgba?|color-mix)\((.*)\)$/s.exec(r);
  if (!s) return null;
  if (s[1] === "color-mix") {
    const v = oe(s[2], ",");
    if (v.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(v[0])) return null;
    const x = (A) => {
      const G = oe(A), W = G.findIndex((I) => /%$/.test(I)), D = W >= 0 ? parseFloat(G[W]) / 100 : null;
      return { color: er(G.filter((I, Y) => Y !== W).join(" "), a), pct: D };
    }, y = x(v[1]), b = x(v[2]);
    if (!y.color || !b.color || y.color === "currentcolor" || b.color === "currentcolor") return null;
    let S = y.pct, N = b.pct;
    S === null && N === null ? (S = 0.5, N = 0.5) : S === null ? S = 1 - N : N === null && (N = 1 - S);
    const E = S + N, T = E < 1 ? E : 1;
    S /= E, N /= E;
    const [j, R, U, F] = y.color.rgba, [J, B, g, h] = b.color.rgba, _ = F * S + h * N, k = (A, G) => _ === 0 ? 0 : (A * F * S + G * h * N) / _, z = [k(j, J), k(R, B), k(U, g), _ * T], O = h === 0 ? y.color.token : F === 0 ? b.color.token : null;
    return { rgba: z, token: O };
  }
  const u = s[2].includes(",") ? oe(s[2], ",") : oe(s[2].replace("/", " / ")).filter((v) => v !== "/");
  if (u.length < 3) return null;
  const m = (v) => v.endsWith("%") ? parseFloat(v) / 100 * 255 : parseFloat(v), f = u[3] === void 0 ? 1 : u[3].endsWith("%") ? parseFloat(u[3]) / 100 : parseFloat(u[3]), p = [m(u[0]), m(u[1]), m(u[2]), f];
  return p.some((v) => Number.isNaN(v)) ? null : { rgba: p, token: null };
}
const El = ["top", "right", "bottom", "left"], C0 = ["top-left", "top-right", "bottom-right", "bottom-left"], qi = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], mf = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function Ns(n, a) {
  const r = a.trim(), o = () => oe(r);
  switch (n) {
    case "padding":
    case "margin": {
      const s = qi(o());
      return El.map((u, m) => [`${n}-${u}`, s[m]]);
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
      const s = qi(o());
      return El.map((u, m) => [u, s[m]]);
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
      return [["left", r]];
    case "inset-inline-end":
      return [["right", r]];
    case "border-width":
    case "border-style":
    case "border-color": {
      const s = n.split("-")[1], u = qi(o());
      return El.map((m, f) => [`border-${m}-${s}`, u[f]]);
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
      const s = n === "border" ? El : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let u = "medium", m = "none", f = "currentcolor";
      if (r !== "none" && r !== "0")
        for (const p of o())
          mf.has(p) ? m = p : /^(thin|medium|thick|-?[\d.]|calc\()/.test(p) ? u = p : f = p;
      else r === "0" && (u = "0");
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
      const s = qi(oe(r.split("/")[0]));
      return C0.map((u, m) => [`border-${u}-radius`, s[m]]);
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
      return r === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : er(r, () => "#000000") ? [["background-color", r], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", r]];
    // ponytail: only the CSS-wide keywords (`[font:inherit]` on a button); a full `font` value is kept unexpanded.
    case "font":
      return /^(inherit|initial|unset|revert|revert-layer)$/.test(r) ? ["font-family", "font-size", "font-weight", "font-style", "line-height"].map((s) => [s, r]) : [[n, r]];
    case "overflow": {
      const s = o();
      return [["overflow-x", s[0]], ["overflow-y", s[1] ?? s[0]]];
    }
    case "gap": {
      const s = o();
      return [["row-gap", s[0]], ["column-gap", s[1] ?? s[0]]];
    }
    case "grid-gap":
      return Ns("gap", r);
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
      if (r === "none") return [["flex-grow", "0"], ["flex-shrink", "0"], ["flex-basis", "auto"]];
      if (r === "auto") return [["flex-grow", "1"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      if (r === "initial") return [["flex-grow", "0"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      const s = o(), u = s.filter((f) => /^[\d.]+$/.test(f)), m = s.find((f) => !/^[\d.]+$/.test(f));
      return [["flex-grow", u[0] ?? "1"], ["flex-shrink", u[1] ?? "1"], ["flex-basis", m ?? (u.length ? "0%" : "auto")]];
    }
    case "flex-flow": {
      const s = [];
      for (const u of o()) s.push(/wrap/.test(u) ? ["flex-wrap", u] : ["flex-direction", u]);
      return s;
    }
    case "outline": {
      if (r === "none" || r === "0") return [["outline-style", "none"], ["outline-width", "medium"], ["outline-color", "currentcolor"]];
      let s = "medium", u = "none", m = "currentcolor";
      for (const f of o())
        mf.has(f) || f === "auto" ? u = f : /^(thin|medium|thick|-?[\d.]|calc\()/.test(f) ? s = f : m = f;
      return [["outline-width", s], ["outline-style", u], ["outline-color", m]];
    }
    case "transition": {
      if (r === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const s = oe(r, ","), u = s.map((f) => oe(f).find((p) => !/^[\d.]+m?s$/.test(p) && !/^(ease|linear|step|cubic)/.test(p)) ?? "all"), m = s.map((f) => oe(f).find((p) => /^[\d.]+m?s$/.test(p)) ?? "0s");
      return [["transition-property", u.join(", ")], ["transition-duration", m.join(", ")]];
    }
    case "text-decoration":
      return [["text-decoration-line", o()[0] ?? "none"]];
    case "-webkit-user-select":
      return [["user-select", r]];
    case "word-wrap":
      return [["overflow-wrap", r]];
    default:
      return [[n, r]];
  }
}
function M0(n, a) {
  return n ? oe(n, ",").some((r) => {
    let o = r.trim().toLowerCase(), s = !1;
    o.startsWith("not ") && (s = !0, o = o.slice(4)), o.startsWith("only ") && (o = o.slice(5));
    const u = o.split(/\s+and\s+/).every((m) => {
      if (m = m.trim(), m === "all" || m === "screen") return !0;
      if (m === "print") return !1;
      const f = /^\((.+)\)$/.exec(m);
      if (!f) return !1;
      const p = f[1].trim(), v = /^([a-z-]+)\s*:\s*(.+)$/.exec(p);
      if (v) {
        const [, y, b] = v, S = (N) => {
          const E = zs(N, { viewport: a });
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
        const y = x[1] === "width" ? a.width : a.height, b = zs(x[3], { viewport: a }), S = typeof b == "object" && "px" in b ? b.px : NaN;
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
function A0(n, a) {
  const r = a[a.length - 1].compound;
  return Ks(r)[0] ?? n;
}
function j0(n) {
  const a = (r) => r.some((o) => gr.has(o.name) || (o.list ?? []).some((s) => s.some(({ compound: u }) => a(u.pseudos))));
  return a(n[n.length - 1].compound.pseudos);
}
function O0(n) {
  const a = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set(), o = (s, u) => {
    s.forEach(({ compound: m }, f) => {
      const p = u && f === s.length - 1;
      for (const v of m.pseudos)
        if (gr.has(v.name) && (p ? a : r).add(v.name), v.list && v.name !== "not") for (const x of v.list) o(x, p);
    });
  };
  return o(n, !0), { subject: a, ancestor: r };
}
function Ks(n) {
  const a = [...n.classes];
  for (const r of n.pseudos)
    if (!(r.name !== "is" && r.name !== "where"))
      for (const o of r.list) o.length === 1 && a.push(...Ks(o[0].compound));
  return a;
}
function R0(n, a) {
  const r = (o, s) => {
    o.forEach(({ compound: u }, m) => {
      const f = s && m === o.length - 1, p = u.pseudos.filter((v) => gr.has(v.name)).map((v) => v.name);
      if (!f) for (const v of p) for (const x of Ks(u)) a.add(`${v}:${x}`);
      for (const v of u.pseudos) if (v.list && v.name !== "not") for (const x of v.list) r(x, f);
    });
  };
  r(n, !0);
}
class D0 {
  constructor(a) {
    this.properties = a.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set(), this.dependsCache = /* @__PURE__ */ new Map(), this.candidateCache = /* @__PURE__ */ new Map(), this.selectorAttrs = /* @__PURE__ */ new Set(), this.subjectAttrs = /* @__PURE__ */ new Set();
    const r = (u, m) => {
      const f = m[m.length - 1].compound;
      for (const v of f.attrs) this.subjectAttrs.add(v.name);
      const p = f.classes.length ? `.${f.classes[0]}` : f.tag && f.tag !== "*" ? f.tag : "*";
      this.index.has(p) || this.index.set(p, []), this.index.get(p).push(u);
    };
    let o = 0;
    const s = (u, m) => {
      for (const [f, p, v, x] of u)
        for (const y of Ys(f)) {
          let b;
          try {
            b = Ls(y);
          } catch (T) {
            if (T instanceof re) {
              this.skipped++;
              continue;
            }
            throw T;
          }
          const S = O0(b);
          vm(b, this.selectorAttrs), R0(b, this.trackedStates);
          const N = b[b.length - 1].compound.pseudoElement, E = { steps: b, media: p, layer: v, origin: m, order: o++, specificity: em(b), decls: x, states: S, pseudo: N, own: q0(b), assumed: j0(b), above: H0(b), source: m === 0 ? `ua:${b[b.length - 1].compound.tag ?? "*"}` : A0(y, b) };
          this.rules.push(E), r(E, b);
        }
    };
    s(k0.map(([u, m]) => [u, null, 0, Object.entries(m)]), 0), s(a.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones), or its `pseudo` box
   * (`before`, `after`). */
  candidates(a, r = null, o = null) {
    const s = `${a.tagName} ${a.className}|${r ?? ""}|${o ?? ""}`, u = this.candidateCache.get(s);
    if (u) return u;
    if (o !== null) {
      const x = this.candidates(a, r).filter((y) => {
        const b = y.reads ??= Ts(y.steps);
        return (b.has || b.focusWithin) === o;
      });
      return this.candidateCache.set(s, x), x;
    }
    const m = [], f = /* @__PURE__ */ new Set(), p = new Set(a.classList), v = (x) => {
      if (x) for (const y of x) !f.has(y) && y.pseudo === r && (f.add(y), gm(y.steps[y.steps.length - 1].compound, a.tagName, p) && m.push(y));
    };
    for (const x of a.classList) v(this.index.get(`.${x}`));
    return v(this.index.get(a.tagName)), v(this.index.get("*")), this.candidateCache.set(s, m), m;
  }
  /** What the rules that may match `element` (any pseudo-element) read besides the element and its parent's computed
   * style: `anc`, an ancestor's attributes or state; `pos`, whether it is its parent's first or last child; `nth`, its
   * index; `ancPos`, an ancestor's position. The description's cache keys on exactly these (`describe.mjs`). */
  depends(a) {
    const r = a.dependsIn;
    if (r && r.sheet === this && r.version === a.version) return r.deps;
    const o = this.dependsOf(a);
    return a.version !== void 0 && (a.dependsIn = { sheet: this, version: a.version, deps: o }), o;
  }
  dependsOf(a) {
    const r = (f) => a.getAttribute?.(f) != null;
    let o = `${a.tagName} ${a.className}`;
    for (const f of this.subjectAttrs) r(f) && (o += ` [${f}]`);
    let s = this.dependsCache.get(o);
    if (s) return s;
    s = { anc: !1, pos: !1, nth: !1, ancPos: !1, has: !1, focusWithin: !1 };
    const u = /* @__PURE__ */ new Set(), m = (f) => {
      for (const p of f ?? []) {
        if (u.has(p) || !p.steps[p.steps.length - 1].compound.attrs.every((x) => r(x.name))) continue;
        u.add(p);
        const v = p.reads ??= Ts(p.steps);
        s.anc ||= v.anc, s.pos ||= v.pos, s.nth ||= v.nth, s.ancPos ||= v.ancPos, s.has ||= v.has, s.focusWithin ||= v.focusWithin;
      }
    };
    for (const f of a.classList) m(this.index.get(`.${f}`));
    return m(this.index.get(a.tagName)), m(this.index.get("*")), this.dependsCache.set(o, s), s;
  }
  /** Whether a rule that may match `element` reads interaction `state` on one of its ancestors (`group-hover:`). */
  readsAncestor(a, r) {
    return this.candidates(a).some((o) => o.states.ancestor.has(r));
  }
  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(a, r) {
    for (const o of a.classList) if (this.trackedStates.has(`${r}:${o}`)) return !0;
    return !1;
  }
}
function gm(n, a, r) {
  if (n.tag && n.tag !== "*" && n.tag !== a) return !1;
  for (const o of n.classes) if (!r.has(o)) return !1;
  for (const o of n.pseudos) {
    if (o.name === "has") return !0;
    if (o.name === "root" && a !== "html" || (o.name === "where" || o.name === "is") && o.list.every((s) => s.length === 1 && !gm(s[0].compound, a, r))) return !1;
  }
  return !0;
}
const B0 = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "nth-child"]);
function H0(n) {
  const a = [];
  for (let r = n.length - 1; r > 0 && !(n[r].combinator !== " " && n[r].combinator !== ">"); r--)
    a.push(...n[r - 1].compound.classes);
  return a;
}
function bm(n) {
  const a = n.parentElement;
  if (!a) return U0;
  const r = bm(a), o = n.aboveCache;
  if (o && o.parent === a && o.name === a.className && o.base === r) return o.set;
  const s = a.classSet, u = s.size === 0 ? r : /* @__PURE__ */ new Set([...r, ...s]);
  return n.aboveCache = { parent: a, name: a.className, base: r, set: u }, u;
}
const U0 = /* @__PURE__ */ new Set();
function q0(n) {
  if (n.length !== 1) return !1;
  const { compound: a } = n[0];
  return !a.id && !a.attrs.length && a.pseudos.every((r) => gr.has(r.name) && r.name !== "focus-within");
}
function vm(n, a) {
  for (const { compound: r } of n) {
    for (const o of r.attrs) a.add(o.name);
    for (const o of r.pseudos) for (const s of o.list ?? []) vm(s, a);
  }
}
function Ts(n, a = !0, r = { anc: !1, pos: !1, nth: !1, ancPos: !1, has: !1, focusWithin: !1 }) {
  return n.forEach((o, s) => {
    const u = a && s === n.length - 1;
    u || (r.anc = !0);
    for (const m of o.compound.pseudos)
      if (B0.has(m.name) && (u ? r.pos = !0 : r.ancPos = !0, m.name === "nth-child" && u && (r.nth = !0)), m.name === "has" && (r.has = !0), m.name === "focus-within" && (r.focusWithin = !0), m.list && m.name !== "has") for (const f of m.list) Ts(f, u, r);
  }), r;
}
const G0 = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function pf(n) {
  if (!n || typeof n != "object") return [];
  const a = [];
  for (const [r, o] of Object.entries(n)) {
    if (o == null || o === "" || typeof o == "boolean") continue;
    const s = r.startsWith("--") ? r : r.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), u = typeof o == "number" && o !== 0 && !G0.has(s) && !s.startsWith("--") ? `${o}px` : String(o);
    a.push([s, u]);
  }
  return a;
}
const Y0 = { className: "class", htmlFor: "for", tabIndex: "tabindex" };
function hf(n) {
  if (n.tagName !== "svg") return [];
  const a = [];
  for (const r of ["width", "height"]) {
    const o = n.getAttribute(r);
    o !== null && a.push([r, /^[\d.]+$/.test(o) ? `${o}px` : o]);
  }
  return a;
}
const L0 = (n, a) => n.important - a.important || n.origin - a.origin || n.layer - a.layer || n.specificity[0] - a.specificity[0] || n.specificity[1] - a.specificity[1] || n.specificity[2] - a.specificity[2] || n.order - a.order;
class V0 {
  constructor(a, { theme: r, viewport: o }) {
    this.sheet = a, this.theme = r, this.viewport = o, this.parsed = /* @__PURE__ */ new Map(), this.computed = /* @__PURE__ */ new WeakMap(), this.rootComputed = /* @__PURE__ */ new Map(), this.media = /* @__PURE__ */ new Map(), this.ownMatches = /* @__PURE__ */ new Map(), this.pass = null, this.matched = /* @__PURE__ */ new Map(), this.signatures = /* @__PURE__ */ new Map(), this.nextSignature = 0;
  }
  mediaHolds(a) {
    if (!a.media) return !0;
    for (const r of a.media) {
      let o = this.media.get(r);
      if (o === void 0 && this.media.set(r, o = M0(r, this.viewport)), !o) return !1;
    }
    return !0;
  }
  themeHex(a) {
    return this.theme?.[a] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(a, r, o = null, s = null) {
    if (!this.pass) return this.match(a, r, o, s);
    const u = `${this.signature(a)}|${o ?? ""}|${r === "*" ? "*" : [...r].sort().join(",")}`;
    let m = this.matched.get(u);
    m || (this.matched.size > 2e4 && (this.matched.clear(), this.signatures.clear()), this.matched.set(u, m = this.match(a, r, o, s, !1)));
    const f = this.match(a, r, o, s, !0);
    return f.length ? [...m, ...f] : m;
  }
  /** A number for what a selector can read of `element` and its ancestors (tag, classes, id, the attributes some
   * selector reads, state, position among its siblings, being the root): equal numbers match the same rules. Worked
   * out once per element per describe pass. */
  signature(a) {
    if (!a) return -1;
    const r = a.signatureIn;
    if (r && r.pass === this.pass) return r.id;
    const o = a.parentElement, s = this.sheet.depends(a), u = (b) => {
      let S = b.parentElement.kidsIn;
      return (!S || S.pass !== this.pass) && (b.parentElement.kidsIn = S = { pass: this.pass, list: b.parentElement.children }), `${S.list.indexOf(b)}/${S.list.length}.`;
    };
    let m = s.pos && o ? u(a) : "";
    if (s.ancPos) for (let b = o; b?.parentElement; b = b.parentElement) m += u(b);
    let f = "";
    for (const b in a.props ?? {}) {
      const S = Y0[b] ?? b;
      if (!this.sheet.selectorAttrs.has(S)) continue;
      const N = a.getAttribute(S);
      N !== null && (f += `${S}=${N}`);
    }
    const p = a.state, v = a.props ?? {}, x = `${this.signature(o)}\0${a.tagName} ${a.className}#${a.getAttribute?.("id") ?? ""}[${f}]${+!!p?.hover}${+!!p?.focus}${+!!p?.active}${+!!p?.pointerFocus}${+!!v.disabled}${+!!v.checked}${+!!a.isDocumentRoot}@${m}`;
    let y = this.signatures.get(x);
    return y === void 0 && this.signatures.set(x, y = this.nextSignature++), a.signatureIn = { pass: this.pass, id: y }, y;
  }
  /** Everything of `element` its own style is computed from, its parent's style aside (`signature`, presentational
   * attributes, inline style, `hidden`): elements with equal keys under one parent style compute alike. */
  partKey(a) {
    const r = hf(a), o = pf(a.inlineStyle ?? a.props?.style);
    return `${this.signature(a)}|${r.length ? JSON.stringify(r) : ""}|${o.length ? JSON.stringify(o) : ""}|${+!!a.hidden}`;
  }
  /** `matching` without the memo; with `live` true only the rules that read descendants or focus, false the others. */
  match(a, r, o = null, s = null, u = null) {
    const f = { state: (E, T, j) => {
      if (T === "disabled") return !!E.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(E.tagName);
      if (T === "enabled") return !E.props?.disabled && ["button", "input", "select", "textarea"].includes(E.tagName);
      if (T === "checked") return !!E.props?.checked;
      if (r === "*") return !0;
      if (T === "focus-within") {
        const R = E.ownerDocument?.activeElement;
        return !!R && R !== E.ownerDocument.body && typeof E.contains == "function" && E.contains(R);
      }
      return j ? r.has(T) : T === "focus-visible" ? !!E.state?.focus && !E.state?.pointerFocus : !!E.state?.[T];
    }, pseudo: o }, p = u === null ? this.sheet.candidates(a, o) : this.sheet.candidates(a, o, u), v = `${a.tagName} ${a.className}|${o ?? ""}|${u ?? ""}|${r === "*" ? "*" : [...r].sort().join(",")}`;
    let x = this.ownMatches.get(v);
    x || (x = new Set(p.filter((E) => E.own && this.mediaHolds(E) && vs(a, E.steps, f))), this.ownMatches.set(v, x));
    let y = null;
    const b = (E) => E.above.length ? (y ??= bm(a), E.above.every((T) => y.has(T))) : !0, S = s && r !== "*" ? s[o ?? ""] ??= /* @__PURE__ */ new Map() : null, N = (E) => this.mediaHolds(E) && b(E) && vs(a, E.steps, f);
    return p.filter((E) => {
      if (E.own) return x.has(E);
      if (!S || E.assumed) return N(E);
      let T = S.get(E);
      return T === void 0 && S.set(E, T = N(E)), T;
    });
  }
  /** `element`'s computed style, or with `pseudo` (`before`, `after`) that of its pseudo-element's box, whose parent
   * is the element (pass the element's own computed style as `parent`). */
  compute(a, r, o = /* @__PURE__ */ new Set(), s = null, u = null) {
    const m = this.matching(a, o, s, u), f = s ? [] : hf(a), p = s ? [] : pf(a.inlineStyle ?? a.props?.style);
    let v = this.rootComputed;
    r && (v = this.computed.get(r.values), v || this.computed.set(r.values, v = /* @__PURE__ */ new Map()));
    const x = `${m.map((b) => b.order).join(",")}|${f.length ? JSON.stringify(f) : ""}|${p.length ? JSON.stringify(p) : ""}`;
    let y = v.get(x);
    return y || v.set(x, y = this.cascade(m, f, p, r)), { ...y, rules: m, element: a, shared: y };
  }
  /** The computed style from the matched `rules`, presentational `attrs`, `inline` declarations and the parent's. */
  cascade(a, r, o, s) {
    const u = [];
    for (const g of a)
      for (const [h, _, k] of g.decls) u.push({ prop: h, value: _, important: k ? 1 : 0, origin: g.origin === 0 ? 0 : 2, layer: g.layer, specificity: g.specificity, order: g.order, source: g.source });
    for (const [g, h] of r) u.push({ prop: g, value: h, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${g}` });
    for (const [g, h] of o) u.push({ prop: g, value: h, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    u.sort(L0);
    const m = this.sheet.properties, f = Object.create(s?.customs ?? null), p = /* @__PURE__ */ new Map(), v = /* @__PURE__ */ new Map();
    for (const g of u) g.prop.startsWith("--") && v.set(g.prop, g.value);
    if (!s && this.theme) for (const g of mm) this.theme[g] && v.set(`--${g}`, `perchtoken(${g})`);
    const x = (g) => {
      if (p.has(g)) return p.get(g);
      const h = m[g];
      return h && !h.inherits ? h.initial ?? null : g in f ? f[g] : h?.initial ?? null;
    }, y = /* @__PURE__ */ new Set(), b = (g) => {
      if (!v.has(g)) return x(g);
      if (y.has(g)) return null;
      y.add(g);
      const h = Es(v.get(g), b);
      return y.delete(g), v.delete(g), p.set(g, h), (!m[g] || m[g].inherits) && (f[g] = h), h;
    };
    for (const g of [...v.keys()]) b(g);
    const S = /* @__PURE__ */ new Map();
    for (const g of u) {
      if (g.prop.startsWith("--")) continue;
      const h = Es(g.value, x);
      if (h === null) {
        for (const [_] of Ns(g.prop, "unset")) S.set(_, { value: "unset", source: g.source, origin: g.origin });
        continue;
      }
      for (const [_, k] of Ns(g.prop, h)) S.set(_, { value: k, source: g.source, origin: g.origin });
    }
    const N = {}, E = {}, T = /* @__PURE__ */ new Set(), j = /* @__PURE__ */ new Set(), R = s?.values, U = { fontSize: R?.["font-size"] ?? ks, viewport: this.viewport }, F = (g, h) => {
      if (/currentcolor/i.test(h)) return this.parseValue(g, h, U, N, R);
      const _ = `${g}\0${h}\0${U.fontSize}`;
      let k = this.parsed.get(_);
      return k === void 0 && this.parsed.set(_, k = this.parseValue(g, h, U, N, R)), k;
    }, J = S.size ? [...Ss, ...[...S.keys()].filter((g) => !E0.has(g))] : Ss;
    for (const g of J) {
      const h = S.get(g);
      let _ = h?.value;
      const k = S0.has(g);
      if ((_ === void 0 || _ === "unset" || _ === "revert" || _ === "revert-layer") && (_ = k ? "inherit" : "initial"), h && (E[g] = h.source, h.origin !== 0 && T.add(g)), _ === "inherit" && R && g in R) {
        N[g] = R[g], j.add(g);
        continue;
      }
      (_ === "inherit" || _ === "initial") && (_ = k ? hm[g] : pm[g]), N[g] = F(g, _), g === "font-size" && (U.fontSize = N["font-size"]);
    }
    for (const g of El) {
      const h = N[`border-${g}-style`];
      (h === "none" || h === "hidden") && (N[`border-${g}-width`] = { px: 0 });
    }
    N["outline-style"] === "none" && (N["outline-width"] = { px: 0 });
    const B = R?.display;
    return (B === "flex" || B === "inline-flex" || B === "grid" || B === "inline-grid") && N.position !== "absolute" && N.position !== "fixed" && (N.display = gf(N.display)), (N.position === "absolute" || N.position === "fixed") && (N.display = gf(N.display)), { values: N, sources: E, own: T, inherited: j, customs: f };
  }
  parseValue(a, r, o, s, u) {
    const m = String(r).trim();
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
        const f = er(m, (p) => this.themeHex(p));
        return f === "currentcolor" || !f ? u?.color ?? { rgba: [0, 0, 0, 1], token: null } : f;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const f = er(m, (p) => this.themeHex(p));
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
        return zs(m, o);
      default:
        return m.toLowerCase().startsWith("var(") ? m : /^[a-z-]+$/i.test(m) ? m.toLowerCase() : m;
    }
  }
}
function gf(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const nr = (n) => n && n.rgba ? { value: T0(n.rgba), token: n.token ?? null } : null, Q0 = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function K0(n, a) {
  const r = a?.(n);
  if (Number.isFinite(r)) return r;
  const o = Math.round(n * 100) / 100;
  return Q0[o] ?? Math.round(n * 1.2);
}
function Nl(n, a) {
  const r = n["line-height"], o = n["font-size"];
  return r.normal ? K0(o, a) : r.factor !== void 0 ? r.factor * o : r.px;
}
const X0 = (n) => oe(n, ",").map((a) => a.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const Z0 = "perch-native-description/1", Le = Symbol("display"), ar = {
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
}, J0 = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of J0) ar[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
ar.rounded = 0;
const W0 = /* @__PURE__ */ new Set([
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
]), F0 = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, $0 = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, I0 = /^\s*["']?(ui-monospace|sfmono-regular|sf mono)["']?\s*(,|$)/i, P0 = (n) => I0.test(n ?? "") ? ".AppleSystemUIFontMonospaced" : $0.test(n) ? "Menlo" : /^\s*system-ui\s*$/i.test(n ?? "") ? ".AppleSystemUIFont" : F0.test(n) ? ".SystemUIFont" : X0(n).split(",")[0].trim(), ym = {
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
}, bf = Object.keys(ym), vf = Object.fromEntries(Object.entries(ym).flatMap(([n, a], r) => a.map((o) => [o, 1 << r]))), yf = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, Dl = (n) => {
  const a = n.props["data-testid"];
  if (a) return `${n.tagName}[data-testid="${a}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const r = n.classList.find((s) => !s.includes(":") && !s.includes("[")) ?? n.classList[0];
  if (r) return `${n.tagName}.${r}`;
  const o = n.parentElement;
  return o && o.tagName !== "body" ? `${Dl(o)} > ${n.tagName}` : n.tagName;
};
class tb {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(a, r, o, s, u, m = "") {
    const f = `${a}|${r}|${o}|${s}`, p = this.map.get(f);
    if (p) {
      !p.elements.includes(u) && p.elements.length < 4 && p.elements.push(u), p.count++;
      return;
    }
    this.map.set(f, { kind: a, property: r, value: String(o), class: s ?? null, elements: [u], count: 1, ...m ? { note: m } : {} });
  }
  list() {
    return [...this.map.values()].sort((a, r) => a.kind < r.kind ? -1 : a.kind > r.kind ? 1 : a.property < r.property ? -1 : a.property > r.property ? 1 : 0);
  }
}
const hn = (n) => {
  if (n != null) {
    if (typeof n == "string") return n === "auto" || n === "none" || n === "normal" ? "auto" : void 0;
    if ("px" in n) return Math.round(Math.min(Math.max(n.px, -9999), 9999) * 100) / 100;
    if ("pct" in n) return `${Math.round(n.pct * 1e3) / 1e3}%`;
  }
}, ds = /^(text|search|url|email|tel|password|number)$/, eb = 162.13 / 12.8;
function nb(n, a) {
  const r = typeof n == "object" && /^min\((.*)\)$/.exec(String(n?.expr ?? "").trim());
  if (!r) return;
  const o = oe(r[1], ",").map((s) => Yn(s.trim(), { fontSize: a })).filter((s) => s && !s.pct && !s.num).map((s) => s.px);
  return o.length ? Math.min(...o) : void 0;
}
function ab(n, a) {
  if (typeof n != "object" || !n?.expr) return !1;
  const r = Yn(n.expr, { fontSize: a["font-size"] }), o = (a["margin-left"]?.px ?? NaN) + (a["margin-right"]?.px ?? NaN);
  return !!r && !r.num && r.pct === 100 && Math.abs(r.px + o) < 0.01;
}
function xm(n) {
  const a = n.transform;
  if (a && a !== "none") {
    const o = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(a), s = o && oe(o[2], ",").map((u) => u.trim());
    return !s || s.length > (o[1] ? 1 : 2) ? null : o[1] === "X" ? [s[0], "0"] : o[1] === "Y" ? ["0", s[0]] : [s[0], s[1] ?? "0"];
  }
  const r = n.translate;
  if (r && r !== "none") {
    const o = oe(String(r).trim(), " ").filter(Boolean);
    return o.length > 3 || o[2] !== void 0 && Yn(o[2], {})?.px ? null : [o[0], o[1] ?? "0"];
  }
  return [];
}
function xf(n, a, r, o = !1) {
  const s = n.values, u = xm(s);
  if (u?.length === 0) return;
  const m = s.transform && s.transform !== "none" ? "transform" : "translate", f = { fontSize: s["font-size"] }, p = (y, b) => {
    const S = Yn(y, f);
    if (!(!S || S.unitless && S.num))
      return S.pct ? typeof b == "number" ? S.px + S.pct / 100 * b : void 0 : S.px;
  }, v = u ? p(u[0], a.w) : void 0, x = u ? p(u[1], a.h) : void 0;
  if (v === void 0 || x === void 0) {
    const y = !o && u ? u.map((b) => Yn(b, f)) : null;
    if (y?.every((b) => b && !(b.unitless && b.num))) {
      a[wm] = y.map((b) => [b.px, b.pct ?? 0]);
      return;
    }
    r("unsupported", m, s[m], n.sources[m]);
    return;
  }
  if (o) {
    v && (a.left = v), x && (a.top = x);
    return;
  }
  v && (a.ml = (a.ml ?? 0) + v), x && (a.mt = (a.mt ?? 0) + x);
}
const wm = Symbol("perch.shift");
function lb(n, a, r) {
  const o = n.ownerDocument, s = o?.measure?.(n) ?? null;
  if (s) {
    const [[m, f], [p, v]] = r, x = m + f / 100 * s.width, y = p + v / 100 * s.height;
    x && (a.ml = (typeof a.ml == "number" ? a.ml : 0) + x), y && (a.mt = (typeof a.mt == "number" ? a.mt : 0) + y);
  }
  const u = s ? `${s.width}x${s.height}` : "";
  u === n.shiftSeen ? n.shiftTries = 0 : (n.shiftTries ?? 0) < rm && o?.retries && (n.shiftSeen = u, n.shiftTries = (n.shiftTries ?? 0) + 1, o.retries.push(() => o.afterCommit?.()));
}
function lr(n, a, r = null) {
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
    let J = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[o["justify-content"]];
    if (U) {
      const h = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[o["justify-items"]];
      h && (s.items = h), o["align-items"] === "center" && (J = "center");
    }
    J && (s.justify = J);
    const B = hn(o["row-gap"]), g = hn(o["column-gap"]);
    typeof B == "number" && B && (s.gap_y = B), typeof g == "number" && g && !U && (s.gap_x = g);
  }
  o["flex-grow"] && (s.flex_grow = o["flex-grow"]), o["flex-shrink"] !== 1 && (s.flex_shrink = o["flex-shrink"]);
  const v = hn(o["flex-basis"]);
  v !== void 0 && v !== "auto" && (s.flex_basis = v);
  const x = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[o["align-self"]];
  x && (s.self = x);
  for (const [U, F] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const J = o[F], B = hn(J);
    if (B === void 0 && F === "width" && ab(J, o)) {
      s.self = "stretch", a("approximated", F, J.expr, u(F), "stretched across its parent, inside its margins");
      continue;
    }
    const g = B === void 0 && /^max-/.test(F) ? nb(J, o["font-size"]) : void 0;
    if (g !== void 0) {
      s[U] = g, a("approximated", F, J.expr, u(F), "the fixed bound of min()");
      continue;
    }
    if (B === void 0) {
      typeof J == "object" && J.expr ? a("unsupported", F, J.expr, u(F), "no calc() in the engine") : typeof J == "string" && !["auto", "none"].includes(J) && a("unsupported", F, J, u(F));
      continue;
    }
    B !== "auto" && (s[U] = B);
  }
  const y = ["top", "right", "bottom", "left"];
  for (const U of y) {
    const F = U[0];
    for (const [J, B] of [["p", "padding"], ["m", "margin"]]) {
      const g = o[`${B}-${U}`], h = hn(g);
      if (h === void 0) {
        g?.expr && a("unsupported", `${B}-${U}`, g.expr, u(`${B}-${U}`), "no calc() in the engine");
        continue;
      }
      h !== 0 && (s[`${J}${F}`] = h);
    }
  }
  const b = o.position;
  if (b === "absolute" || b === "fixed") {
    s.position = "absolute", b === "fixed" && a("approximated", "position", "fixed", u("position"), "absolute in the overlay layer");
    for (const U of y) {
      const F = hn(o[U]);
      F !== void 0 && F !== "auto" && (s[U] = F);
    }
    if (b === "fixed" && r && s.w === void 0 && s.right === void 0 && typeof s.left == "number") {
      const U = r.width - s.left - (typeof s.ml == "number" ? s.ml : 0) - (typeof s.mr == "number" ? s.mr : 0);
      s.max_w = typeof s.max_w == "number" ? Math.min(s.max_w, U) : U;
    }
    xf(n, s, a);
  } else b === "sticky" ? a("unsupported", "position", "sticky", u("position")) : xm(o)?.length !== 0 && (s.position = "relative", xf(n, s, a, !0));
  o["z-index"] !== "auto" && m("z-index") && a("unsupported", "z-index", o["z-index"], u("z-index"), "paint order is tree order");
  for (const [U, F] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const J = o[F];
    J === "hidden" || J === "clip" ? s[U] = "hidden" : (J === "auto" || J === "scroll") && (s[U] = "scroll");
  }
  (o.visibility === "hidden" || o.visibility === "collapse") && (s.visibility = "invisible");
  const S = o["background-color"];
  S?.unreadable ? a("unsupported", "background-color", S.unreadable, u("background-color")) : S?.rgba && S.rgba[3] > 0 && (s.bg = nr(S)), o["background-image"] && o["background-image"] !== "none" && a("unsupported", "background-image", o["background-image"], u("background-image"));
  const N = y.map((U) => hn(o[`border-${U}-width`]) || 0), E = [];
  y.forEach((U, F) => {
    if (!N[F]) return;
    s[`border_${U[0]}`] = N[F];
    const J = o[`border-${U}-style`];
    J !== "solid" && a("approximated", `border-${U}-style`, J, u(`border-${U}-style`), "drawn solid");
    const B = nr(o[`border-${U}-color`]);
    B && E.push(B);
  }), E.length && (s.border_color = E[0], E.some((U) => U.value !== E[0].value) && a("approximated", "border-color", E.map((U) => U.value).join(" "), u("border-top-color"), "one border colour"));
  const T = (U) => {
    const F = hn(o[`border-${U}-radius`]) || 0;
    if (typeof F != "string") return F;
    const J = parseFloat(F) / 100, B = [s.w, s.h].filter((g) => typeof g == "number");
    return F === "auto" || !(J > 0) ? 0 : B.length ? Math.round(Math.min(J, 0.5) * Math.min(...B) * 100) / 100 : 9999;
  }, j = ["top-left", "top-right", "bottom-right", "bottom-left"].map(T);
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
const ib = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function _m(n) {
  if (!n || n === "normal") return "";
  const a = String(n).trim().split(/\s+/).map((r) => ib[r]);
  return a.every(Boolean) ? a.join(",") : null;
}
function ir(n, a) {
  const r = n.values, o = r["line-height"];
  return {
    text_color: nr(r.color),
    text_size: Math.round(r["font-size"] * 1e3) / 1e3,
    font_features: _m(r["font-variant-numeric"]) ?? "",
    font_weight: r["font-weight"],
    line_height: o.factor !== void 0 ? { factor: o.factor } : { px: Math.round(Nl(r, a) * 1e3) / 1e3 },
    font_family: P0(r["font-family"]),
    italic: r["font-style"] === "italic" || r["font-style"] === "oblique",
    whitespace: r["white-space"] === "nowrap" || r["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[r["text-align"]] ?? "left"
  };
}
const wf = (n, a) => n.factor !== void 0 ? n.factor * a : n.px, Xs = (n, a) => JSON.stringify(n) === JSON.stringify(a);
function rr(n, a, r) {
  const o = {}, s = (f, p) => p.some((v) => !n.inherited.has(v));
  for (const [f, p] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (s(f, p) || !Xs(a[f], r[f])) && (o[f] = a[f]);
  const u = wf(a.line_height, a.text_size), m = r.line_height ? wf(r.line_height, a.text_size) : NaN;
  return (s("line_height", ["line-height"]) || !(Math.abs(u - m) <= 1e-3)) && (o.line_height = a.line_height), o;
}
const rb = (n, a) => ({ ...n, ...a });
function or(n, a) {
  const r = {};
  for (const [o, s] of Object.entries(n))
    s && typeof s == "object" && "value" in s ? (r[o] = s.value, s.token && (a[o] = s.token)) : o === "line_height" ? r[o] = s.factor !== void 0 ? Math.round(s.factor * 1e3) / 1e3 : `${s.px}px` : o === "italic" ? s && (r.italic = !0) : r[o] = s;
  return r.italic === !1 && delete r.italic, r;
}
function km(n, a) {
  const r = {};
  for (const o of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(a)])) {
    const s = n[o], u = a[o];
    Xs(s, u) || (r[o] = u === void 0 ? o in ar ? ar[o] : null : u);
  }
  return r;
}
function _f(n, a) {
  const r = n.values;
  for (const [o, s] of Object.entries(n.sources)) {
    if (o.startsWith("--") || W0.has(o) || s.startsWith("ua:")) continue;
    const u = r[o];
    switch (o) {
      case "letter-spacing":
        u !== "normal" && u?.px !== 0 && a("approximated", o, u?.px !== void 0 ? `${Math.round(u.px * 1e3) / 1e3}px` : u, s, u?.px < 0 ? "the run's box is as wide as with the spacing (the glyphs reach past it; where the element clips, the run is drawn smaller to fit)" : "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        u !== "normal" && _m(u) === null && a("unsupported", o, u, s);
        break;
      case "text-transform":
        u !== "none" && a("approximated", o, u, s, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const m = r["transition-duration"];
        o === "transition-property" && m && oe(m, ",").some((f) => parseFloat(f) > 0) && r["transition-property"] !== "none" && a("unsupported", "transition", `${r["transition-property"]} ${m}`, s, "changes are instant (the engine animates only opacity and size)");
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
        r["outline-style"] !== "none" && o === "outline-style" && a("unsupported", "outline", `${hn(r["outline-width"])}px ${r["outline-style"]} ${nr(r["outline-color"])?.value ?? ""}`.trim(), s, "no outline in the engine (no focus ring)");
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
function ob(n, a, r, o) {
  const s = o.cascade.sheet.depends(n), u = n.ownerDocument?.activeElement, m = !!u && u !== n.ownerDocument.body;
  if (s.has || s.focusWithin && m || !o.cascade.pass) {
    const b = Sf(n, a, r, o), S = kf(n);
    return b.meta = S.meta, S.events.length && (b.extra.events = S.events), b;
  }
  const f = o.cascade.parts ??= /* @__PURE__ */ new Map(), p = `${o.cascade.partKey(n)}|${a ? Tl(a.values) : ""}|${r ? Tl(r) : ""}`;
  let v = f.get(p);
  v || (f.size > 2e4 && f.clear(), v = Sf(n, a, r, o), v.computed = { ...v.computed, element: { hidden: !!n.hidden } }, f.set(p, v));
  const x = { ...v.extra };
  x.group && (x.group = sr(n)), x.group_hover && (x.group_hover = x.group_hover.map((b, S) => {
    let N = n;
    for (let E = 0; E < v.groupsUp[S]; E++) N = N.parentNode;
    return { ...b, group: sr(N) };
  }));
  const y = kf(n);
  return y.events.length && (x.events = y.events), {
    ...v,
    extra: x,
    meta: y.meta,
    reports: v.reports.length ? v.reports.map(([b, S, N, E, , T]) => [b, S, N, E, Dl(n), T]) : v.reports
  };
}
function kf(n) {
  const a = n.props, r = {};
  let o = 0;
  for (const u in a) {
    const m = a[u];
    if (typeof m == "function") {
      o |= vf[u] ?? 0;
      continue;
    }
    if (zm.has(u) || m === void 0 || m === null || typeof m == "object") continue;
    const f = u.startsWith("aria-") || u.startsWith("data-");
    if (m === !1 && !f) continue;
    const p = u === "htmlFor" ? "for" : u === "tabIndex" ? "tabindex" : u;
    r[p] = typeof m == "boolean" ? f ? String(m) : "" : String(m);
  }
  const s = [];
  if (o) for (let u = 0; u < bf.length; u++) o & 1 << u && s.push(bf[u]);
  return !(o & vf.onClick) && _s(n) && s.push("click"), { meta: { tag: n.tagName, get classes() {
    return n.classList;
  }, attrs: r }, events: s };
}
function Sf(n, a, r, o) {
  const s = Dl(n), u = {}, m = o.cascade.compute(n, a, /* @__PURE__ */ new Set(), null, u), f = o.cascade.matching(n, "*").filter((R) => R.states.subject.size), p = [];
  for (const [R, U] of sb)
    f.some((F) => U.some((J) => F.states.subject.has(J))) && p.push([R, o.cascade.compute(n, a, new Set(U), null, u)]);
  const v = `${Tl(m.shared)}|${Tl(r)}|${+!!m.element.hidden}|${p.map(([R, U]) => `${R}${Tl(U.shared)}`).join(",")}`;
  let x = (o.cascade.styled ??= /* @__PURE__ */ new Map()).get(v);
  x || o.cascade.styled.set(v, x = ub(m, p, r, o));
  const { style: y, tokens: b, shift: S, childText: N } = x, E = x.reports.map(([R, U, F, J, B]) => [R, U, F, J, s, B]), T = { ...x.extra }, j = [];
  if (o.cascade.sheet.tracks(n, "hover") && (T.group = sr(n), T.track_hover = !0), o.cascade.sheet.readsAncestor(n, "hover"))
    for (let R = n.parentNode, U = 1; R?.state; R = R.parentNode, U++) {
      if (!o.cascade.sheet.tracks(R, "hover")) continue;
      const F = R.state.hover;
      R.state.hover = !0;
      let J;
      const B = o.cascade.pass;
      o.cascade.pass = null;
      try {
        J = o.cascade.compute(n, a);
      } finally {
        R.state.hover = F, o.cascade.pass = B;
      }
      const g = {}, h = or({ ...lr(J, () => {
      }), ...rr(J, ir(J, o.measure), r) }, g), _ = km(y, h);
      if (!Object.keys(_).length) continue;
      const k = Object.fromEntries(Object.entries(g).filter(([z]) => z in _));
      (T.group_hover ??= []).push({ group: sr(R), style: _, ...Object.keys(k).length ? { tokens: k } : {} }), j.push(U);
    }
  if (/tabular/.test(String(m.values["font-variant-numeric"] ?? "")) && (T.tabular = !0), /^(anywhere|break-word)$/.test(String(m.values["overflow-wrap"] ?? "")) && (T.break_anywhere = !0), x.scrolls) {
    const R = Number.parseFloat(m.customs?.["--scrollbar-size"] ?? "");
    R > 0 && (T.scrollbar = R);
  }
  return m.values["pointer-events"] !== "none" && a?.values["pointer-events"] === "none" && (T.blocks_pointer = !0), m.values["pointer-events"] === "none" && (T.pointer_none = !0), { computed: m, style: y, tokens: b, extra: T, reports: E, childText: N, shift: S, groupsUp: j };
}
const sb = [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]], Ef = /* @__PURE__ */ new WeakMap();
let cb = 0;
function Tl(n) {
  let a = Ef.get(n);
  return a === void 0 && Ef.set(n, a = ++cb), a;
}
function ub(n, a, r, o) {
  const s = [], u = (b, S, N, E, T) => s.push([b, S, N, E ?? "(user agent)", T]), m = {}, f = lr(n, u, o.viewport);
  _f(n, u);
  const p = ir(n, o.measure), v = rr(n, p, r), x = or({ ...f, ...v }, m), y = {};
  for (const [b, S] of a) {
    const N = {}, E = or({ ...lr(S, () => {
    }), ...rr(S, ir(S, o.measure), r) }, N);
    b === "focus" && _f(S, u);
    const T = km(x, E);
    if (Object.keys(T).length) {
      y[b] = T;
      const j = Object.fromEntries(Object.entries(N).filter(([R]) => R in T));
      Object.keys(j).length && (y[`${b}_tokens`] = j);
    }
  }
  return { style: x, tokens: m, shift: f[wm], childText: rb(r, v), extra: y, scrolls: f.overflow_y === "scroll", reports: s };
}
function db(n, a, r, o) {
  const s = { before: null, after: null };
  for (const u of ["before", "after"]) {
    if (!o.cascade.matching(n, /* @__PURE__ */ new Set(), u).length) continue;
    const m = o.cascade.compute(n, a, /* @__PURE__ */ new Set(), u), f = String(m.values.content ?? "none").trim();
    if (f === "none" || f === "normal") continue;
    const p = /^(["'])(.*)\1$/.exec(f)?.[2] ?? "", v = (N, E, T, j, R) => o.add(N, E, T, j ?? "(user agent)", `${Dl(n)}::${u}`, R), x = {}, y = lr(m, v, o.viewport), S = { kind: "div", style: or({ ...y, ...rr(m, ir(m, o.measure), r) }, x), tokens: x, children: p ? [{ kind: "text", text: p }] : [] };
    Object.defineProperty(S, Le, { value: m.values.display }), s[u] = S;
  }
  return s;
}
const sr = (n) => `~g${n.id}`, fb = ["pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "border_t", "border_r", "border_b", "border_l", "bg"];
function mb(n) {
  return n.kind === "div" && n[Le] === "inline" && !n.events?.length && !n.meta?.attrs?.["data-testid"] && !fb.some((a) => n.style?.[a]) && n.children?.every((a) => a.kind === "text");
}
function Gi(n, a) {
  const r = n[a], o = { ...r, style: { ...r.style } };
  return Object.defineProperty(o, Le, { value: r[Le] }), n[a] = o, o;
}
function pb(n) {
  const a = [];
  for (let r = n.parentElement; r?.parentElement; r = r.parentElement) {
    const o = r.parentElement.children;
    a.push(`${+(o[0] === r)}${+(o[o.length - 1] === r)}`);
  }
  return a.join("");
}
function Sm(n, a, r, o, s = 0, u = !0, m = !0, f = 0) {
  const p = o.cascade.sheet.depends(n), v = p.pos ? `${+u}${+m}${p.nth ? `:${f}` : ""}` : "", x = p.ancPos ? pb(n) : "";
  let y = o.cache.get(n);
  const b = y && y.version === n.version && y.parentValues === a?.values && y.inheritedText === r && y.pos === v && y.ancPos === x && (!p.anc || s <= y.at);
  if (b && y.node && y.stamp === n.stamp && !y.volatile && (!y.subAnc || s <= y.subAt)) {
    for (const T of y.log) o.add(...T);
    return y.node;
  }
  if (!b) {
    const T = ob(n, a, r, o);
    y && Xs(y.part.childText, T.childText) && (T.childText = y.part.childText), y = { version: n.version, parentValues: a?.values, inheritedText: r, pos: v, ancPos: x, at: o.now, part: T }, o.cache.set(n, y);
  }
  const S = o.log.length, N = { volatile: !!y.part.shift || p.ancPos, subAnc: p.anc }, E = hb(n, y, o, Math.max(s, n.attrStamp), N);
  return Object.assign(y, { node: E, stamp: n.stamp, subAt: o.now, log: o.log.slice(S), volatile: N.volatile, subAnc: N.subAnc }), E;
}
function hb(n, a, r, o, s) {
  const { computed: u, tokens: m, extra: f, reports: p, childText: v } = a.part;
  for (const h of p) r.add(...h);
  const x = (h, _, k, z, O) => r.add(h, _, k, z, Dl(n), O), y = { ...a.part.style };
  a.part.shift && lb(n, y, a.part.shift);
  const b = { kind: "div", id: n.id, style: y, tokens: m, meta: a.part.meta, ...f };
  Object.defineProperty(b, Le, { value: u.values.display }), n.measured && n.ownerDocument?.measureKey && (b.measure = n.ownerDocument.measureKey(n));
  const S = n.tagName;
  if (n.props["data-perch-engine"] != null)
    return b.kind = "engine", b.engine = String(n.props["data-perch-engine"]), b.key = String(n.props["data-perch-key"] ?? ""), b;
  if (S === "svg")
    return b.kind = n.props["data-perch-image"] ? "image" : "svg", b.markup = yb(n), b;
  if (S === "input" || S === "textarea" || S === "select") {
    b.kind = "input", b.input_type = S === "input" ? String(n.props.type ?? "text") : S;
    for (const k of ["placeholder", "checked", "disabled"]) n.props[k] !== void 0 && (b[k] = n.props[k]);
    if (/^(checkbox|radio)$/.test(b.input_type) && (b.checked = n.checked), S !== "select" && (b.value = n.value), y.cursor === void 0 && !n.props.disabled && (S === "textarea" || ds.test(b.input_type)) && (y.cursor = "text"), n.state.focus && (S === "textarea" || ds.test(b.input_type)) && !n.props.disabled && !n.props.readOnly && (b.caret = !0), S === "input" && ds.test(b.input_type) && (b.field_w = eb * u.values["font-size"]), S === "textarea" && y.h === void 0) {
      const k = u.values, z = (G) => G && typeof G == "object" && "px" in G ? G.px : 0, O = (G) => k[`border-${G}-style`] === "none" ? 0 : z(k[`border-${G}-width`]), A = Number(n.props.rows) > 0 ? Math.floor(Number(n.props.rows)) : 2;
      y.h = A * Nl(k, r.measure) + z(k["padding-top"]) + z(k["padding-bottom"]) + O("top") + O("bottom");
    }
    const { before: h, after: _ } = db(n, u, v, r);
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
  const N = u.values["text-transform"], E = [];
  let T = !1, j = !1;
  const R = n.childNodes.reduce((h, _) => h + (_ instanceof Zt ? 1 : 0), 0);
  let U = 0;
  for (const h of n.childNodes) {
    if (h instanceof hr) {
      if (h.hidden || h.data === "") continue;
      T = !0;
      const O = E[E.length - 1];
      if (O?.kind === "text")
        O.source = (O.source ?? O.text) + h.data, O.text = Nf(O.source, N), O.text === O.source && delete O.source;
      else {
        const A = Nf(h.data, N);
        E.push(A === h.data ? { kind: "text", text: A } : { kind: "text", text: A, source: h.data });
      }
      continue;
    }
    if (!(h instanceof Zt)) continue;
    const _ = Sm(h, u, v, r, o, U === 0, U === R - 1, U);
    U++;
    const k = r.cache.get(h);
    s.volatile ||= k.volatile, s.subAnc ||= k.subAnc;
    const z = _[Le];
    z === "inline" || z === "inline-block" || z === "inline-flex" ? T = !0 : z !== "none" && (j = !0), E.push(_);
  }
  if (/(^|\s)inline-flex(\s|$)/.test(String(n.props?.className ?? "")) && y.w === void 0) {
    for (let h = 0; h < E.length; h++)
      if (E[h].style?.flex_grow && E[h].style.min_w === 0 && E[h].style.overflow_x === "hidden") {
        const _ = Gi(E, h);
        delete _.style.min_w, delete _.style.flex_grow, delete _.style.flex_basis, delete _.style.overflow_x, delete _.style.overflow_y;
      }
  }
  if (!y.display && T && E.some((h) => h.kind !== "text") && E.every((h) => h.kind === "text" || mb(h))) {
    const h = E.map((_) => _.kind === "text" ? _.text : _.children.map((k) => k.text).join("")).join("");
    x("approximated", "display", "inline text elements in a line of text", "(inline formatting)", "their text joined to the line, in its font"), E.splice(0, E.length, { kind: "text", text: h });
  }
  const F = E.some((h) => h.kind !== "text");
  let J = E.length === 1 && E[0].kind !== "text" && /^inline-(block|flex)$/.test(E[0][Le]) ? E[0] : null;
  if (!y.display && J) {
    J = Gi(E, 0);
    const h = r.cache.get(n.childNodes.find((k) => k.id === J.id))?.part.computed, _ = h ? Cl(u.values, r.measure) - zf(h.values, r.measure, J) : 0;
    y.display = "flex", y.flex_direction = "col", y.items = "start", _ > 0 && (J.style.mt = Math.round(((J.style.mt ?? 0) + _) * 100) / 100), x("approximated", "display", `${u.values.display} holding one ${J[Le]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!y.display && E.length === 1 && (E[0].kind === "svg" || E[0].kind === "image") && E[0][Le] === "inline" && typeof E[0].style.h == "number") {
    const h = Gi(E, 0), _ = Cl(u.values, r.measure), k = Nl(u.values, r.measure) - _, z = (O) => Math.round(O * 100) / 100;
    y.display = "flex", y.flex_direction = "col", y.items = "start", _ > h.style.h && (h.style.mt = z((h.style.mt ?? 0) + _ - h.style.h)), k > 0 && (h.style.mb = z((h.style.mb ?? 0) + k)), x("approximated", "display", `${u.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!y.display && T && F) {
    if (y.display = "flex", y.flex_direction = j ? "col" : "row", !j) y.items = "baseline";
    else {
      const h = (_) => E[_] && (E[_].kind === "text" || !/^(block|flex|grid|table|list-item)$/.test(E[_][Le] ?? "block"));
      for (let _ = 0; _ < E.length; _++) {
        if (E[_].kind === "text" || !/^inline-(block|flex)$/.test(E[_][Le])) continue;
        const k = Gi(E, _);
        if (k.style.self ??= "start", h(_ - 1) || h(_ + 1)) continue;
        const z = r.cache.get(n.childNodes.find((A) => A.id === k.id))?.part.computed, O = z ? Cl(u.values, r.measure) - zf(z.values, r.measure, k) : 0;
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
      const z = u.values["font-size"], O = Math.max(0.8, 1 + B / (0.55 * z)), A = Math.round(Nl(u.values, r.measure) * 1e3) / 1e3;
      E[h] = { kind: "div", style: { text_size: Math.round(z * O * 1e3) / 1e3, line_height: `${A}px` }, tokens: {}, children: [_] };
    }
  return b.children = E, b;
}
function gb(n, a) {
  if (!a) return null;
  let o = (a.self ? n : a.closest ? lm(n, a.closest) : a.find ? Al(n, a.find)[0] : null)?.getAttribute(a.attr) ?? null;
  return o && a.strip && o.startsWith(a.strip) && (o = o.slice(a.strip.length)), o;
}
function bb(n, a, r) {
  const o = a.map((m) => [m, pr(m.selector)]), s = /* @__PURE__ */ new Map(), u = (m) => {
    for (const f of m.children) {
      const p = r.get(f.id);
      if (p)
        for (const [v, x] of o) {
          const y = v.textRange ? "range_name" : "name";
          if (v.textRange && p[y] != null || !x.some((E) => vs(f, E))) continue;
          const b = gb(f, v.key), S = b == null ? s.get(v.name) ?? 0 : 0;
          b == null && s.set(v.name, S + 1);
          const N = b != null ? `${v.name}:${b}` : S ? `${v.name}@${S}` : v.name;
          p[y] == null ? p[y] = N : (p.also ??= []).push(N);
        }
      u(f);
    }
  };
  u(n.documentElement);
}
const cr = 0.9521, Em = 0.2256, Cl = (n, a) => (Nl(n, a) - (cr + Em) * n["font-size"]) / 2 + cr * n["font-size"];
function zf(n, a, r) {
  const o = (p) => p && typeof p == "object" && "px" in p ? p.px : 0, s = n["border-top-style"] === "none" ? 0 : o(n["border-top-width"]), u = r?.children ?? [], m = u.length === 1 && (u[0].kind === "svg" || u[0].kind === "image") && typeof u[0].style.h == "number" ? u[0] : null, f = m ? Math.max(Cl(n, a), (m.style.mt ?? 0) + m.style.h) : Cl(n, a);
  return o(n["padding-top"]) + s + f;
}
const Nf = (n, a) => a === "uppercase" ? n.toUpperCase() : a === "lowercase" ? n.toLowerCase() : a === "capitalize" ? n.replace(/\b\p{L}/gu, (r) => r.toUpperCase()) : n, zm = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]), vb = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (a) => `-${a.toLowerCase()}`), Tf = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function yb(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const a = (r) => {
    const o = [];
    for (const [u, m] of Object.entries(r.props))
      zm.has(u) || typeof m == "function" || m === void 0 || m === null || m === !1 || typeof m == "object" || u.startsWith("data-") || u.startsWith("aria-") || u === "focusable" || u === "role" || u === "title" || o.push(`${vb(u)}="${Tf(m === !0 ? "" : m)}"`);
    r.tagName === "svg" && !r.props.xmlns && o.unshift('xmlns="http://www.w3.org/2000/svg"');
    const s = r.childNodes.map((u) => u instanceof hr ? Tf(u.data) : a(u)).join("");
    return `<${r.tagName}${o.length ? ` ${o.join(" ")}` : ""}>${s}</${r.tagName}>`;
  };
  return a(n);
}
function xb(n) {
  const a = n.theme?.() ?? {}, r = {};
  for (const o of mm) a[o] && (r[o] = a[o]);
  return r;
}
const wb = { font_features: "" }, Cf = /* @__PURE__ */ new WeakMap();
function _b(n, a, r, o) {
  const s = Cf.get(n);
  if (s?.look === a) return s.cascade;
  const u = new V0(n, { theme: r, viewport: o });
  return Cf.set(n, { look: a, cascade: u }), u;
}
function kb(n, a, r, o = {}, s = null) {
  const u = xb(a), m = a.viewport?.() ?? { width: 1e3, height: 800 }, f = JSON.stringify([u, m]);
  (o.look !== f || o.sheet !== r) && Object.assign(o, { look: f, sheet: r, cache: /* @__PURE__ */ new WeakMap(), cascade: _b(r, f, u, m), top: null });
  const { cascade: p, cache: v } = o, x = new tb(), y = [], S = { cascade: p, cache: v, viewport: m, findings: x, log: y, add: (...j) => {
    y.push(j), x.add(...j);
  }, now: xs(), measure: a.lineHeight ? (j) => a.lineHeight(j) : null };
  o.top ??= p.compute(n.body, p.compute(n.documentElement, null));
  const N = n.body.children;
  p.pass = {};
  let E;
  try {
    E = N.map((j, R) => Sm(j, o.top, wb, S, 0, R === 0, R === N.length - 1, R));
  } finally {
    p.pass = null;
  }
  if (s?.length) {
    const j = /* @__PURE__ */ new Map(), R = (U) => {
      U.id && (j.set(U.id, U), delete U.name, delete U.range_name, delete U.also);
      for (const F of U.children ?? []) R(F);
    };
    E.forEach(R), bb(n, s, j);
  }
  const T = /* @__PURE__ */ new Set();
  for (const j of [n, n.defaultView])
    for (const { type: R } of j?.listeners ?? []) yf[R] && T.add(yf[R]);
  return { schema: Z0, root: E[0] ?? null, overlays: E.slice(1), document_events: [...T].sort(), unsupported: S.findings.list() };
}
const Ga = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".right-full", null, 4, [["right", "100%"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-full", null, 4, [["left", "100%"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".-mt-\\[2px\\]", null, 4, [["margin-top", "-2px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.15rem\\]", null, 4, [["margin-bottom", ".15rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.45rem\\]", null, 4, [["margin-bottom", ".45rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-0\\.5", null, 4, [["margin-left", "calc(var(--spacing) * -.5)"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-\\[0\\.3rem\\]", null, 4, [["margin-left", ".3rem"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.15rem\\]", null, 4, [["margin-left", "1.15rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[2\\.025rem\\]", null, 4, [["margin-left", "2.025rem"]]], [".ml-\\[2\\.375rem\\]", null, 4, [["margin-left", "2.375rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-2\\.5", null, 4, [["width", "calc(var(--spacing) * 2.5)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-11", null, 4, [["width", "calc(var(--spacing) * 11)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-60", null, 4, [["width", "calc(var(--spacing) * 60)"]]], [".w-\\[0\\.7rem\\]", null, 4, [["width", ".7rem"]]], [".w-\\[0\\.9rem\\]", null, 4, [["width", ".9rem"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[3\\.6rem\\]", null, 4, [["width", "3.6rem"]]], [".w-\\[5\\.2rem\\]", null, 4, [["width", "5.2rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[17rem\\]", null, 4, [["width", "17rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[11rem\\]", null, 4, [["max-width", "11rem"]]], [".max-w-\\[12rem\\]", null, 4, [["max-width", "12rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(42rem\\,calc\\(100cqi-6\\.9rem\\)\\)\\]", null, 4, [["max-width", "min(42rem, 100cqi - 6.9rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-11", null, 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[8rem\\]", null, 4, [["min-width", "8rem"]]], [".min-w-\\[13rem\\]", null, 4, [["min-width", "13rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-initial", null, 4, [["flex", "0 auto"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.2rem\\]", null, 4, [["gap", ".2rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.15rem\\]", null, 4, [["gap", ".15rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.4rem\\]", null, 4, [["column-gap", ".4rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-x-hidden", null, 4, [["overflow-x", "hidden"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overflow-y-hidden", null, 4, [["overflow-y", "hidden"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".overscroll-x-contain", null, 4, [["overscroll-behavior-x", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".rounded-bl-\\[6px\\]", null, 4, [["border-bottom-left-radius", "6px"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_22\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_22\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 22%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.35rem\\]", null, 4, [["padding", ".35rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.35rem\\]", null, 4, [["padding-bottom", ".35rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-1\\.5", null, 4, [["padding-left", "calc(var(--spacing) * 1.5)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.075rem\\]", null, 4, [["padding-left", "1.075rem"]]], [".pl-\\[1\\.525rem\\]", null, 4, [["padding-left", "1.525rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\], .font-mono", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-100", null, 4, [["opacity", "1"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-left\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-left", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/submenu\\:block:is(:where(.group\\/submenu):hover *)", null, 4, [["display", "block"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:px-4", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".\\@max-\\[460px\\]\\:mx-1", ["not (min-width: 460px)"], 4, [["margin-inline", "var(--spacing)"]]], [".\\@max-\\[460px\\]\\:hidden", ["not (min-width: 460px)"], 4, [["display", "none"]]], [".\\@min-\\[461px\\]\\:flex", ["(min-width: 461px)"], 4, [["display", "flex"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-fg:hover:not(:disabled)", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@container\\(max-width\\:460px\\)\\]\\:min-h-11", ["(max-width: 460px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\@container\\(max-width\\:460px\\)\\]\\:min-h-\\[2\\.5rem\\]", ["(max-width: 460px)"], 4, [["min-height", "2.5rem"]]], [".\\[\\@container\\(max-width\\:460px\\)\\]\\:max-w-full", ["(max-width: 460px)"], 4, [["max-width", "100%"]]], [".\\[\\@container\\(max-width\\:460px\\)\\]\\:min-w-0", ["(max-width: 460px)"], 4, [["min-width", "0"]]], [".\\[\\@container\\(max-width\\:460px\\)\\]\\:flex-\\[1_1_9rem\\]", ["(max-width: 460px)"], 4, [["flex", "9rem"]]], [".\\[\\@container\\(max-width\\:460px\\)\\]\\:flex-\\[1_1_100\\%\\]", ["(max-width: 460px)"], 4, [["flex", "100%"]]], [".\\[\\@container\\(max-width\\:460px\\)\\]\\:grid-cols-\\[1fr\\]", ["(max-width: 460px)"], 4, [["grid-template-columns", "1fr"]]], [".\\[\\@container\\(max-width\\:460px\\)\\]\\:flex-col", ["(max-width: 460px)"], 4, [["flex-direction", "column"]]], [".\\[\\@container\\(max-width\\:460px\\)\\]\\:flex-wrap", ["(max-width: 460px)"], 4, [["flex-wrap", "wrap"]]], [".\\[\\@container\\(max-width\\:460px\\)\\]\\:items-start", ["(max-width: 460px)"], 4, [["align-items", "flex-start"]]], [".\\[\\@container\\(max-width\\:460px\\)\\]\\:\\[border-right\\:none\\]", ["(max-width: 460px)"], 4, [["border-right", "none"]]], [".\\[\\@container\\(max-width\\:700px\\)\\]\\:ml-\\[5\\.2rem\\]", ["(max-width: 700px)"], 4, [["margin-left", "5.2rem"]]], [".\\[\\@container\\(max-width\\:700px\\)\\]\\:grid-cols-\\[2\\.1rem_2\\.1rem_0\\.8rem_minmax\\(0\\,1fr\\)\\]", ["(max-width: 700px)"], 4, [["grid-template-columns", "2.1rem 2.1rem .8rem minmax(0, 1fr)"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__line-comment-thread", ["(max-width: 700px)"], 1e3, [["max-width", "max(0px, 100cqi - 5.6rem)"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@keyframes": 9 }, digest: "afffbc589d8ebe66" };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
const Ya = globalThis[Symbol.for("perch.styleSheets")] ??= /* @__PURE__ */ new Map();
let kl = null;
function Sb() {
  return kl || (kl = Ga.digest && Ya.get(Ga.digest) || new D0(Ga), Ga.digest && !Ya.has(Ga.digest) && (Ya.size >= 4 && Ya.delete(Ya.keys().next().value), Ya.set(Ga.digest, kl)), kl);
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
let Gn = Va.NoEventPriority;
function Eb(n, a) {
  const r = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(a)]);
  for (const o of r) {
    if (o === "children") continue;
    const s = n[o], u = a[o];
    if (!(s === u || typeof s == "function" && typeof u == "function") && !(o === "style" && s && u && typeof s == "object" && typeof u == "object" && [.../* @__PURE__ */ new Set([...Object.keys(s), ...Object.keys(u)])].every((f) => s[f] === u[f])))
      return !0;
  }
  return !1;
}
const zb = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function Mf(n, a) {
  for (const r of Pg(a.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(r);
  return n;
}
const Nm = {
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
  createInstance: (n, a, r) => Mf(new Zt(n, a, r.ownerDocument), a),
  createTextInstance: (n, a) => new hr(n),
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
  commitUpdate: (n, a, r, o) => {
    if (n.props = o, n.inline) for (const s of Object.keys(n.inline)) r.style?.[s] !== o.style?.[s] && delete n.inline[s];
    if (r.dangerouslySetInnerHTML?.__html !== o.dangerouslySetInnerHTML?.__html) {
      for (const s of [...n.childNodes]) n.removeChild(s);
      Mf(n, o);
    }
    Eb(r, o) && n.touch();
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
    Gn = n;
  },
  getCurrentUpdatePriority: () => Gn,
  resolveUpdatePriority: () => Gn !== Va.NoEventPriority ? Gn : Va.DefaultEventPriority,
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
let pe = fm(Nm), Cs = 0;
function Af() {
  pe.isAlreadyRendering() && (x0.unstable_recoverFromCut?.(), pe = fm(Nm), Cs += 1, Gn = Va.NoEventPriority);
}
const Bl = (n, a, r = null) => pe.createPortal(n, a, null, r), Nb = {
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
}, Tb = /* @__PURE__ */ new Set(["click", "dblclick", "mousedown", "mouseup"]), Cb = /* @__PURE__ */ new Set(["button", "input", "select", "textarea", "fieldset"]), Mb = (n) => {
  for (let a = n; a instanceof Zt; a = a.parentNode) if (a.props.disabled && Cb.has(a.tagName)) return !0;
  return !1;
};
class Ab {
  constructor(a, r, o) {
    Object.assign(this, { clientX: 0, clientY: 0, button: 0, buttons: 0, pointerType: "mouse", key: "", code: "", shiftKey: !1, metaKey: !1, ctrlKey: !1, altKey: !1, repeat: !1, isComposing: !1, keyCode: 0 }, r), this.type = a, this.target = o, this.currentTarget = null, this.defaultPrevented = !1, this.propagationStopped = !1, this.timeStamp = Date.now();
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
function Yi(n, a, r) {
  a.currentTarget = n;
  for (const { type: o, listener: s, capture: u } of [...n.listeners ?? []])
    o === a.type && u === r && s.call(n, a);
  if (n instanceof Zt) {
    const o = Nb[a.type], s = o && n.props[r ? `${o}Capture` : o];
    typeof s == "function" && s(a);
  }
}
function Jx(n, a, r = {}) {
  const { document: o, window: s, globals: u } = l0(n), m = new Zt("div", { id: "root", style: r.container ?? {} }, o);
  o.body.appendChild(m);
  const f = [];
  let p = null;
  const v = () => [o, s].map((h) => h.listeners.map((_) => `${_.type}:${_.capture}`).sort().join(",")).join("|");
  let x = "";
  const y = {}, b = `m${Math.random().toString(36).slice(2, 10)}:`;
  let S = 0, N = -1;
  o.measureKey = (h) => b + h.id, o.stale = () => N !== S, o.computed = (h) => {
    if (!y.cascade || !y.top) return null;
    const _ = [];
    for (let z = h; z instanceof Zt && z !== o.body; z = z.parentNode) _.unshift(z);
    let k = y.top;
    for (const z of _) k = y.cascade.compute(z, k);
    return k.values;
  };
  const E = () => (S += 1, p = kb(o, n, Sb(), y, r.names), x = v(), n.render?.(p), p);
  Af();
  const T = Cs, j = () => (Af(), T === Cs), R = () => {
    j() && (pe.flushPassiveEffects(), pe.flushSyncWork(), v() !== x && E());
  };
  o.afterCommit = E;
  const U = (h) => {
    f.push(h), n.error?.(h);
  }, F = pe.createContainer(m, Va.ConcurrentRoot, null, !1, null, "", U, U, U, null);
  pe.updateContainerSync(X.createElement(a, r.props ?? {}), F, null, null), pe.flushSyncWork(), R();
  const J = (h) => {
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
    Gn = Va.DiscreteEventPriority;
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
      const z = typeof h == "string" ? J(h) : h;
      if (!z || Tb.has(_) && Mb(z)) return !1;
      const O = new Ab(_, k, z), A = [];
      for (let D = z; D; D = _ === "scroll" ? null : D.parentNode) A.push(D);
      const G = [...A, o, s];
      B(() => {
        for (let D = G.length - 1; D > 0 && !O.propagationStopped; D--) Yi(G[D], O, !0);
        O.propagationStopped || (Yi(z, O, !0), O.propagationStopped || Yi(z, O, !1));
        for (let D = 1; D < G.length && !O.propagationStopped; D++) Yi(G[D], O, !1);
      });
      const W = _ === "click" && !O.defaultPrevented ? _s(z) : null;
      if (W && g.dispatch(W, "submit", {}), _ === "click" && !O.defaultPrevented)
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
      const z = h.key === "Enter" && !h.isComposing ? _s(_, !0) : null;
      if (z)
        return g.dispatch(z, "submit", {}), !0;
      if (!cm(_) || _.props.disabled || _.props.readOnly) return !1;
      if ((h.ctrlKey || h.metaKey) && !h.altKey && !h.shiftKey && h.key.toLowerCase() === "a")
        return _.selectedAll = !0, !0;
      if (h.ctrlKey || h.metaKey) return !1;
      const O = _.selectedAll;
      _.selectedAll = !1;
      const A = _.value, W = h.key === "Backspace" || O && h.key === "Delete" ? O ? "" : A.slice(0, -1) : [...h.key].length === 1 ? (O ? "" : A) + h.key : A;
      return W === A ? !1 : (_.value = W, g.dispatch(_, "input", { data: h.key }), g.dispatch(_, "change", {}), _.props.value !== void 0 && delete _.edit, _.touch(), E(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(h, _) {
      const k = J(h);
      k && (k.bounds = { x: _.x, y: _.y, width: _.width, height: _.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(h) {
      const _ = J(h);
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
    hovered: (h) => !!J(h)?.state.hover,
    hover(h, _) {
      const k = J(h);
      !k || k.state.hover === _ || (k.state.hover = _, k.touch(), E());
    },
    focus(h) {
      const _ = J(h);
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
      let k = typeof h == "string" ? J(h) : h;
      for (; k && !(k instanceof Zt && typeof k.props.onKeyDown == "function" && zb(k)); ) k = k.parentNode;
      !k || k === o.activeElement || (g.focus(k.id), k.state.pointerFocus = !0, k.touch(), E());
    },
    /** The engine is drawing the latest description: the boxes measured in this frame's layout are the tree's.
     * Returns whether effects wait for that layout (`measured`); run them with `retry` once the frame is drawn. */
    drawing() {
      return N = S, o.retries.length > 0;
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
const Tm = (n) => pe.flushSyncFromReconciler(n), jb = { createPortal: Bl, flushSync: Tm }, Wx = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Bl,
  default: jb,
  flushSync: Tm
}, Symbol.toStringTag, { value: "Module" }));
function Cm(n) {
  var a, r, o = "";
  if (typeof n == "string" || typeof n == "number") o += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var s = n.length;
    for (a = 0; a < s; a++) n[a] && (r = Cm(n[a])) && (o && (o += " "), o += r);
  } else for (r in n) n[r] && (o && (o += " "), o += r);
  return o;
}
function Mm() {
  for (var n, a, r = 0, o = "", s = arguments.length; r < s; r++) (n = arguments[r]) && (a = Cm(n)) && (o && (o += " "), o += a);
  return o;
}
const Ob = (n, a) => {
  const r = new Array(n.length + a.length);
  for (let o = 0; o < n.length; o++)
    r[o] = n[o];
  for (let o = 0; o < a.length; o++)
    r[n.length + o] = a[o];
  return r;
}, Rb = (n, a) => ({
  classGroupId: n,
  validator: a
}), Am = (n = /* @__PURE__ */ new Map(), a = null, r) => ({
  nextPart: n,
  validators: a,
  classGroupId: r
}), ur = "-", jf = [], Db = "arbitrary..", Bb = (n) => {
  const a = Ub(n), {
    conflictingClassGroups: r,
    conflictingClassGroupModifiers: o
  } = n;
  return {
    getClassGroupId: (m) => {
      if (m.startsWith("[") && m.endsWith("]"))
        return Hb(m);
      const f = m.split(ur), p = f[0] === "" && f.length > 1 ? 1 : 0;
      return jm(f, p, a);
    },
    getConflictingClassGroupIds: (m, f) => {
      if (f) {
        const p = o[m], v = r[m];
        return p ? v ? Ob(v, p) : p : v || jf;
      }
      return r[m] || jf;
    }
  };
}, jm = (n, a, r) => {
  if (n.length - a === 0)
    return r.classGroupId;
  const s = n[a], u = r.nextPart.get(s);
  if (u) {
    const v = jm(n, a + 1, u);
    if (v) return v;
  }
  const m = r.validators;
  if (m === null)
    return;
  const f = a === 0 ? n.join(ur) : n.slice(a).join(ur), p = m.length;
  for (let v = 0; v < p; v++) {
    const x = m[v];
    if (x.validator(f))
      return x.classGroupId;
  }
}, Hb = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const a = n.slice(1, -1), r = a.indexOf(":"), o = a.slice(0, r);
  return o ? Db + o : void 0;
})(), Ub = (n) => {
  const {
    theme: a,
    classGroups: r
  } = n;
  return qb(r, a);
}, qb = (n, a) => {
  const r = Am();
  for (const o in n) {
    const s = n[o];
    Zs(s, r, o, a);
  }
  return r;
}, Zs = (n, a, r, o) => {
  const s = n.length;
  for (let u = 0; u < s; u++) {
    const m = n[u];
    Gb(m, a, r, o);
  }
}, Gb = (n, a, r, o) => {
  if (typeof n == "string") {
    Yb(n, a, r);
    return;
  }
  if (typeof n == "function") {
    Lb(n, a, r, o);
    return;
  }
  Vb(n, a, r, o);
}, Yb = (n, a, r) => {
  const o = n === "" ? a : Om(a, n);
  o.classGroupId = r;
}, Lb = (n, a, r, o) => {
  if (Qb(n)) {
    Zs(n(o), a, r, o);
    return;
  }
  a.validators === null && (a.validators = []), a.validators.push(Rb(r, n));
}, Vb = (n, a, r, o) => {
  const s = Object.entries(n), u = s.length;
  for (let m = 0; m < u; m++) {
    const [f, p] = s[m];
    Zs(p, Om(a, f), r, o);
  }
}, Om = (n, a) => {
  let r = n;
  const o = a.split(ur), s = o.length;
  for (let u = 0; u < s; u++) {
    const m = o[u];
    let f = r.nextPart.get(m);
    f || (f = Am(), r.nextPart.set(m, f)), r = f;
  }
  return r;
}, Qb = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, Kb = (n) => {
  if (n < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let a = 0, r = /* @__PURE__ */ Object.create(null), o = /* @__PURE__ */ Object.create(null);
  const s = (u, m) => {
    r[u] = m, a++, a > n && (a = 0, o = r, r = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(u) {
      let m = r[u];
      if (m !== void 0)
        return m;
      if ((m = o[u]) !== void 0)
        return s(u, m), m;
    },
    set(u, m) {
      u in r ? r[u] = m : s(u, m);
    }
  };
}, Ms = "!", Of = ":", Xb = [], Rf = (n, a, r, o, s) => ({
  modifiers: n,
  hasImportantModifier: a,
  baseClassName: r,
  maybePostfixModifierPosition: o,
  isExternal: s
}), Zb = (n) => {
  const {
    prefix: a,
    experimentalParseClassName: r
  } = n;
  let o = (s) => {
    const u = [];
    let m = 0, f = 0, p = 0, v;
    const x = s.length;
    for (let E = 0; E < x; E++) {
      const T = s[E];
      if (m === 0 && f === 0) {
        if (T === Of) {
          u.push(s.slice(p, E)), p = E + 1;
          continue;
        }
        if (T === "/") {
          v = E;
          continue;
        }
      }
      T === "[" ? m++ : T === "]" ? m-- : T === "(" ? f++ : T === ")" && f--;
    }
    const y = u.length === 0 ? s : s.slice(p);
    let b = y, S = !1;
    y.endsWith(Ms) ? (b = y.slice(0, -1), S = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      y.startsWith(Ms) && (b = y.slice(1), S = !0)
    );
    const N = v && v > p ? v - p : void 0;
    return Rf(u, S, b, N);
  };
  if (a) {
    const s = a + Of, u = o;
    o = (m) => m.startsWith(s) ? u(m.slice(s.length)) : Rf(Xb, !1, m, void 0, !0);
  }
  if (r) {
    const s = o;
    o = (u) => r({
      className: u,
      parseClassName: s
    });
  }
  return o;
}, Jb = (n) => {
  const a = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((r, o) => {
    a.set(r, 1e6 + o);
  }), (r) => {
    const o = [];
    let s = [];
    for (let u = 0; u < r.length; u++) {
      const m = r[u], f = m[0] === "[", p = a.has(m);
      f || p ? (s.length > 0 && (s.sort(), o.push(...s), s = []), o.push(m)) : s.push(m);
    }
    return s.length > 0 && (s.sort(), o.push(...s)), o;
  };
}, Wb = (n) => ({
  cache: Kb(n.cacheSize),
  parseClassName: Zb(n),
  sortModifiers: Jb(n),
  postfixLookupClassGroupIds: Fb(n),
  ...Bb(n)
}), Fb = (n) => {
  const a = /* @__PURE__ */ Object.create(null), r = n.postfixLookupClassGroups;
  if (r)
    for (let o = 0; o < r.length; o++)
      a[r[o]] = !0;
  return a;
}, $b = /\s+/, Ib = (n, a) => {
  const {
    parseClassName: r,
    getClassGroupId: o,
    getConflictingClassGroupIds: s,
    sortModifiers: u,
    postfixLookupClassGroupIds: m
  } = a, f = [], p = n.trim().split($b);
  let v = "";
  for (let x = p.length - 1; x >= 0; x -= 1) {
    const y = p[x], {
      isExternal: b,
      modifiers: S,
      hasImportantModifier: N,
      baseClassName: E,
      maybePostfixModifierPosition: T
    } = r(y);
    if (b) {
      v = y + (v.length > 0 ? " " + v : v);
      continue;
    }
    let j = !!T, R;
    if (j) {
      const g = E.substring(0, T);
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
    const U = S.length === 0 ? "" : S.length === 1 ? S[0] : u(S).join(":"), F = N ? U + Ms : U, J = F + R;
    if (f.indexOf(J) > -1)
      continue;
    f.push(J);
    const B = s(R, j);
    for (let g = 0; g < B.length; ++g) {
      const h = B[g];
      f.push(F + h);
    }
    v = y + (v.length > 0 ? " " + v : v);
  }
  return v;
}, Pb = (...n) => {
  let a = 0, r, o, s = "";
  for (; a < n.length; )
    (r = n[a++]) && (o = Rm(r)) && (s && (s += " "), s += o);
  return s;
}, Rm = (n) => {
  if (typeof n == "string")
    return n;
  let a, r = "";
  for (let o = 0; o < n.length; o++)
    n[o] && (a = Rm(n[o])) && (r && (r += " "), r += a);
  return r;
}, tv = (n, ...a) => {
  let r, o, s, u;
  const m = (p) => {
    const v = a.reduce((x, y) => y(x), n());
    return r = Wb(v), o = r.cache.get, s = r.cache.set, u = f, f(p);
  }, f = (p) => {
    const v = o(p);
    if (v)
      return v;
    const x = Ib(p, r);
    return s(p, x), x;
  };
  return u = m, (...p) => u(Pb(...p));
}, ev = [], Ft = (n) => {
  const a = (r) => r[n] || ev;
  return a.isThemeGetter = !0, a.themeKey = n, a;
}, Dm = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, Bm = /^\((?:(\w[\w-]*):)?(.+)\)$/i, nv = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, av = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, lv = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, iv = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, rv = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, ov = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Dn = (n) => nv.test(n), yt = (n) => !!n && !Number.isNaN(Number(n)), Fe = (n) => !!n && Number.isInteger(Number(n)), fs = (n) => n.endsWith("%") && yt(n.slice(0, -1)), pn = (n) => av.test(n), Hm = () => !0, sv = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  lv.test(n) && !iv.test(n)
), Js = () => !1, cv = (n) => rv.test(n), uv = (n) => ov.test(n), dv = (n) => !it(n) && !rt(n), fv = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), mv = (n) => Ln(n, Gm, Js), it = (n) => Dm.test(n), ca = (n) => Ln(n, Ym, sv), Df = (n) => Ln(n, wv, yt), pv = (n) => Ln(n, Vm, Hm), hv = (n) => Ln(n, Lm, Js), Bf = (n) => Ln(n, Um, Js), gv = (n) => Ln(n, qm, uv), Li = (n) => Ln(n, Qm, cv), rt = (n) => Bm.test(n), Sl = (n) => fa(n, Ym), bv = (n) => fa(n, Lm), Hf = (n) => fa(n, Um), vv = (n) => fa(n, Gm), yv = (n) => fa(n, qm), Vi = (n) => fa(n, Qm, !0), xv = (n) => fa(n, Vm, !0), Ln = (n, a, r) => {
  const o = Dm.exec(n);
  return o ? o[1] ? a(o[1]) : r(o[2]) : !1;
}, fa = (n, a, r = !1) => {
  const o = Bm.exec(n);
  return o ? o[1] ? a(o[1]) : r : !1;
}, Um = (n) => n === "position" || n === "percentage", qm = (n) => n === "image" || n === "url", Gm = (n) => n === "length" || n === "size" || n === "bg-size", Ym = (n) => n === "length", wv = (n) => n === "number", Lm = (n) => n === "family-name", Vm = (n) => n === "number" || n === "weight", Qm = (n) => n === "shadow", _v = () => {
  const n = Ft("color"), a = Ft("font"), r = Ft("text"), o = Ft("font-weight"), s = Ft("tracking"), u = Ft("leading"), m = Ft("breakpoint"), f = Ft("container"), p = Ft("spacing"), v = Ft("radius"), x = Ft("shadow"), y = Ft("inset-shadow"), b = Ft("text-shadow"), S = Ft("drop-shadow"), N = Ft("blur"), E = Ft("perspective"), T = Ft("aspect"), j = Ft("ease"), R = Ft("animate"), U = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], F = () => [
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
  ], J = () => [...F(), rt, it], B = () => ["auto", "hidden", "clip", "visible", "scroll"], g = () => ["auto", "contain", "none"], h = () => [rt, it, p], _ = () => [Dn, "full", "auto", ...h()], k = () => [Fe, "none", "subgrid", rt, it], z = () => ["auto", {
    span: ["full", Fe, rt, it]
  }, Fe, rt, it], O = () => [Fe, "auto", rt, it], A = () => ["auto", "min", "max", "fr", rt, it], G = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], W = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], D = () => ["auto", ...h()], Q = () => [Dn, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...h()], I = () => [f, Dn, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...h()], Y = () => [Dn, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...h()], K = () => [n, rt, it], C = () => [...F(), Hf, Bf, {
    position: [rt, it]
  }], Z = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], at = () => ["auto", "cover", "contain", vv, mv, {
    size: [rt, it]
  }], st = () => [fs, Sl, ca], ct = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    v,
    rt,
    it
  ], ut = () => ["", yt, Sl, ca], Et = () => ["solid", "dashed", "dotted", "double"], $t = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ht = () => [yt, fs, Hf, Bf], Qn = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    N,
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
      color: [Hm],
      container: [pn],
      "drop-shadow": [pn],
      ease: ["in", "out", "in-out"],
      font: [dv],
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
        aspect: ["auto", "square", Dn, it, rt, T]
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
      "container-named": [fv],
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
        object: J()
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
        "auto-cols": A()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": A()
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
        justify: [...G(), "normal"]
      }],
      /**
       * Justify Items
       * @see https://tailwindcss.com/docs/justify-items
       */
      "justify-items": [{
        "justify-items": [...W(), "normal"]
      }],
      /**
       * Justify Self
       * @see https://tailwindcss.com/docs/justify-self
       */
      "justify-self": [{
        "justify-self": ["auto", ...W()]
      }],
      /**
       * Align Content
       * @see https://tailwindcss.com/docs/align-content
       */
      "align-content": [{
        content: ["normal", ...G()]
      }],
      /**
       * Align Items
       * @see https://tailwindcss.com/docs/align-items
       */
      "align-items": [{
        items: [...W(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Align Self
       * @see https://tailwindcss.com/docs/align-self
       */
      "align-self": [{
        self: ["auto", ...W(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Place Content
       * @see https://tailwindcss.com/docs/place-content
       */
      "place-content": [{
        "place-content": G()
      }],
      /**
       * Place Items
       * @see https://tailwindcss.com/docs/place-items
       */
      "place-items": [{
        "place-items": [...W(), "baseline"]
      }],
      /**
       * Place Self
       * @see https://tailwindcss.com/docs/place-self
       */
      "place-self": [{
        "place-self": ["auto", ...W()]
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
        block: ["auto", ...Y()]
      }],
      /**
       * Min-Block Size
       * @see https://tailwindcss.com/docs/min-block-size
       */
      "min-block-size": [{
        "min-block": ["auto", ...Y()]
      }],
      /**
       * Max-Block Size
       * @see https://tailwindcss.com/docs/max-block-size
       */
      "max-block-size": [{
        "max-block": ["none", ...Y()]
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
        text: ["base", r, Sl, ca]
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
        font: [o, xv, pv]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", fs, it]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [bv, hv, a]
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
        "line-clamp": [yt, "none", rt, Df]
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
        bg: Z()
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
        }, yv, gv]
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
        outline: ["", yt, Sl, ca]
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
          Vi,
          Li
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
        "inset-shadow": ["none", y, Vi, Li]
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
        "text-shadow": ["none", b, Vi, Li]
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
        mask: Z()
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
          Vi,
          Li
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
        "perspective-origin": J()
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
        origin: J()
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
        stroke: [yt, Sl, ca, Df]
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
}, kv = /* @__PURE__ */ tv(_v);
function jt(...n) {
  return kv(Mm(n));
}
function Sv(n, a, r) {
  return n.filter((o, s) => s !== a && (o.start + o.end) / 2 < r).length;
}
function Ev(n, a, r, o) {
  const s = n.map(() => 0), u = n[a];
  if (!u) return s;
  const m = n[a + 1], f = n[a - 1], p = u.end - u.start + (m ? m.start - u.end : f ? u.start - f.end : 0);
  return n.forEach((v, x) => {
    a < r && x > a && x <= r ? s[x] = -p : r < a && x >= r && x < a && (s[x] = p);
  }), s[a] = Math.min(Math.max(o, n[0].start - u.start), n[n.length - 1].end - u.end), s;
}
const Uf = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
function zv(n, a) {
  for (let r = n.parentElement; r; r = r.parentElement) {
    const o = getComputedStyle(r)[a === "x" ? "overflowX" : "overflowY"];
    if ((o === "auto" || o === "scroll") && (a === "x" ? r.scrollWidth > r.clientWidth : r.scrollHeight > r.clientHeight)) return r;
  }
  return null;
}
function Nv(n, a, r, o) {
  const s = n[a] ? zv(n[a], r) : null, u = () => s ? r === "x" ? s.scrollLeft : s.scrollTop : 0, m = (T) => (r === "x" ? T.clientX : T.clientY) + u(), f = m(o), p = u(), v = n.map((T) => {
    const j = T.getBoundingClientRect();
    return r === "x" ? { start: j.left + p, end: j.right + p } : { start: j.top + p, end: j.bottom + p };
  }), x = n.map((T) => Uf.map((j) => T.style[j])), y = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, b = r === "x" ? "translateX" : "translateY";
  let S = !1;
  const N = { to: a };
  n.forEach((T, j) => {
    if (T.style.pointerEvents = "none", j !== a) {
      y || (T.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)");
      return;
    }
    getComputedStyle(T).position === "static" && (T.style.position = "relative"), T.style.zIndex = "30", T.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
  });
  const E = (T, j) => {
    N.to = T, Ev(v, a, T, j).forEach((R, U) => {
      n[U].style.transform = R ? `${b}(${R}px)` : "";
    });
  };
  return {
    from: a,
    get to() {
      return N.to;
    },
    slot: (T) => Sv(v, a, m(T)),
    apply: (T, j) => {
      S || E(T, m(j) - f);
    },
    rest: () => {
      S || E(a, 0);
    },
    end: () => {
      S || (S = !0, n.forEach((T, j) => Uf.forEach((R, U) => {
        T.style[R] = x[j][U];
      })));
    }
  };
}
const Tv = 5;
let ms = !1;
function Cv(n, a) {
  if (n.button !== 0 || ms) return;
  const r = { clientX: n.clientX, clientY: n.clientY }, o = n.currentTarget, s = n.pointerId;
  let u = null, m, f = !1;
  const p = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect }, v = (N) => {
    if (f) return;
    f = !0, window.removeEventListener("pointermove", x), window.removeEventListener("pointerup", y), window.removeEventListener("pointercancel", b), window.removeEventListener("keydown", S, !0), window.removeEventListener("blur", b), o.removeEventListener("lostpointercapture", b);
    try {
      o.releasePointerCapture(s);
    } catch {
    }
    if (!u) return;
    ms = !1, document.body.style.cursor = p.cursor, document.body.style.userSelect = p.userSelect, u.end();
    const E = (T) => T.stopPropagation();
    window.addEventListener("click", E, { capture: !0, once: !0 }), setTimeout(() => window.removeEventListener("click", E, !0), 0), m?.(), a.onEnd(N, u);
  }, x = (N) => {
    if (!u) {
      if (Math.hypot(N.clientX - r.clientX, N.clientY - r.clientY) < Tv) return;
      const E = a.items();
      u = Nv(E, a.from(E), a.axis, r), ms = !0, document.body.style.cursor = "grabbing", document.body.style.userSelect = "none";
      try {
        o.setPointerCapture(s);
      } catch {
      }
      o.addEventListener("lostpointercapture", b);
      const T = a.onStart?.();
      m = typeof T == "function" ? T : void 0;
    }
    a.onMove(N, u);
  }, y = () => v(!0), b = () => v(!1), S = (N) => {
    N.key === "Escape" && (N.stopPropagation(), v(!1));
  };
  window.addEventListener("pointermove", x), window.addEventListener("pointerup", y), window.addEventListener("pointercancel", b), window.addEventListener("keydown", S, !0), window.addEventListener("blur", b);
}
const Km = typeof navigator < "u" && /Mac/i.test(navigator.platform), dr = {
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
for (let n = 1; n <= 12; n++) dr[`f${n}`] = `F${n}`;
const Mv = Object.fromEntries(Object.entries(dr).map(([n, a]) => [a, n])), Av = {
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
function jv(n) {
  const a = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return a ? a[1].toLowerCase() : Mv[n];
}
const qf = /* @__PURE__ */ new Map();
function Xm(n, a = Km) {
  const r = `${a}|${n}`, o = qf.get(r);
  if (o) return o;
  const s = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const u of n.split("+"))
    if (u === "mod")
      a ? s.cmd = !0 : (s.ctrl = !0, s.shift = !0);
    else if (u === "cmd" || u === "ctrl" || u === "shift" || u === "alt") s[u] = !0;
    else if (/^[a-z]$/.test(u))
      s.code = `Key${u.toUpperCase()}`, s.letter = u;
    else if (/^[0-9]$/.test(u)) s.code = `Digit${u}`;
    else if (dr[u]) s.code = dr[u];
    else throw new Error(`unknown key "${u}" in "${n}"`);
  if (!s.code) throw new Error(`no key in "${n}"`);
  return qf.set(r, s), s;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const a = Xm(n, !0);
  return [a.cmd && "cmd", a.ctrl && "ctrl", a.alt && "alt", a.shift && "shift", a.code].filter(Boolean).join("+");
}));
function Ov(n, a = Km) {
  const r = Xm(n, a), o = Rv(jv(r.code) ?? "");
  return a ? `${r.ctrl ? "⌃" : ""}${r.alt ? "⌥" : ""}${r.shift ? "⇧" : ""}${r.cmd ? "⌘" : ""}${o}` : [r.ctrl && "Ctrl", r.alt && "Alt", r.shift && "Shift", o].filter(Boolean).join("+");
}
const Rv = (n) => Av[n] ?? n.toUpperCase(), Gf = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, Yf = Mm, br = (n, a) => (r) => {
  var o;
  if (a?.variants == null) return Yf(n, r?.class, r?.className);
  const { variants: s, defaultVariants: u } = a, m = Object.keys(s).map((v) => {
    const x = r?.[v], y = u?.[v];
    if (x === null) return null;
    const b = Gf(x) || Gf(y);
    return s[v][b];
  }), f = r && Object.entries(r).reduce((v, x) => {
    let [y, b] = x;
    return b === void 0 || (v[y] = b), v;
  }, {}), p = a == null || (o = a.compoundVariants) === null || o === void 0 ? void 0 : o.reduce((v, x) => {
    let { class: y, className: b, ...S } = x;
    return Object.entries(S).every((N) => {
      let [E, T] = N;
      return Array.isArray(T) ? T.includes({
        ...u,
        ...f
      }[E]) : {
        ...u,
        ...f
      }[E] === T;
    }) ? [
      ...v,
      y,
      b
    ] : v;
  }, []);
  return Yf(n, m, p, r?.class, r?.className);
}, Dv = br(
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
), Bv = br(
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
function Hv({ className: n, ...a } = {}) {
  return jt(Bv(a), n);
}
const Zm = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", Hl = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", Uv = br(`${Hl} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function qv({ className: n, ...a } = {}) {
  return jt(Uv(a), n);
}
const vr = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", As = br(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), Gv = "my-1 h-px bg-overlay-0";
function Yv({ size: n = 14, className: a }) {
  return /* @__PURE__ */ et.jsxs("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ et.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ et.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ et.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function Lv({ size: n = 16, className: a }) {
  return /* @__PURE__ */ et.jsxs("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ et.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ et.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function Vv({ size: n = 14, className: a }) {
  return /* @__PURE__ */ et.jsx("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ et.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function Jm({ size: n = 14, className: a }) {
  return /* @__PURE__ */ et.jsx("svg", { className: a, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ et.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const Lf = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function Qv({ state: n, error: a }) {
  return /* @__PURE__ */ et.jsx(
    "span",
    {
      className: jt("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", Lf[n] ?? Lf.disabled),
      title: n === "error" && a ? a : n
    }
  );
}
function Kv({ title: n, onClose: a, children: r, testId: o }) {
  return Bl(
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
              r
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
const $i = 2e5;
function Xv(n) {
  if (n.length <= $i) return { source: n, truncated: !1 };
  const a = n.lastIndexOf(`
`, $i);
  return { source: n.slice(0, a > 0 ? a : $i), truncated: !0 };
}
const Qi = 4, Bn = 8, Zv = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", Vf = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function Jv({ value: n, onChange: a, options: r, className: o, ariaLabel: s, testId: u, id: m, title: f, disabled: p, placeholder: v, freeText: x, onKeyDown: y }) {
  const b = X.useId(), [S, N] = X.useState(!1), [E, T] = X.useState(-1), [j, R] = X.useState(!1), U = X.useRef(null), F = X.useRef(null), [J, B] = X.useState({}), g = X.useRef({ text: "", at: 0 }), h = x && j && n ? r.filter((Y) => Vf(Y).toLowerCase().includes(n.toLowerCase()) || Y.value.toLowerCase().includes(n.toLowerCase())) : r, _ = r.find((Y) => Y.value === n), k = (Y) => `${b}-${Y}`;
  function z(Y) {
    p || (T(Y), N(!0));
  }
  function O() {
    N(!1), R(!1), T(-1);
  }
  function A(Y) {
    !Y || Y.disabled || (a(Y.value), O());
  }
  function G(Y, K) {
    for (let C = 1; C <= h.length; C++) {
      const Z = (Y + K * C + h.length * C) % h.length;
      if (!h[Z].disabled) return Z;
    }
    return Y;
  }
  const W = () => h.findIndex((Y) => !Y.disabled), D = () => h.length - 1 - [...h].reverse().findIndex((Y) => !Y.disabled);
  jl(() => {
    if (!S || !U.current) {
      B((at) => at.left === void 0 ? at : {});
      return;
    }
    const Y = U.current.getBoundingClientRect(), K = window.innerHeight - Y.bottom - Qi - Bn, C = Y.top - Qi - Bn, Z = K < 160 && C > K;
    B({
      position: "fixed",
      left: Math.min(Math.max(Bn, Y.left), Math.max(Bn, window.innerWidth - Y.width - Bn)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: Y.width,
      maxWidth: window.innerWidth - 2 * Bn,
      maxHeight: Math.min(Z ? C : K, 320),
      ...Z ? { bottom: window.innerHeight - Y.top + Qi } : { top: Y.bottom + Qi },
      overflowY: "auto"
    });
  }, [S, h.length]), jl(() => {
    const Y = F.current;
    if (!S || !Y || J.left === void 0) return;
    const K = Y.getBoundingClientRect().right, C = window.innerWidth - Bn;
    K > C && B((Z) => ({ ...Z, left: Math.max(Bn, Number(Z.left) - (K - C)) }));
  }, [S, J]), Lt(() => {
    if (!S) return;
    const Y = (K) => {
      const C = K.target;
      (C === document || C instanceof Node && U.current && C.contains(U.current)) && O();
    };
    return window.addEventListener("resize", O), window.addEventListener("scroll", Y, !0), () => {
      window.removeEventListener("resize", O), window.removeEventListener("scroll", Y, !0);
    };
  }, [S]), Lt(() => {
    const Y = S && E >= 0 ? document.getElementById(k(E)) : null, K = F.current;
    !Y || !K || (Y.offsetTop < K.scrollTop ? K.scrollTop = Y.offsetTop : Y.offsetTop + Y.offsetHeight > K.scrollTop + K.clientHeight && (K.scrollTop = Y.offsetTop + Y.offsetHeight - K.clientHeight));
  }, [S, E]), $m(S, (Y) => {
    Y || O();
  }, U, F);
  function Q(Y) {
    if (Y.nativeEvent.isComposing) return;
    const K = () => {
      Y.preventDefault(), Y.stopPropagation();
    }, { key: C } = Y;
    if (S) {
      if (C === "Escape") {
        K(), O();
        return;
      } else if (C === "Tab")
        O();
      else if (C === "ArrowDown" || C === "ArrowUp") {
        K(), h.length && T(E < 0 ? C === "ArrowDown" ? W() : D() : G(E, C === "ArrowDown" ? 1 : -1));
        return;
      } else if (C === "Home" && !x) {
        K(), T(W());
        return;
      } else if (C === "End" && !x) {
        K(), T(D());
        return;
      } else if (C === "Enter" || C === " " && !x) {
        if (E >= 0 && h[E]) {
          K(), A(h[E]);
          return;
        }
        if (!x) {
          K(), O();
          return;
        }
      } else if (!x && C.length === 1 && !Y.metaKey && !Y.ctrlKey && !Y.altKey) {
        const Z = Date.now();
        g.current = { text: (Z - g.current.at > 600 ? "" : g.current.text) + C.toLowerCase(), at: Z };
        const at = Math.max(E, 0), st = [...h.slice(at + (g.current.text.length === 1 ? 1 : 0)), ...h.slice(0, at + 1)].find((ct) => !ct.disabled && Vf(ct).toLowerCase().startsWith(g.current.text));
        st && (K(), T(h.indexOf(st)));
        return;
      }
    } else if (C === "ArrowDown" || C === "ArrowUp" || !x && (C === "Enter" || C === " ")) {
      K(), z(Math.max(0, h.findIndex((Z) => Z.value === n)));
      return;
    }
    y?.(Y);
  }
  const I = {
    ref: (Y) => {
      U.current = Y;
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
        onChange: (Y) => {
          a(Y.target.value), R(!0), S ? T(-1) : (T(-1), N(!0));
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
        onClick: () => S ? O() : z(Math.max(0, h.findIndex((Y) => Y.value === n))),
        children: [
          /* @__PURE__ */ et.jsx("span", { className: "min-w-0 flex-1 truncate", children: _ ? _.label : v ?? "" }),
          /* @__PURE__ */ et.jsx($s, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    S && h.length > 0 && Bl(
      /* @__PURE__ */ et.jsx(
        "div",
        {
          ref: F,
          id: b,
          role: "listbox",
          "aria-label": s,
          className: jt("z-[9999]", vr),
          style: J,
          onMouseDown: (Y) => {
            Y.preventDefault(), Y.stopPropagation();
          },
          onClick: (Y) => Y.stopPropagation(),
          children: h.map((Y, K) => /* @__PURE__ */ et.jsxs(
            "div",
            {
              id: k(K),
              role: "option",
              "aria-selected": Y.value === n,
              "aria-disabled": Y.disabled || void 0,
              "data-value": Y.value,
              className: jt(Zv, K === E && !Y.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                Y.disabled || T(K);
              },
              onClick: () => A(Y),
              children: [
                /* @__PURE__ */ et.jsx("span", { className: "min-w-0 truncate", children: Y.label }),
                Y.value === n && /* @__PURE__ */ et.jsx("span", { "aria-hidden": "true", className: "shrink-0 text-accent", children: "✓" })
              ]
            },
            Y.value
          ))
        }
      ),
      document.body
    )
  ] });
}
const Qf = 230, Wv = 370;
function Fv({ x: n, y: a, readOnly: r, canUndo: o, canRedo: s, hasSelection: u, onClose: m, actions: f }) {
  const p = X.useRef(null);
  Lt(() => {
    const b = (N) => {
      p.current?.contains(N.target) || m();
    }, S = (N) => {
      N.key === "Escape" && (N.preventDefault(), m());
    };
    return document.addEventListener("mousedown", b), document.addEventListener("keydown", S), window.addEventListener("blur", m), window.addEventListener("resize", m), () => {
      document.removeEventListener("mousedown", b), document.removeEventListener("keydown", S), window.removeEventListener("blur", m), window.removeEventListener("resize", m);
    };
  }, [m]);
  const v = (b, S) => Ds(ap ? b : S), x = (b, S, N, E, T = !1) => /* @__PURE__ */ et.jsxs("button", { type: "button", className: jt(lp(), "flex items-center justify-between gap-6"), "data-testid": N, disabled: T, onClick: S, children: [
    /* @__PURE__ */ et.jsx("span", { children: b }),
    /* @__PURE__ */ et.jsx("span", { className: "text-[0.72rem] text-subtext-0", children: E })
  ] }), y = f.askAgent;
  return Bl(
    /* @__PURE__ */ et.jsxs(
      "div",
      {
        ref: p,
        className: vr,
        "data-testid": "editor-context-menu",
        style: {
          position: "fixed",
          top: Math.max(8, Math.min(a, window.innerHeight - Wv - 8)),
          left: Math.max(8, Math.min(n, window.innerWidth - Qf - 8)),
          zIndex: 9999,
          minWidth: Qf
        },
        onContextMenu: (b) => b.preventDefault(),
        children: [
          y && /* @__PURE__ */ et.jsxs(et.Fragment, { children: [
            x(u ? "Ask agent about selection…" : "Ask agent about file…", y, "editor-menu-ask-agent", ""),
            /* @__PURE__ */ et.jsx("div", { className: Pi })
          ] }),
          x("Undo", f.undo, "editor-menu-undo", v("cmd+z", "ctrl+z"), r || !o),
          x("Redo", f.redo, "editor-menu-redo", v("cmd+shift+z", "ctrl+y"), r || !s),
          /* @__PURE__ */ et.jsx("div", { className: Pi }),
          x("Cut", f.cut, "editor-menu-cut", v("cmd+x", "ctrl+x"), r || !u),
          x("Copy", f.copy, "editor-menu-copy", v("cmd+c", "ctrl+c"), !u),
          x("Paste", f.paste, "editor-menu-paste", v("cmd+v", "ctrl+v"), r),
          x("Select All", f.selectAll, "editor-menu-select-all", v("cmd+a", "ctrl+a")),
          /* @__PURE__ */ et.jsx("div", { className: Pi }),
          x("Find…", f.find, "editor-menu-find", v("cmd+f", "ctrl+f")),
          !r && x("Replace…", f.replace, "editor-menu-replace", v("cmd+alt+f", "ctrl+h")),
          x("Go to Line…", f.gotoLine, "editor-menu-goto", Ds("ctrl+g"))
        ]
      }
    ),
    document.body
  );
}
const $v = "box-border min-h-[44px] cursor-pointer rounded-ui bg-transparent px-[0.7rem] py-[0.45rem] text-subtext-0 no-underline [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] text-[0.85rem] hover:bg-surface-1 hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] disabled:cursor-default disabled:opacity-[0.55]", Iv = "m-0 mt-[0.4rem] text-[0.78rem] text-subtext-0", Pv = "m-0 mb-2 text-[0.82rem] text-subtext-0", Wm = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", Ws = `${Wm} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, t1 = `${Ws} min-w-[5.5rem] shrink-0`, Fs = `${Wm} min-w-0 px-[0.55rem] py-[0.35rem] text-[0.82rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`, e1 = `${Fs} flex-1 max-[700px]:flex-[1_1_100%]`, n1 = `${Fs} w-20 flex-[0_0_5rem] max-[700px]:w-24 max-[700px]:flex-[1_1_6rem]`, a1 = `${Fs} flex-[1_1_100%]`, l1 = "flex flex-wrap items-center gap-[0.4rem]", i1 = "m-0 mb-2 flex list-none flex-col gap-[0.3rem] p-0", r1 = "flex items-center gap-2 max-[700px]:flex-wrap rounded-ui bg-surface-1 px-2 py-[0.35rem] text-[0.82rem]", o1 = `settings-modal__host-row ${r1}`, s1 = "min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-fg", c1 = "min-w-0 flex-1 max-[700px]:basis-full overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-subtext-0", Fm = "shrink-0 cursor-pointer rounded-ui px-[0.7rem] py-[0.35rem] max-[700px]:min-h-11 text-[0.82rem] font-semibold text-panel-bg [border:none] [font-family:inherit] [transition:opacity_0.12s_ease] hover:opacity-[0.85]", u1 = `${Fm} bg-accent`, d1 = `${Fm} ml-auto bg-red`;
function $s({ open: n, size: a = 12, className: r }) {
  return /* @__PURE__ */ et.jsx("svg", { className: r, width: a, height: a, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ et.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function f1({ label: n, items: a, testId: r, side: o = "right", up: s = !1, maxHeight: u = 320 }) {
  const [m, f] = X.useState(!1), [p, v] = X.useState(!1), x = X.useRef(null), y = X.useRef(null), b = () => [...y.current?.querySelectorAll('[role="menuitem"]') ?? []];
  Lt(() => {
    m && p && (b()[0]?.focus(), v(!1));
  }, [m, p]);
  const S = () => {
    f(!0), v(!0);
  }, N = (T) => {
    (T.key === "ArrowRight" || T.key === "Enter" || T.key === " ") && (T.preventDefault(), S());
  }, E = (T) => {
    const j = b(), R = j.findIndex((U) => U === document.activeElement);
    T.key === "ArrowDown" || T.key === "ArrowUp" ? (T.preventDefault(), j[(R + (T.key === "ArrowDown" ? 1 : j.length - 1)) % j.length]?.focus()) : (T.key === "ArrowLeft" || T.key === "Escape") && (T.preventDefault(), T.stopPropagation(), f(!1), x.current?.focus());
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
        className: jt(As(), "flex items-center justify-between gap-2"),
        "data-testid": r,
        onClick: () => m ? f(!1) : S(),
        onKeyDown: N,
        children: [
          /* @__PURE__ */ et.jsx("span", { className: "truncate", children: n }),
          /* @__PURE__ */ et.jsx($s, { open: !1, size: 10 })
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
          vr,
          "absolute z-10 w-60 overflow-y-auto",
          o === "right" ? "left-full" : "right-full",
          s ? "bottom-0" : "top-0",
          m ? "block" : "hidden group-hover/submenu:block"
        ),
        style: { maxHeight: u },
        onKeyDown: E,
        children: a.map((T) => /* @__PURE__ */ et.jsx("button", { type: "button", role: "menuitem", className: As(), "data-testid": T.testId, onClick: T.onSelect, children: /* @__PURE__ */ et.jsx("span", { className: "block truncate", children: T.label }) }, T.key))
      }
    )
  ] });
}
function m1(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const js = {
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
function Os(n, a) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && a.some((r) => r.id === n.parentSessionId);
}
function p1(n) {
  const a = /* @__PURE__ */ new Map();
  for (const r of n)
    Os(r, n) && a.set(r.parentSessionId, [...a.get(r.parentSessionId) ?? [], r]);
  return a.size ? n.filter((r) => !Os(r, n)).flatMap((r) => [r, ...a.get(r.id) ?? []]) : n;
}
const Ki = 6, Kf = 8;
function h1(n, a = {}) {
  const { minWidth: r = 220, align: o = "right", minSpaceAbove: s = 100 } = a, u = n.getBoundingClientRect(), m = window.innerWidth, f = window.innerHeight, p = o === "right" ? { right: Math.max(0, m - u.right) } : { left: Math.max(0, u.left) }, v = u.top - Ki - Kf, x = f - u.bottom - Ki - Kf;
  return v >= s ? {
    position: "fixed",
    bottom: f - u.top + Ki,
    ...p,
    minWidth: r,
    maxHeight: Math.min(v, f * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: u.bottom + Ki,
    ...p,
    minWidth: r,
    maxHeight: Math.min(x, f * 0.75),
    overflowY: "auto"
  };
}
function $m(n, a, r, o) {
  Lt(() => {
    if (!n) return;
    function s(m) {
      const f = m.target, p = r.current?.contains(f) ?? !1, v = o.current?.contains(f) ?? !1;
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
function g1({ icon: n, fallback: a }) {
  const [r, o] = X.useState(!1);
  return Lt(() => o(!1), [n]), !n || r ? /* @__PURE__ */ et.jsx(et.Fragment, { children: a }) : /* @__PURE__ */ et.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => o(!0) });
}
const b1 = ["application/zip", "application/x-tar", "application/gzip"];
function Im(n) {
  const a = n ?? "";
  if (a.startsWith("image/")) return "image";
  if (a.startsWith("video/")) return "video";
  if (a.startsWith("audio/")) return "audio";
  if (a === "application/pdf") return "pdf";
  if (b1.includes(a)) return "archive";
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
const v1 = 50 * 1024 * 1024, Xf = 1.25, y1 = 0.05, x1 = 16384, w1 = "inline-flex items-center justify-center", Xi = jt(Hl, w1, "min-h-8 min-w-8 px-2 text-[0.75rem] max-[700px]:min-h-11 max-[700px]:min-w-11"), ps = jt(Hl, "inline-flex min-h-8 items-center px-2"), _1 = { pdf: "PDF document", audio: "Audio", video: "Video" };
let k1 = 0;
function S1(n) {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function E1(n, a, r) {
  const o = a ? Math.min(8, x1 / Math.max(a.width, a.height)) : 1, s = r === "in" ? n * Xf : r === "out" ? n / Xf : 1;
  return Math.min(o, Math.max(Math.min(y1, o), s));
}
function z1(n, a) {
  return typeof n != "string" || !n.startsWith("/") ? null : `${n.replace(/\/+$/, "")}/${a.replace(/^\/+/, "")}`;
}
function N1({ media: n, workspaceId: a, metadata: r, onFail: o }) {
  const s = X.useMemo(() => `media-${++k1}`, []), [u, m] = X.useState(null), [f, p] = X.useState("fit");
  Lt(() => {
    let N = !0;
    return n.open(s, { workspaceId: a, path: r.path, mediaType: r.mediaType ?? "", size: r.size }).then((E) => {
      N && m(E ?? { width: 0, height: 0 });
    }, (E) => {
      N && o(String(E?.message ?? E));
    }), () => {
      N = !1, n.release(s);
    };
  }, [s]), Lt(() => {
    n.setZoom(s, f === "fit" ? null : f);
  }, [s, f]);
  const v = u !== null && u.width > 0 && u.height > 0, x = () => f !== "fit" ? f : n.fitScale(s) ?? 1, y = (N) => p(E1(x(), u, N)), b = (N) => {
    if (!(N.metaKey || N.ctrlKey || N.altKey || !v)) {
      if (N.key === "+" || N.key === "=") y("in");
      else if (N.key === "-") y("out");
      else if (N.key === "0") y("actual");
      else return;
      N.preventDefault();
    }
  }, S = f === "fit" ? "Fit" : `${Math.round(f * 100)}%`;
  return X.createElement(
    "div",
    { className: "flex min-h-0 min-w-0 flex-1 flex-col", "data-testid": "workspace-image-viewer" },
    X.createElement(
      "div",
      { className: "flex shrink-0 flex-wrap items-center gap-1 px-3 py-1 text-[0.72rem] text-subtext-0", role: "toolbar", "aria-label": "Image view" },
      X.createElement("button", { type: "button", className: Xi, "aria-label": "Zoom out", title: "Zoom out (-)", disabled: !v, onClick: () => y("out") }, "−"),
      X.createElement("button", { type: "button", className: Xi, "aria-label": "Zoom in", title: "Zoom in (+)", disabled: !v, onClick: () => y("in") }, "+"),
      X.createElement("button", { type: "button", className: jt(Xi, f === "fit" && "text-fg"), "aria-pressed": f === "fit", onClick: () => p("fit") }, "Fit"),
      X.createElement("button", { type: "button", className: jt(Xi, f === 1 && "text-fg"), "aria-pressed": f === 1, title: "Actual size (0)", disabled: !v, onClick: () => y("actual") }, "100%"),
      X.createElement("span", { role: "status", className: "px-1", "data-testid": "workspace-image-info" }, v ? `${u.width} × ${u.height} · ${S}` : "")
    ),
    X.createElement("div", {
      className: "flex min-h-0 min-w-0 flex-1",
      tabIndex: 0,
      "aria-label": `${r.name} image. Plus and minus zoom, 0 shows actual size, arrow keys pan.`,
      onKeyDown: b
    }, u === null ? X.createElement("span", { className: "m-auto text-[0.8rem] text-subtext-0", role: "status" }, "Loading…") : X.createElement("div", { className: "relative min-h-0 min-w-0 flex-1", "data-perch-engine": "image", "data-perch-key": s, "data-testid": "workspace-file-image" }))
  );
}
function T1({ workspaceId: n, metadata: a, perch: r }) {
  const [o, s] = X.useState(!1), u = r.mediaFile?.(n, a.path) ?? { root: null, extraction: null }, m = u.extraction, f = Im(a.mediaType), p = z1(u.root, a.path), v = p === null, x = f === "archive", y = f === "image" && a.size > v1, b = f !== void 0 && !x && !v && !y;
  let S = "Open this file in Quick Look or its default app.";
  v ? S = "Use your SSH tools to download this file. Perch will not open a remote path on this machine." : x && (S = "Extract into a new folder beside this archive. Existing files are never overwritten.");
  let N = "No preview for this file type";
  v ? N = "Remote media is not available yet" : x ? N = "Compressed archive" : y ? (N = "Image too large to preview", S = `This image is ${Math.round(a.size / 1048576)} MB. Open it in Quick Look or its default app.`) : o && (N = "Preview unavailable", f === "image" && (S = "The image may be corrupt or in a format Perch cannot decode. Open it in Quick Look or its default app."));
  const E = (j) => {
    try {
      r.media[j](p);
    } catch (R) {
      console.error(`perch-media ${j}: ${R?.message ?? R}`);
    }
  }, T = f === "pdf" || f === "audio" || f === "video";
  return X.createElement(
    "section",
    { className: "flex min-h-0 min-w-0 flex-1 flex-col", "aria-label": `Previewing ${a.path}`, "data-testid": "workspace-file-asset" },
    X.createElement(
      "header",
      { className: "flex shrink-0 flex-wrap items-center gap-2 px-3 py-2 text-[0.75rem]" },
      X.createElement("strong", { className: "min-w-0 flex-1 truncate", title: a.path }, a.path),
      x && X.createElement(
        "button",
        { type: "button", className: ps, disabled: m?.state === "loading", onClick: () => r.command("files.extract", { workspaceId: n, path: a.path }) },
        m?.state === "loading" ? "Extracting…" : "Extract"
      ),
      !v && X.createElement("button", { type: "button", className: ps, onClick: () => E("quickLook") }, "Quick Look"),
      !v && X.createElement("button", { type: "button", className: ps, onClick: () => E("openDefault") }, "Open with Default App")
    ),
    m?.state === "ready" && X.createElement("p", { role: "status", className: "m-0 px-3 py-2 text-[0.75rem] text-subtext-0" }, `Extracted to ${m.destination}. Find it in the file tree.`),
    m?.state === "error" && X.createElement("p", { role: "alert", className: "m-0 px-3 py-2 text-[0.75rem] text-red" }, m.error),
    !b || o ? X.createElement(
      "div",
      { className: "grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0" },
      X.createElement("strong", { className: "text-fg" }, N),
      X.createElement("span", null, S)
    ) : f === "image" ? X.createElement(N1, { media: r.media, workspaceId: n, metadata: a, onFail: () => s(!0) }) : T && X.createElement(
      "div",
      { className: "grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0", "data-testid": "workspace-file-card" },
      X.createElement("strong", { className: "text-fg" }, a.name),
      X.createElement("span", null, `${_1[f]} · ${S1(a.size)}`),
      X.createElement("span", null, "Perch does not play or render this file. Open it in Quick Look or its default app.")
    )
  );
}
function C1(n, a = !1) {
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
  const o = r.split(".").at(-1) ?? "", s = {
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
  return u ? { kind: "language", tone: u[1], text: u[0] } : /\.(html?|vue|svelte)$/.test(r) ? { kind: "code", tone: "text-peach" } : { kind: "file", tone: "text-subtext-0" };
}
const M1 = {
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
function A1({ name: n, directory: a = !1, open: r = !1 }) {
  const { kind: o, tone: s, text: u } = C1(n, a);
  return /* @__PURE__ */ et.jsxs("svg", { className: jt("size-[calc(14px*var(--zoom,1))] shrink-0", s), "data-file-icon": o, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    o === "react" ? /* @__PURE__ */ et.jsxs(et.Fragment, { children: [
      /* @__PURE__ */ et.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5" }),
      /* @__PURE__ */ et.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(60 8 8)" }),
      /* @__PURE__ */ et.jsx("ellipse", { cx: "8", cy: "8", rx: "7", ry: "2.5", transform: "rotate(120 8 8)" }),
      /* @__PURE__ */ et.jsx("circle", { cx: "8", cy: "8", r: "1" })
    ] }) : u ? /* @__PURE__ */ et.jsx("text", { x: "8", y: "11", textAnchor: "middle", fill: "currentColor", stroke: "none", fontSize: "8", fontWeight: "600", fontFamily: "var(--font-mono)", children: u }) : /* @__PURE__ */ et.jsx("path", { d: o === "folder" && r ? "M2 5V3h4l2 2h5v2M2 7h13l-2 6H2z" : M1[o] }),
    o === "branch" && /* @__PURE__ */ et.jsxs(et.Fragment, { children: [
      /* @__PURE__ */ et.jsx("circle", { cx: "4", cy: "3", r: "1.5" }),
      /* @__PURE__ */ et.jsx("circle", { cx: "4", cy: "13", r: "1.5" }),
      /* @__PURE__ */ et.jsx("circle", { cx: "12", cy: "3", r: "1.5" })
    ] }),
    o === "image" && /* @__PURE__ */ et.jsx("circle", { cx: "10.5", cy: "5", r: "1" })
  ] });
}
const j1 = { unmodified: "", modified: "M", added: "A", deleted: "D", renamed: "R", copied: "C", typeChanged: "T", untracked: "U", ignored: "I", conflicted: "!" }, Zf = (n) => typeof n == "string" ? j1[n] ?? "?" : "?", Jf = (n) => typeof n == "string" ? n === "unmodified" ? "unmodified" : n === "typeChanged" ? "type changed" : n : `unknown (${n.unknown})`;
function O1(n) {
  const a = Zf(n.index), r = Zf(n.worktree), o = a === "!" || r === "!", s = o ? "!" : n.staged && n.unstaged ? `${a || "?"}/${r || "?"}` : n.staged ? a : r || a, u = `Git · Index: ${Jf(n.index)}; working tree: ${Jf(n.worktree)}${n.originalPath ? `; from ${n.originalPath}` : ""}`, m = o || s.includes("D") ? "text-red" : s === "U" || s === "A" || s === "C" ? "text-green" : s.includes("?") || s === "I" ? "text-subtext-0" : "text-yellow";
  return { label: s, title: u, tone: m };
}
function R1({ decoration: n, directory: a = !1 }) {
  if (!n) return null;
  if (a && n.containsChanges) return /* @__PURE__ */ et.jsx("span", { className: jt("ml-1 size-1 shrink-0 rounded-full", n.conflicted ? "bg-red" : "bg-yellow"), role: "img", "aria-label": n.conflicted ? "Contains Git conflicts" : "Contains Git changes", title: n.conflicted ? "Contains Git conflicts" : "Contains Git changes", "data-testid": "file-git-summary" });
  if (!n.entry) return null;
  const { label: r, title: o, tone: s } = O1(n.entry);
  return r ? /* @__PURE__ */ et.jsx("span", { className: jt("ml-1 shrink-0 text-[10px] tabular-nums [font-family:var(--font-mono)]", s), "aria-label": o, title: o, "data-testid": "file-git-marker", children: r }) : null;
}
const D1 = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]", Pm = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]", B1 = `${Pm} group-aria-[checked=false]:text-accent`, H1 = `${Pm} group-aria-checked:text-accent`, U1 = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg", q1 = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
function G1({
  mode: n,
  onChange: a,
  testId: r = "mode-switch",
  disabled: o = !1
}) {
  const s = n === "cli";
  return /* @__PURE__ */ et.jsxs(
    "button",
    {
      type: "button",
      className: D1,
      "data-testid": r,
      role: "switch",
      "aria-checked": s,
      "aria-label": "Toggle UI / CLI mode",
      disabled: o,
      onClick: () => a(s ? "ui" : "cli"),
      children: [
        /* @__PURE__ */ et.jsx("span", { className: jt("mode-switch__label mode-switch__label--ui", B1), children: "UI" }),
        /* @__PURE__ */ et.jsx("span", { className: jt("mode-switch__track", U1), children: /* @__PURE__ */ et.jsx("span", { className: jt("mode-switch__thumb", q1) }) }),
        /* @__PURE__ */ et.jsx("span", { className: jt("mode-switch__label mode-switch__label--cli", H1), children: "CLI" })
      ]
    }
  );
}
const Qa = function(n, a) {
  let s = n;
  const u = zl[a];
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
    })(f), b(0, 0), b(f - 7, 0), b(0, f - 7), E(), N(), j(g, h), s >= 7 && T(g), p == null && (p = F(s, u, v)), R(p, h);
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
  }, N = function() {
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
            for (let A = -2; A <= 2; A += 1)
              O == -2 || O == 2 || A == -2 || A == 2 || O == 0 && A == 0 ? m[k + O][z + A] = !0 : m[k + O][z + A] = !1;
      }
  }, T = function(g) {
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
    const A = Un.getMaskFunction(h);
    for (let G = f - 1; G > 0; G -= 2)
      for (G == 6 && (G -= 1); ; ) {
        for (let W = 0; W < 2; W += 1)
          if (m[k][G - W] == null) {
            let D = !1;
            O < g.length && (D = (g[O] >>> z & 1) == 1), A(k, G - W) && (D = !D), m[k][G - W] = D, z -= 1, z == -1 && (O += 1, z = 7);
          }
        if (k += _, k < 0 || f <= k) {
          k -= _, _ = -_;
          break;
        }
      }
  }, U = function(g, h) {
    let _ = 0, k = 0, z = 0;
    const O = new Array(h.length), A = new Array(h.length);
    for (let Q = 0; Q < h.length; Q += 1) {
      const I = h[Q].dataCount, Y = h[Q].totalCount - I;
      k = Math.max(k, I), z = Math.max(z, Y), O[Q] = new Array(I);
      for (let at = 0; at < O[Q].length; at += 1)
        O[Q][at] = 255 & g.getBuffer()[at + _];
      _ += I;
      const K = Un.getErrorCorrectPolynomial(Y), Z = Ol(O[Q], K.getLength() - 1).mod(K);
      A[Q] = new Array(K.getLength() - 1);
      for (let at = 0; at < A[Q].length; at += 1) {
        const st = at + Z.getLength() - A[Q].length;
        A[Q][at] = st >= 0 ? Z.getAt(st) : 0;
      }
    }
    let G = 0;
    for (let Q = 0; Q < h.length; Q += 1)
      G += h[Q].totalCount;
    const W = new Array(G);
    let D = 0;
    for (let Q = 0; Q < k; Q += 1)
      for (let I = 0; I < h.length; I += 1)
        Q < O[I].length && (W[D] = O[I][Q], D += 1);
    for (let Q = 0; Q < z; Q += 1)
      for (let I = 0; I < h.length; I += 1)
        Q < A[I].length && (W[D] = A[I][Q], D += 1);
    return W;
  }, F = function(g, h, _) {
    const k = Wf.getRSBlocks(g, h), z = Ff();
    for (let A = 0; A < _.length; A += 1) {
      const G = _[A];
      z.put(G.getMode(), 4), z.put(G.getLength(), Un.getLengthInBits(G.getMode(), g)), G.write(z);
    }
    let O = 0;
    for (let A = 0; A < k.length; A += 1)
      O += k[A].dataCount;
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
        _ = Y1(g);
        break;
      case "Alphanumeric":
        _ = L1(g);
        break;
      case "Byte":
        _ = V1(g);
        break;
      case "Kanji":
        _ = Q1(g);
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
        const h = Wf.getRSBlocks(g, u), _ = Ff();
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
    let A, G, W, D, Q = "", I;
    for (I = "l" + g + ",0 0," + g + " -" + g + ",0 0,-" + g + "z ", Q += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"', Q += z.scalable ? "" : ' width="' + O + 'px" height="' + O + 'px"', Q += ' viewBox="0 0 ' + O + " " + O + '" ', Q += ' preserveAspectRatio="xMinYMin meet"', Q += k.text || _.text ? ' role="img" aria-labelledby="' + J([k.id, _.id].join(" ").trim()) + '"' : "", Q += ">", Q += k.text ? '<title id="' + J(k.id) + '">' + J(k.text) + "</title>" : "", Q += _.text ? '<description id="' + J(_.id) + '">' + J(_.text) + "</description>" : "", Q += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>', Q += '<path d="', W = 0; W < x.getModuleCount(); W += 1)
      for (D = W * g + h, A = 0; A < x.getModuleCount(); A += 1)
        x.isDark(W, A) && (G = A * g + h, Q += "M" + G + "," + D + I);
    return Q += '" stroke="transparent" fill="black"/>', Q += "</svg>", Q;
  }, x.createDataURL = function(g, h) {
    g = g || 2, h = typeof h > "u" ? g * 4 : h;
    const _ = x.getModuleCount() * g + h * 2, k = h, z = _ - h;
    return J1(_, _, function(O, A) {
      if (k <= O && O < z && k <= A && A < z) {
        const G = Math.floor((O - k) / g), W = Math.floor((A - k) / g);
        return x.isDark(W, G) ? 0 : 1;
      } else
        return 1;
    });
  }, x.createImgTag = function(g, h, _) {
    g = g || 2, h = typeof h > "u" ? g * 4 : h;
    const k = x.getModuleCount() * g + h * 2;
    let z = "";
    return z += "<img", z += ' src="', z += x.createDataURL(g, h), z += '"', z += ' width="', z += k, z += '"', z += ' height="', z += k, z += '"', _ && (z += ' alt="', z += J(_), z += '"'), z += "/>", z;
  };
  const J = function(g) {
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
    let O, A, G, W, D;
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
    let Y = "";
    for (O = 0; O < _; O += 2) {
      for (G = Math.floor((O - k) / 1), W = Math.floor((O + 1 - k) / 1), A = 0; A < _; A += 1)
        D = "█", k <= A && A < z && k <= O && O < z && x.isDark(G, Math.floor((A - k) / 1)) && (D = " "), k <= A && A < z && k <= O + 1 && O + 1 < z && x.isDark(W, Math.floor((A - k) / 1)) ? D += " " : D += "█", Y += g < 1 && O + 1 >= z ? I[D] : Q[D];
      Y += `
`;
    }
    return _ % 2 && g > 0 ? Y.substring(0, Y.length - _ - 1) + Array(_ + 1).join("▀") : Y.substring(0, Y.length - 1);
  };
  return x.createASCII = function(g, h) {
    if (g = g || 1, g < 2)
      return B(h);
    g -= 1, h = typeof h > "u" ? g * 2 : h;
    const _ = x.getModuleCount() * g + h * 2, k = h, z = _ - h;
    let O, A, G, W;
    const D = Array(g + 1).join("██"), Q = Array(g + 1).join("  ");
    let I = "", Y = "";
    for (O = 0; O < _; O += 1) {
      for (G = Math.floor((O - k) / g), Y = "", A = 0; A < _; A += 1)
        W = 1, k <= A && A < z && k <= O && O < z && x.isDark(G, Math.floor((A - k) / g)) && (W = 0), Y += W ? D : Q;
      for (G = 0; G < g; G += 1)
        I += Y + `
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
Qa.stringToBytes = function(n) {
  const a = [];
  for (let r = 0; r < n.length; r += 1) {
    const o = n.charCodeAt(r);
    a.push(o & 255);
  }
  return a;
};
Qa.createStringToBytes = function(n, a) {
  const r = (function() {
    const s = X1(n), u = function() {
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
        const p = r[s.charAt(m)];
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
}, zl = {
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
  ], a = 1335, r = 7973, o = 21522, s = {}, u = function(m) {
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
    for (; u(f) - u(r) >= 0; )
      f ^= r << u(f) - u(r);
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
    let f = Ol([1], 0);
    for (let p = 0; p < m; p += 1)
      f = f.multiply(Ol([1, qn.gexp(p)], 0));
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
        const N = m.isDark(y, b);
        for (let E = -1; E <= 1; E += 1)
          if (!(y + E < 0 || f <= y + E))
            for (let T = -1; T <= 1; T += 1)
              b + T < 0 || f <= b + T || E == 0 && T == 0 || N == m.isDark(y + E, b + T) && (S += 1);
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
  const r = {};
  return r.glog = function(o) {
    if (o < 1)
      throw "glog(" + o + ")";
    return a[o];
  }, r.gexp = function(o) {
    for (; o < 0; )
      o += 255;
    for (; o >= 256; )
      o -= 255;
    return n[o];
  }, r;
})(), Ol = function(n, a) {
  if (typeof n.length > "u")
    throw n.length + "/" + a;
  const r = (function() {
    let s = 0;
    for (; s < n.length && n[s] == 0; )
      s += 1;
    const u = new Array(n.length - s + a);
    for (let m = 0; m < n.length - s; m += 1)
      u[m] = n[m + s];
    return u;
  })(), o = {};
  return o.getAt = function(s) {
    return r[s];
  }, o.getLength = function() {
    return r.length;
  }, o.multiply = function(s) {
    const u = new Array(o.getLength() + s.getLength() - 1);
    for (let m = 0; m < o.getLength(); m += 1)
      for (let f = 0; f < s.getLength(); f += 1)
        u[m + f] ^= qn.gexp(qn.glog(o.getAt(m)) + qn.glog(s.getAt(f)));
    return Ol(u, 0);
  }, o.mod = function(s) {
    if (o.getLength() - s.getLength() < 0)
      return o;
    const u = qn.glog(o.getAt(0)) - qn.glog(s.getAt(0)), m = new Array(o.getLength());
    for (let f = 0; f < o.getLength(); f += 1)
      m[f] = o.getAt(f);
    for (let f = 0; f < s.getLength(); f += 1)
      m[f] ^= qn.gexp(qn.glog(s.getAt(f)) + u);
    return Ol(m, 0).mod(s);
  }, o;
}, Wf = (function() {
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
  }, r = {}, o = function(s, u) {
    switch (u) {
      case zl.L:
        return n[(s - 1) * 4 + 0];
      case zl.M:
        return n[(s - 1) * 4 + 1];
      case zl.Q:
        return n[(s - 1) * 4 + 2];
      case zl.H:
        return n[(s - 1) * 4 + 3];
      default:
        return;
    }
  };
  return r.getRSBlocks = function(s, u) {
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
  }, r;
})(), Ff = function() {
  const n = [];
  let a = 0;
  const r = {};
  return r.getBuffer = function() {
    return n;
  }, r.getAt = function(o) {
    const s = Math.floor(o / 8);
    return (n[s] >>> 7 - o % 8 & 1) == 1;
  }, r.put = function(o, s) {
    for (let u = 0; u < s; u += 1)
      r.putBit((o >>> s - u - 1 & 1) == 1);
  }, r.getLengthInBits = function() {
    return a;
  }, r.putBit = function(o) {
    const s = Math.floor(a / 8);
    n.length <= s && n.push(0), o && (n[s] |= 128 >>> a % 8), a += 1;
  }, r;
}, Y1 = function(n) {
  const a = de.MODE_NUMBER, r = n, o = {};
  o.getMode = function() {
    return a;
  }, o.getLength = function(m) {
    return r.length;
  }, o.write = function(m) {
    const f = r;
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
}, L1 = function(n) {
  const a = de.MODE_ALPHA_NUM, r = n, o = {};
  o.getMode = function() {
    return a;
  }, o.getLength = function(u) {
    return r.length;
  }, o.write = function(u) {
    const m = r;
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
}, V1 = function(n) {
  const a = de.MODE_8BIT_BYTE, r = Qa.stringToBytes(n), o = {};
  return o.getMode = function() {
    return a;
  }, o.getLength = function(s) {
    return r.length;
  }, o.write = function(s) {
    for (let u = 0; u < r.length; u += 1)
      s.put(r[u], 8);
  }, o;
}, Q1 = function(n) {
  const a = de.MODE_KANJI, r = Qa.stringToBytes;
  (function(u, m) {
    const f = r(u);
    if (f.length != 2 || (f[0] << 8 | f[1]) != m)
      throw "sjis not supported.";
  })("友", 38726);
  const o = r(n), s = {};
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
}, tp = function() {
  const n = [], a = {};
  return a.writeByte = function(r) {
    n.push(r & 255);
  }, a.writeShort = function(r) {
    a.writeByte(r), a.writeByte(r >>> 8);
  }, a.writeBytes = function(r, o, s) {
    o = o || 0, s = s || r.length;
    for (let u = 0; u < s; u += 1)
      a.writeByte(r[u + o]);
  }, a.writeString = function(r) {
    for (let o = 0; o < r.length; o += 1)
      a.writeByte(r.charCodeAt(o));
  }, a.toByteArray = function() {
    return n;
  }, a.toString = function() {
    let r = "";
    r += "[";
    for (let o = 0; o < n.length; o += 1)
      o > 0 && (r += ","), r += n[o];
    return r += "]", r;
  }, a;
}, K1 = function() {
  let n = 0, a = 0, r = 0, o = "";
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
    for (n = n << 8 | f & 255, a += 8, r += 1; a >= 6; )
      u(n >>> a - 6), a -= 6;
  }, s.flush = function() {
    if (a > 0 && (u(n << 6 - a), n = 0, a = 0), r % 3 != 0) {
      const f = 3 - r % 3;
      for (let p = 0; p < f; p += 1)
        o += "=";
    }
  }, s.toString = function() {
    return o;
  }, s;
}, X1 = function(n) {
  const a = n;
  let r = 0, o = 0, s = 0;
  const u = {};
  u.read = function() {
    for (; s < 8; ) {
      if (r >= a.length) {
        if (s == 0)
          return -1;
        throw "unexpected end of file./" + s;
      }
      const p = a.charAt(r);
      if (r += 1, p == "=")
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
}, Z1 = function(n, a) {
  const r = n, o = a, s = new Array(n * a), u = {};
  u.setPixel = function(v, x, y) {
    s[x * r + v] = y;
  }, u.write = function(v) {
    v.writeString("GIF87a"), v.writeShort(r), v.writeShort(o), v.writeByte(128), v.writeByte(0), v.writeByte(0), v.writeByte(0), v.writeByte(0), v.writeByte(0), v.writeByte(255), v.writeByte(255), v.writeByte(255), v.writeString(","), v.writeShort(0), v.writeShort(0), v.writeShort(r), v.writeShort(o), v.writeByte(0);
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
    return S.write = function(N, E) {
      if (N >>> E)
        throw "length over";
      for (; y + E >= 8; )
        x.writeByte(255 & (N << y | b)), E -= 8 - y, N >>>= 8 - y, b = 0, y = 0;
      b = N << y | b, y = y + E;
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
    const N = tp(), E = m(N);
    E.write(x, b);
    let T = 0, j = String.fromCharCode(s[T]);
    for (T += 1; T < s.length; ) {
      const R = String.fromCharCode(s[T]);
      T += 1, S.contains(j + R) ? j = j + R : (E.write(S.indexOf(j), b), S.size() < 4095 && (S.size() == 1 << b && (b += 1), S.add(j + R)), j = R);
    }
    return E.write(S.indexOf(j), b), E.write(y, b), E.flush(), N.toByteArray();
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
}, J1 = function(n, a, r) {
  const o = Z1(n, a);
  for (let f = 0; f < a; f += 1)
    for (let p = 0; p < n; p += 1)
      o.setPixel(p, f, r(p, f));
  const s = tp();
  o.write(s);
  const u = K1(), m = s.toByteArray();
  for (let f = 0; f < m.length; f += 1)
    u.writeByte(m[f]);
  return u.flush(), "data:image/gif;base64," + u;
};
Qa.stringToBytes;
function W1({ text: n }) {
  const { size: a, path: r } = X.useMemo(() => {
    const o = Qa(0, "M");
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
        /* @__PURE__ */ et.jsx("path", { d: r, fill: "#000" })
      ]
    }
  );
}
const Rl = X.createContext(""), Rs = (n, a) => typeof n == "string" && n.toLowerCase().includes(a);
function F1({ title: n, children: a, testId: r, ariaLabel: o }) {
  const s = X.useContext(Rl), u = s !== "" && Rs(n, s);
  return (
    // While searching, a group with no matching row (and no matching title) hides itself.
    /* @__PURE__ */ et.jsxs("section", { className: s && !u ? "mb-8 not-has-[[data-setting-row]]:hidden" : "mb-8", "data-testid": r, "aria-label": o, children: [
      n && /* @__PURE__ */ et.jsx("h3", { className: "m-0 mb-3 text-[0.9rem] font-medium text-fg", children: n }),
      /* @__PURE__ */ et.jsx("div", { className: "rounded-ui bg-surface-0 px-4", children: /* @__PURE__ */ et.jsx(Rl.Provider, { value: u ? "" : s, children: a }) })
    ] })
  );
}
function $1({ title: n, description: a, children: r, testId: o }) {
  const s = X.useContext(Rl);
  return s && !Rs(n, s) && !Rs(a, s) ? null : /* @__PURE__ */ et.jsxs("div", { "data-setting-row": !0, "data-testid": o, className: "flex items-center justify-between gap-6 py-[0.8rem] max-[700px]:flex-wrap max-[700px]:gap-y-2", children: [
    /* @__PURE__ */ et.jsxs("div", { className: "min-w-0 max-[700px]:flex-1 max-[700px]:basis-56", children: [
      /* @__PURE__ */ et.jsx("div", { className: "text-[0.85rem] text-fg", children: n }),
      a && /* @__PURE__ */ et.jsx("div", { className: "mt-[0.15rem] text-[0.75rem] text-subtext-0", children: a })
    ] }),
    r && /* @__PURE__ */ et.jsx("div", { className: "flex shrink-0 items-center gap-2", children: r })
  ] });
}
function I1({ checked: n, onChange: a, testId: r, label: o }) {
  return /* @__PURE__ */ et.jsx(
    "input",
    {
      type: "checkbox",
      role: "switch",
      "aria-label": o,
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
const P1 = () => X.useContext(Rl), ty = {
  select: Ws,
  selectHost: t1,
  input: e1,
  inputPort: n1,
  inputWide: a1,
  addRow: l1,
  list: i1,
  hostRow: o1,
  name: s1,
  addr: c1,
  muted: Iv,
  empty: Pv,
  primary: u1,
  danger: d1,
  catalogToggle: $v
};
//! State the host keeps for a resource rather than for one view of it (`useResourceState`, `@perch/sdk` 1.4): a
//! review's unsent commit message and comment, its pending batch and its operation id, keyed by the screen's
//! own name for the resource (`review:<workspace>:commit`). Every view and copy that names the same key shares the
//! value, and it outlives a reload or swap of the screen's code, a released hidden copy and the phone/desktop
//! layouts trading places. In memory: a page reload starts empty (durable drafts live in their own services).
const ey = 512, Ie = globalThis.__perchResources ??= /* @__PURE__ */ new Map(), Ml = /* @__PURE__ */ new Map();
function ep(n, a) {
  Ie.delete(n), Ie.set(n, a);
  for (const r of Ie.keys()) {
    if (Ie.size <= ey) break;
    Ml.get(r)?.size || Ie.delete(r);
  }
}
function ny(n, a) {
  return Ie.has(n) ? Ie.get(n) : a;
}
function ay(n, a, r) {
  const o = ny(n, r), s = typeof a == "function" ? a(o) : a;
  if (!(Ie.has(n) && Object.is(s, o))) {
    ep(n, s);
    for (const u of [...Ml.get(n) ?? []]) u();
  }
}
function ly(n, a) {
  if (typeof n != "string" || !n) throw new Error("useResourceState needs a non-empty key.");
  Ie.has(n) || ep(n, a);
  const r = X.useCallback((u) => {
    const m = Ml.get(n) ?? /* @__PURE__ */ new Set();
    return Ml.set(n, m), m.add(u), () => {
      m.delete(u), m.size || Ml.delete(n);
    };
  }, [n]), o = X.useSyncExternalStore(r, () => Ie.get(n)), s = X.useCallback((u) => ay(n, u, a), [n]);
  return [o, s];
}
const iy = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150", ry = "hover:bg-transparent hover:text-subtext-0 active:bg-surface-1 active:text-fg";
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const oy = "1.3.0";
let Ii = null;
const sy = (n) => {
  Ii = n;
};
function bt() {
  const n = (typeof Ii == "function" ? Ii() : Ii) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const np = (n) => bt().subscribe?.(n) ?? (() => {
}), cy = h1;
function uy() {
  return typeof globalThis.crypto?.randomUUID == "function" ? globalThis.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (n) => {
    const a = Math.floor(Math.random() * 16);
    return (n === "x" ? a : a & 3 | 8).toString(16);
  });
}
const ap = globalThis.perch?.isMac !== !1, Ds = (n) => Ov(n, bt().isMac !== !1), dy = (n) => Dv(n), fy = ({ className: n, ...a } = {}) => jt(Hv(a), n), my = qv, lp = (n) => As(n), Pi = Gv, py = Hl, hy = Zm, gy = (n) => js[n].color, by = (n, a) => bt().shortcutFor?.(n, a) ?? null, ip = (n) => bt().shortcutLabel?.(n) ?? null, vy = (n, a) => {
  const r = ip(a);
  return r ? `${n} (${r})` : n;
}, yr = (n, a) => bt().command(n, a ?? {}) !== !1, yy = (n, a, r) => bt().startSession?.(n, a, r), xy = globalThis.perch?.pickFolder ? (n) => bt().pickFolder(n) : null;
function Ht(n) {
  const a = X.useRef(n);
  return a.current = n, X.useSyncExternalStore(np, () => a.current(bt()));
}
const rp = (n = {}) => Ht((a) => a.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), wy = () => Ht((n) => n.hosts()), _y = () => Ht((n) => n.sessionFolders());
function ky() {
  const n = Ht((a) => a.addProject?.() ?? Sy);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (a, r, o) => {
      a.trim() && n.status !== "pending" && bt().addProjectFolder?.(a, r, o);
    },
    clear: () => bt().clearAddProject?.()
  };
}
const Sy = Object.freeze({ status: "idle" }), op = "perch.lastAgentChoice", Ey = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), zy = () => {
  const n = bt().storage?.getItem(op);
  return n === "claude" || n === "codex" ? n : "claude";
}, Ny = Object.freeze({ items: [] });
function Ty() {
  const n = Ht((a) => a.notifications?.() ?? Ny);
  return X.useMemo(() => ({
    items: n.items ?? [],
    open: (a) => bt().command("notification.open", { id: a }),
    dismiss: (a) => bt().command("notification.dismiss", { id: a })
  }), [n]);
}
function Cy(n) {
  const a = Ht((s) => s.agentChoices?.(n) ?? Ey), [r, o] = X.useState(zy);
  return X.useMemo(() => ({
    connected: !!a.connected,
    discovery: !!a.discovery,
    choices: a.choices ?? [],
    lastChoice: r,
    state: a.state ?? "ready",
    error: a.state === "error" ? a.error : void 0,
    rememberChoice: (s) => {
      s !== "claude" && s !== "codex" || (bt().storage?.setItem(op, s), o(s));
    },
    manage: () => bt().command("agents.manage", {})
  }), [a, r]);
}
function My(n) {
  Lt(() => bt().onRequest?.("add-project", n) ?? void 0, [n]);
}
function Ay(n) {
  const a = n.map((r) => ({ id: r.id, parentSessionId: r.parentId, session: r }));
  return p1(a).map((r) => ({ session: r.session, nested: Os(r, a) }));
}
function jy({ id: n, plain: a, className: r }) {
  const o = Ht((v) => v.session(n));
  if (!o) return null;
  const s = o.state ?? m1(o), u = js[s]?.color ?? js.unknown.color, m = o.provider, f = m === "claude" || m === "claude-agent-teams" || m === "omp", p = a ? jt("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", r) : jt("agent-status-dot", `agent-status-dot--${s}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", r);
  return X.createElement(
    "span",
    { className: p, style: a ? void 0 : { borderColor: u }, "data-provider": m ?? "unknown", title: a ? m ?? "Agent" : `${m ?? "Agent"} · ${s}`, "aria-hidden": "true" },
    X.createElement("span", { className: jt("inline-flex text-fg", f && "rounded-full bg-[#161616]") }, X.createElement(sp, { provider: m, size: 14 }))
  );
}
function sp({ provider: n, size: a = 14 }) {
  const r = bt().agentIcon?.(n, a) ?? null, o = r?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return X.createElement("svg", { width: a, height: a, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": o, ...r && r.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const Oy = ({ children: n }) => X.createElement(X.Fragment, null, n);
function Ry(n, a) {
  const r = X.useRef(a);
  return r.current = a, Lt(() => {
    const o = bt();
    if (!o.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const s = {};
    for (const [m, f] of Object.entries(r.current))
      s[m] = typeof f == "function" ? (...p) => r.current[m]?.(...p) : f;
    const u = o.openOverlay(n, s);
    return () => o.closeOverlay?.(u);
  }, [n]), null;
}
const Vn = (n) => function(r) {
  return Ry(n, r);
}, Dy = Vn("session-menu"), By = Vn("new-session-menu"), Hy = Vn("confirm");
let cp = null;
const Uy = (n) => {
  cp = n;
};
function qy(n) {
  return X.createElement(cp ?? Hy, n);
}
function Gy({ className: n = Ws, ...a }) {
  return X.createElement(Jv, { ...a, className: n });
}
let Bs = null;
const Yy = (n) => {
  Bs = n;
}, Ly = Vn("folder-browser");
function Vy(n) {
  return Bs ? X.createElement(Bs, { ...n, browse: (a) => bt().browse(n.hostId, a) }) : X.createElement(Ly, n);
}
const Qy = Vn("instructions"), Ky = Vn("memory"), Xy = Kv;
let Is = null;
const Zy = (n) => {
  Is = n;
};
function Jy(n) {
  if (Is) return X.createElement(Fy, n);
  const { hostId: a, path: r, className: o } = n, s = X.useRef(null);
  return X.createElement(
    "button",
    {
      type: "button",
      ref: s,
      className: jt("worktree-menu__btn", Zm, o),
      "data-testid": `worktree-menu-${a}-${r}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => bt().openOverlay?.("worktree", { hostId: a, cwd: r, anchor: s.current?.getBoundingClientRect() })
    },
    X.createElement(Jm, null)
  );
}
const up = "Perch did not answer.";
function Zi(n) {
  return n ? n.type === "worktree.error" ? { error: n.message, dirty: !!n.dirty } : n.error ? { error: String(n.error) } : {} : { error: up };
}
function Wy(n, a, r = bt()) {
  const o = (s) => {
    for (const u of s ?? []) {
      if (u.path === a) return u;
      const m = o(u.children);
      if (m) return m;
    }
    return null;
  };
  for (const s of r.navigation({})?.projects ?? []) {
    if (s.hostId !== n) continue;
    const u = o(s.workspaces) ?? o(s.hidden);
    if (u) return u;
  }
  return null;
}
const $f = 5 * 6e4;
function dp(n, a, r, o = bt()) {
  const s = Date.now() + $f;
  let u = !1, m = () => {
  };
  const f = () => {
    u = !0, m(), clearTimeout(v);
  }, p = () => {
    if (!u) {
      if (Date.now() >= s) return f();
      Wy(n, a, o) && (f(), o.startSession?.(n, a, r));
    }
  }, v = setTimeout(f, $f);
  m = o.subscribe?.(p) ?? (() => {
  }), p();
}
function Fy({ hostId: n, path: a, className: r, worktrees: o, request: s, parentChoices: u, emptyAgent: m, ...f }) {
  const [p, v] = X.useState(o), x = (k) => !!bt().coreCan?.(k, n), y = rp(), b = `${n}:${a}`, S = X.useMemo(() => {
    if (Array.isArray(u)) return u;
    if (!x("workspace.nest")) return [];
    const k = y?.projects?.find((A) => A.hostId === n && A.repoPath === a), z = [], O = (A, G) => {
      for (const W of A ?? [])
        G && z.push({ id: W.id, name: W.name, path: W.path }), O(W.children, !0);
    };
    return O(k?.workspaces, !1), z;
  }, [u, y, n, a]), N = n === "local" && x("worktree.job"), E = f.deleteSupported ?? x("worktree.delete"), T = f.startFromSupported ?? x("worktree.startFrom"), j = Ht((k) => k.emptyWorkspaceAgent?.() ?? void 0), R = m ?? j ?? void 0, U = Ht((k) => k.worktreeMenuRequest?.() ?? null), F = U?.projectKey === b ? U.nonce : null, J = X.useMemo(() => s ?? (F == null ? null : U), [s, F]), [B, g] = X.useState(J);
  Lt(() => {
    J && g(J);
  }, [J]);
  const h = X.useRef({});
  h.current = { background: N, deleteSupported: E };
  const _ = X.useMemo(() => {
    const k = (z, O) => bt().ask(z, { hostId: n, repoPath: a, ...O });
    return {
      list: async () => {
        const z = await k("worktree.list", {});
        return z?.type === "worktree.list.result" && v({ worktrees: z.worktrees ?? [], defaultRoot: z.defaultRoot ?? "", baseRef: z.baseRef, refs: z.refs ?? [] }), Zi(z);
      },
      create: async ({ branch: z, newBranch: O, path: A, extra: G, agent: W }) => {
        const D = { branch: z, newBranch: !!O, path: A ?? null, name: G?.name ?? null, startFrom: G?.startFrom ?? null, parentWorkspaceId: G?.parentWorkspaceId ?? null }, { background: Q } = h.current, I = await k(Q ? "worktree.job.start" : "worktree.create", D), Y = Q ? "worktree.job.started" : "worktree.done";
        if (I?.type !== Y) return { error: Zi(I).error ?? up };
        const K = Q ? I.job?.path : I.path;
        return W && K && dp(n, K, W), { background: Q };
      },
      remove: async (z, O) => {
        const A = await k("worktree.remove", { path: z, force: !!O, deleteBranch: h.current.deleteSupported });
        return { ...Zi(A), preservedBranch: A?.type === "worktree.done" ? A.preservedBranch ?? void 0 : void 0 };
      },
      deleteBranch: async (z, O) => Zi(await k("worktree.branch.delete", { branch: z, expectedHead: O })),
      open: (z) => bt().startSession?.(n, z, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => bt().takeWorktreeRequest?.()
    };
  }, [n, a]);
  return X.createElement(Is, {
    hostId: n,
    cwd: a,
    projectKey: b,
    className: r,
    worktrees: p,
    background: N,
    startFromSupported: T,
    deleteSupported: E,
    parentChoices: S,
    emptyAgent: R,
    request: B,
    actions: _
  });
}
const $y = (n, a) => {
  if (!bt().followPointer?.(n)) return;
  const r = a.items();
  for (const o of r) o.getBoundingClientRect();
  r[0]?.parentElement?.getBoundingClientRect(), Cv(n, a);
}, Iy = () => Ht((n) => n.workspaceTabs());
let Py = 0;
function tx({ path: n, content: a }) {
  const { source: r, truncated: o } = Xv(a ?? ""), s = bt().markdown, u = X.useMemo(() => `markdown-${++Py}`, []);
  return jl(() => {
    s?.show(u, r);
  }, [u, r]), Lt(() => () => s?.release(u), [u]), X.createElement(
    "div",
    { className: "min-h-0 min-w-0 flex-1 overflow-auto px-4 py-3 text-[0.8rem]", style: { display: "flex", flexDirection: "column" }, tabIndex: 0, role: "region", "aria-label": `Rendered preview of ${n}`, "data-testid": "workspace-markdown-preview" },
    o && X.createElement(
      "p",
      { role: "status", className: "mt-0 text-[0.7rem] text-yellow", "data-testid": "workspace-markdown-truncated" },
      `This document is large: only the first ${$i.toLocaleString()} characters are rendered. Switch to Source to see all of it.`
    ),
    X.createElement(
      "div",
      { className: "message__markdown file-markdown", style: { display: "flex", flexDirection: "column", flex: "1 1 0%", minHeight: 0 } },
      X.createElement("div", { "data-perch-engine": "markdown", "data-perch-key": u, className: "min-h-0 min-w-0 flex-1" })
    )
  );
}
const ex = Vn("file-menu"), nx = /* @__PURE__ */ new Map(), ax = ["requestTree", "searchFiles", "openFile", "reloadFile", "requestPreview", "updateDraft", "saveFile", "overwriteFile", "setWrap"];
function lx(n, a = {}) {
  const r = Ht((v) => v.workspaceFiles(n)), o = !!a.git, s = r.git?.decorations, u = X.useMemo(() => o && s?.length ? new Map(s) : nx, [s, o]), m = X.useMemo(() => Object.fromEntries(ax.map((v) => [v, (...x) => (bt().filesDo(v, n, ...x), null)])), [n]), f = Ht((v) => !!v.contextBridgeAvailable?.(n)), p = X.useMemo(() => f ? (v) => {
    if (v.kind !== "editor") return bt().askAgent(n, v);
    const x = bt().workspaceFiles(n)?.documents?.[v.path];
    return bt().askAgent(n, { ...v, dirty: x?.content !== x?.savedContent });
  } : void 0, [f, n]);
  return X.useMemo(() => ({
    workspace: r.workspace,
    connected: r.connected,
    trees: r.trees,
    documents: r.documents,
    previews: r.previews,
    search: r.search ?? void 0,
    wrap: r.wrap,
    git: { ...r.git, decorations: u },
    actions: m,
    askAgent: p
  }), [r, u, m, p]);
}
const ix = () => Ht((n) => n.statusLine()), rx = () => Ht((n) => n.zoom()), ox = () => Ht((n) => n.paneLook()), sx = () => Ht((n) => n.keybindings?.() ?? []), cx = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function ux(n) {
  const a = !!n?.keepFresh, r = Ht((s) => s.statusLine?.().connected ?? !1), o = Ht((s) => s.planUsage?.() ?? cx);
  return Lt(() => {
    if (!a || !r) return;
    let s;
    const u = () => {
      bt().command("usage.get"), s = setTimeout(u, 18e4);
    };
    return u(), () => clearTimeout(s);
  }, [a, r]), o;
}
const dx = () => bt().command("usage.get", { force: !0 }), fx = (n) => bt().command("usage.redeemReset", { accountId: n }), mx = () => yr("app.zoom_reset"), px = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, hx = (n, a, r) => bt().beginTabDrag?.(n, a, r);
function gx(n) {
  Lt(() => bt().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const bx = (n) => yr("browser.open", { workspaceId: n }), vx = (n, a) => yr("file.open", { workspaceId: n, path: a }), yx = () => null, xx = () => null, wx = Vn("new-file"), _x = [
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
], kx = /* @__PURE__ */ new Set(["discardPreview", "commitPreview", "previewBatch", "sendBatch"]);
function Sx(n) {
  const a = {};
  for (const r of _x)
    a[r] = (...o) => {
      const s = bt().gitDo(r, n, ...o);
      return kx.has(r) ? s.then((u) => u ?? null, () => null) : (s.catch?.((u) => console.error(`perch: ${r}: ${u?.message ?? u}`)), null);
    };
  return a;
}
function Ex(n) {
  const a = Ht((o) => o.gitReview(n)), r = X.useMemo(() => Sx(n), [n]);
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
    actions: r,
    askAgent: void 0
  }), [a, r]);
}
function fp(n) {
  const { workspaceId: a } = n, r = `diff:${a}:${X.useId()}`, o = bt(), s = X.useRef(null);
  s.current !== r && (o.diff.open(r, { workspaceId: a }), s.current = r), o.diff.setProps(r, {
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
  const u = Ht((p) => p.gitReview(a)).comments ?? [], m = X.useSyncExternalStore(np, () => o.diff.seq(r)), f = X.useRef(n);
  return f.current = n, Lt(() => {
    const p = f.current, v = (x) => u.find((y) => y.id === x);
    for (const x of o.diff.events(r))
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
  }, [m, r]), X.createElement("div", { "data-perch-engine": "diff", "data-perch-key": r, "data-testid": "git-diff", className: n.className ?? "min-h-0 flex-1" });
}
fp.splitLayout = !0;
function zx(n) {
  return X.createElement(T1, { ...n, perch: bt() });
}
function Nx(n, a) {
  const r = n.selection(a);
  if (r) return r;
  const o = n.value(a), s = o.split(`
`).length - (o.endsWith(`
`) && o.length ? 1 : 0);
  return { text: o, startLine: 1, endLine: Math.max(1, s) };
}
function Tx({ onGo: n, onClose: a }) {
  const [r, o] = X.useState(""), s = (u) => {
    u?.preventDefault?.();
    const [m, f] = r.split(":").map((p) => Number.parseInt(p, 10));
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
      value: r,
      className: "min-w-0 flex-1 rounded border border-border bg-transparent px-1 text-text",
      onChange: (u) => o(u.target.value),
      onKeyDown: (u) => {
        u.key === "Escape" ? (u.preventDefault(), a()) : u.key === "Enter" && s(u);
      }
    }),
    X.createElement("button", { type: "button", className: Hl, onClick: s }, "OK")
  );
}
function Cx({ value: n, onChange: a, onSave: r, onCaret: o, readOnly: s, wrap: u, label: m, path: f, docKey: p, onAskAgent: v, ref: x }) {
  const y = bt().editor, b = X.useRef(null);
  b.current = { onChange: a, onSave: r, onCaret: o, onAskAgent: v };
  const [S, , N] = String(p).split("\0"), E = !!y && N !== void 0 && /^\d+$/.test(N), T = Ht((_) => E ? _.workspaceFiles(S)?.carets?.[p] ?? null : null);
  Lt(() => {
    T && b.current.onCaret?.({ line: T.line, col: T.col });
  }, [T?.line, T?.col]);
  const j = X.useRef(n), [R, U] = X.useState(null), [F, J] = X.useState(!1), B = () => {
    if (!y || !b.current.onAskAgent) return;
    const { text: _, startLine: k, endLine: z } = Nx(y, p);
    b.current.onAskAgent(_, k, z);
  };
  if (X.useImperativeHandle(x, () => ({
    openGoto: () => J(!0),
    focus: () => y?.focus(p),
    askAgent: B
  }), [p]), jl(() => {
    if (!y) return;
    y.open(p, { path: f, value: n, readonly: !!s, wrap: !!u, label: m }), j.current = n;
    const _ = y.watch(p, (k) => {
      for (const z of k)
        if (z.type === "change") {
          const O = y.value(p);
          j.current = O, b.current.onChange?.(O);
        } else z.type === "caret" ? b.current.onCaret?.({ line: z.line, col: z.col }) : z.type === "save" ? b.current.onSave?.() : z.type === "goto" ? J(!0) : z.type === "contextmenu" && U({ x: z.x, y: z.y });
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
    F && X.createElement(Tx, {
      onGo: (_, k) => {
        J(!1), y.goTo(p, _, k), y.focus(p);
      },
      onClose: () => {
        J(!1), y.focus(p);
      }
    }),
    X.createElement("div", { "data-perch-engine": "editor", "data-perch-key": p, className: "min-h-0 min-w-0 flex-1" }),
    R && X.createElement(Fv, {
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
          U(null), J(!0);
        },
        ...v ? { askAgent: () => {
          U(null), B();
        } } : {}
      }
    })
  );
}
const Mx = Object.freeze({ pages: [], shownId: null, tabCount: 0 });
function Ax(n) {
  const a = Ht((r) => r.browserPages?.(n) ?? Mx);
  return X.useMemo(() => {
    const r = (o, s) => bt().command(o, { workspaceId: n, ...s });
    return {
      pages: a.pages ?? [],
      shownId: a.shownId ?? null,
      tabCount: a.tabCount ?? 0,
      open: () => {
        const o = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        return r("browser.drawer.open", { id: o }), o;
      },
      select: (o) => r("browser.drawer.select", { id: o }),
      close: (o) => r("browser.drawer.close", { id: o }),
      closeAll: () => r("browser.drawer.closeAll", {}),
      // The window follows the page itself; nothing to keep here.
      setUrl: () => {
      }
    };
  }, [a, n]);
}
function jx({ pageId: n, active: a }) {
  const r = `drawer
${n}`;
  return Lt(() => {
    a && bt().command("browser.focus", { key: r });
  }, [a, r]), X.createElement("div", {
    "data-perch-engine": "browser",
    "data-perch-key": r,
    "data-testid": "browser-page",
    style: { display: "flex", flex: "1 1 0%", minHeight: 0, minWidth: 0 }
  });
}
const Fx = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: sp,
  BrowserPage: jx,
  Chevron: $s,
  CloseIcon: Vv,
  CodeEditor: Cx,
  ConfirmDialog: qy,
  Dialog: Xy,
  DiffView: fp,
  EllipsisIcon: Yv,
  FileAsset: zx,
  FileEntryMenu: ex,
  FileIcon: A1,
  FolderBrowser: Vy,
  GearIcon: Lv,
  GitMarker: R1,
  HostStateDot: Qv,
  InstructionsDialog: Qy,
  MarkdownPreview: tx,
  MemoryDialog: Ky,
  ModeSwitch: G1,
  NewFilePrompt: wx,
  NewSessionMenu: By,
  PageIcon: g1,
  PlusIcon: Jm,
  QrCode: W1,
  Select: Gy,
  SessionDot: jy,
  SessionMenu: Dy,
  SettingRow: $1,
  SettingsGroup: F1,
  SettingsQuery: Rl,
  Slot: Oy,
  Submenu: f1,
  Switch: I1,
  TabDragLayer: xx,
  TabMenu: yx,
  WorktreeMenu: Jy,
  agentStateColor: gy,
  anchoredPopoverStyle: cy,
  assetKind: Im,
  beginReorderDrag: $y,
  beginTabDrag: hx,
  bindHost: sy,
  buttonClass: my,
  cn: jt,
  drawConfirmationsInPlace: Uy,
  drawFolderBrowserInPlace: Yy,
  drawWorktreeInPlace: Zy,
  ghostButton: py,
  glassClass: iy,
  iconButton: hy,
  isMac: ap,
  keyLabel: Ds,
  menuDividerClass: Pi,
  menuItemClass: lp,
  menuPanel: vr,
  nestSessions: Ay,
  newId: uy,
  openBrowserTab: bx,
  openFileTab: vx,
  pickFolder: xy,
  redeemUsageReset: fx,
  refreshUsage: dx,
  resetZoom: mx,
  rowActionClass: fy,
  runCommand: yr,
  segmentClass: dy,
  settingsClass: ty,
  shortcutFor: by,
  shortcutLabel: ip,
  startPaneWhenReady: dp,
  startSession: yy,
  tabStateClass: px,
  tapButtonClass: ry,
  tip: vy,
  useAddProject: ky,
  useAddProjectRequest: My,
  useAgentChoices: Cy,
  useBrowserPages: Ax,
  useDismissOnOutsideClick: $m,
  useGitReview: Ex,
  useHostSnapshot: Ht,
  useHosts: wy,
  useKeybindings: sx,
  useNavigation: rp,
  useNewTabRequest: gx,
  useNotifications: Ty,
  usePaneLook: ox,
  usePlanUsage: ux,
  useResourceState: ly,
  useSessionFolders: _y,
  useSettingsQuery: P1,
  useStatusLine: ix,
  useWorkspaceFiles: lx,
  useWorkspaceTabs: Iy,
  useZoom: rx,
  version: oy
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
const Ps = {
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
  Ps[n] = (a, r) => a[n](r);
const $x = Object.keys(Ps);
function hs(n, a) {
  for (const [r, o] of Object.entries(a)) {
    const s = Ps[r];
    if (!s) throw new Error(`the description key ${r} has no GPUI builder`);
    o != null && (n = s(n, o));
  }
  return n;
}
const ua = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), Hs = /* @__PURE__ */ new WeakSet(), tr = /* @__PURE__ */ new WeakSet();
function If(n, a, r) {
  const o = n.pressed, s = ua(r);
  return o && o.x === s.clientX && o.y === s.clientY ? o.id : a;
}
function Ox(n, a, r, o) {
  if (n.name) return n.name;
  if (!(a.size || n.hover || n.focus || n.active || n.track_hover && fr.has(n.group) || r || o)) return null;
  const s = n.meta?.attrs["data-testid"];
  return s ? `~${n.id}:${s}` : `~${n.id}`;
}
const mp = (n) => (n.children ?? []).some((a) => a.kind === "text" ? String(a.text ?? "").trim() !== "" : mp(a));
function Rx(n) {
  const a = n.meta?.attrs;
  return a && (a.title || (n.meta.tag === "button" && a["aria-label"] && !mp(n) ? a["aria-label"] : "") || a["data-overflow-title"]) || "";
}
const pp = (n, a = !1) => (n.children ?? []).some((r) => r.kind === "text" ? !a || /\s/.test(String(r.text ?? "").trim()) : r.kind === "div" && r.style?.flex_direction !== "row" && r.style?.whitespace !== "nowrap" && pp(r, !0)), Te = (n) => n.style?.display !== "hidden";
let fr = /* @__PURE__ */ new Set(), Us = null;
const Pf = /* @__PURE__ */ new WeakMap();
function hp(n, a = /* @__PURE__ */ new Set()) {
  let r = Pf.get(n);
  if (!r) {
    r = /* @__PURE__ */ new Set();
    for (const { group: o, style: s } of n.group_hover ?? []) "display" in s && r.add(o);
    for (const o of n.children ?? []) if (o.kind !== "text") for (const s of hp(o)) r.add(s);
    Pf.set(n, r);
  }
  for (const o of r) a.add(o);
  return a;
}
let $e = null;
const Dx = (n, a, r, o, s, u, m) => `${+a}|${r}|${o.text_size}|${o.line_height}|${o.whitespace}|${o.text_ellipsis}|${+s}|${u ? `${u.group}|${u.color}` : ""}|${+Hs.has(n)}|${+tr.has(n)}|${m.get(n)?.flex_basis ?? ""}`, tm = /* @__PURE__ */ new WeakMap();
function gp(n) {
  let a = tm.get(n);
  return a === void 0 && (a = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll" || (n.children ?? []).some((r) => r.kind !== "text" && gp(r)), tm.set(n, a)), a;
}
function bp(n, a, r, o) {
  let s = Bx(a.get(n), r.get(n));
  if (n.kind === "text") return s;
  for (const u of n.children ?? []) bp(u, a, r, o) || (s = !1);
  return s && o.add(n), s;
}
function Bx(n, a) {
  if (n === a) return !0;
  if (!n || !a) return !1;
  const r = Object.keys(n);
  if (r.length !== Object.keys(a).length) return !1;
  for (const o of r) if (n[o] !== a[o]) return !1;
  return !0;
}
function qs(n, a, r, o, s = !1, u = !1, m = null, f = {}, p = !1, v = /* @__PURE__ */ new Map(), x = null) {
  if (n.kind === "text") return v.get(n)?.text ?? n.text;
  const y = $e && !s && !gp(n) ? Dx(n, u, m, f, p, x, v) : null;
  if (y !== null && $e.clean.has(n)) {
    const S = $e.from.get(n), N = S?.key === y ? a.reuse(S.id, $e.generation) : null;
    if (N)
      return $e.next.set(n, { id: N.__id, key: y }), N;
  }
  const b = Hx(n, a, r, o, s, u, m, f, p, v, x);
  return y !== null && $e.next.set(n, { id: b.__id, key: y }), b;
}
function Hx(n, a, r, o, s, u, m, f, p, v, x) {
  const y = Hs.has(n);
  u ||= n.style.opacity === 0 || n.style.visibility === "invisible" || n.style.display === "hidden", u && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0, also: void 0 }), n.style.text_color !== void 0 && (x = null), m = n.style.text_color ?? m;
  const b = !!n.hover?.text_color && wp(n), S = n.group ?? (b ? `~g${n.id}` : null);
  b && (x = { group: S, color: n.hover.text_color }), f = { ...f };
  for (const A of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[A] !== void 0 && (f[A] = n.style[A]);
  const N = new Set(n.events ?? []), E = s ? { count: 0, hits: /* @__PURE__ */ new Set(), at: null } : !u && !n.pointer_none && n.style.position === "absolute" ? Us : null, T = E ? E.count++ : -1;
  s && (Us = E);
  let j;
  if (n.kind === "image" && !n.markup ? j = a.image(n.src) : j = a.div(), n.kind === "engine" && (j = j.child(o.engine ? o.engine(n.engine, n.key) : a.div())), n.markup && n.kind === "svg" && x && x.color !== m) {
    const { group: A, color: G } = x, W = () => a.div().absolute().top(0).left(0).size_full();
    j = j.child(W().group_hover(A, (D) => D.invisible()).child(o.icon(`~icon-${n.id}`, n.markup, m))).child(W().invisible().group_hover(A, (D) => D.visible()).child(o.icon(`~icon-${n.id}-hover`, n.markup, G)));
  } else n.markup && (j = j.child(o.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? m : "")));
  const R = u ? "" : Rx(n), U = Ox(n, N, !!E, !!R);
  if (U && (j = j.id(U)), R && (j = j.tooltip(R, !n.meta.attrs.title && R === n.meta.attrs["data-overflow-title"])), n.measure && (j = j.measure(n.measure)), n.name && j.also_named) for (const A of n.also ?? []) j = j.also_named(A);
  j = hs(j, { ...n.style, ...v.get(n) });
  const F = f.whitespace !== "nowrap" && !f.text_ellipsis;
  p && F && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && pp(n) && (j = j.min_w(0));
  for (const A of ["hover", "focus", "active"]) n[A] && (j = j[A]((G) => hs(G, n[A])));
  S && (j = j.group(S));
  for (const { group: A, style: G } of n.group_hover ?? []) {
    const { display: W, ...D } = G;
    Object.keys(D).length && (j = j.group_hover(A, (Q) => hs(Q, D)));
  }
  if (a.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const A = r.document?.scrollTarget, G = A ? (n.children ?? []).filter(Te).findIndex((W) => xp(W, A.id)) : -1;
    if (G >= 0 && (r.scroller ?? n.id) === n.id && (r.document.scrollTarget = null, r.scroller = n.id, a.scroll.scroll_to_item(G)), r.scroller ??= n.id, r.scroller === n.id && r.document) {
      j = j.track_scroll(a.scroll);
      const W = (n.children ?? []).filter(Te).map((D) => D.id);
      r.document.itemBounds = (D) => W.includes(D) ? a.scroll.item_bounds?.(W.indexOf(D)) ?? null : null;
    }
  }
  const J = n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll", B = s && !n.pointer_none || n.blocks_pointer;
  if ((J && tr.has(n) || B) && (j = j.on_scroll_wheel((A, G) => G.stop_propagation?.())), J && N.has("scroll") && (j = j.on_scroll_wheel((A, G) => {
    r.dispatch(n.id, "scroll", {}), G.notify();
  })), J || tr.has(n)) for (const A of n.children ?? []) A.kind !== "text" && tr.add(A);
  n.kind === "input" && !n.disabled && (j = j.on_mouse_down("left", (A, G) => {
    A.bounds && r.setBounds(n.id, A.bounds), r.focus(n.id), G.notify();
  }));
  const g = n.kind === "input" ? n : n.meta?.tag === "label" ? yp(n) : null;
  g && !g.disabled && /^(checkbox|radio)$/.test(g.input_type) && (j = j.on_click((A, G) => {
    G.stop_propagation?.(), r.toggle(g.id), G.notify();
  }));
  const h = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((A) => N.has(A));
  if (h || y) for (const A of n.children ?? []) A.kind !== "text" && Hs.add(A);
  if (h && (j = j.on_mouse_down("left", (A, G) => {
    G.stop_propagation?.(), A.bounds && r.setBounds(n.id, A.bounds);
    const W = { ...ua(A), button: 0, buttons: 1, detail: A.click_count }, D = If(r, n.id, A);
    r.pressed = null, r.dispatch(D, "pointerdown", { ...W, pointerType: "mouse" }), r.dispatch(D, "mousedown", W) && r.pressFocus?.(D), G.notify();
  }), j = j.on_mouse_down("right", (A, G) => {
    G.stop_propagation?.(), A.bounds && r.setBounds(n.id, A.bounds);
    const W = If(r, n.id, A);
    r.pressed = null, r.dispatch(W, "contextmenu", { ...ua(A), button: 2 }), G.notify();
  }), j = j.on_mouse_up("left", (A, G) => {
    G.stop_propagation?.();
    const W = { ...ua(A), button: 0 };
    r.dispatch(n.id, "pointerup", { ...W, pointerType: "mouse" }), r.dispatch(n.id, "mouseup", W), G.notify();
  }), j = j.on_click((A, G) => {
    r.dispatch(n.id, A.click_count === 2 && N.has("double_click") ? "dblclick" : "click", { detail: A.click_count, button: 0 }), G.notify();
  })), n.blocks_pointer && !h)
    for (const A of ["left", "right"]) j = j.on_mouse_down(A, (G, W) => W.stop_propagation?.());
  else if (y && !h)
    for (const A of ["left", "right"])
      j = j.on_mouse_down(A, (G) => {
        const W = ua(G);
        (r.pressed?.x !== W.clientX || r.pressed?.y !== W.clientY) && (r.pressed = { id: n.id, x: W.clientX, y: W.clientY });
      });
  if (N.has("mouse_move") && (j = j.on_mouse_move((A) => {
    r.dispatch(n.id, "pointermove", { ...ua(A), pointerType: "mouse" });
  })), n.track_hover && fr.has(n.group) && (j = j.on_hover((A, G) => {
    r.hover(n.id, A), G.notify();
  })), E && (j = j.on_mouse_down_out((A, G) => {
    const W = ua(A), D = `${W.clientX},${W.clientY}`;
    E.at !== D && (E.at = D, E.hits = /* @__PURE__ */ new Set()), E.hits.add(T), !(E.hits.size < E.count) && (E.at = null, r.dispatch(r.document.body.id, "pointerdown", { ...W, pointerType: "mouse" }), r.dispatch(r.document.body.id, "mousedown", W), G.notify());
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const A = n.value ? String(n.value) : String(n.placeholder ?? "");
    let G = a.div().whitespace_nowrap().overflow_x_hidden();
    const W = da(f);
    W && (G = G.h(W)), !n.value && m && (G = G.text_color(qx(m)));
    const D = n.input_type === "password" && n.value ? "•".repeat([...A].length) : A;
    if (n.caret) {
      const Q = a.div().w(1).flex_none().bg(m ?? "#ffffff").loop("opacity", { from: 1, to: 0, period: 800, easing: "linear" });
      G = G.flex().flex_row(), G = n.value ? G.child(D).child(Q) : A ? G.child(Q.mr(-1)).child(A) : G.child(Q.h(W ?? Math.round((f.text_size ?? 13) * 1.2))), j = j.child(G);
    } else A && (j = j.child(G.child(D)));
    n.field_w && (j = j.child(a.div().w(n.field_w).h(0))), n.input_type !== "textarea" && (j = j.flex().flex_col().justify_center());
  }
  const _ = f.whitespace === "nowrap" ? da(f) : null, k = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let z = !n.range_name;
  const O = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const A of (n.children ?? []).filter(Te)) {
    const G = A.style?.flex_basis;
    O && A.style.flex_grow > 0 && (G === 0 || typeof G == "string" && G.endsWith("%")) && v.set(A, { ...v.get(A), flex_basis: "auto" });
    let W = qs(A, a, r, o, !1, u, m, f, k && A.style?.position !== "absolute", v, x);
    const D = !z && (A.kind === "text" || !A.meta), Q = A.kind === "text" ? v.get(A)?.h ?? _ : null, I = A.kind === "text" ? v.get(A)?.w : void 0;
    if (D || Q || I !== void 0) {
      let Y = a.div();
      D && (Y = Y.id(n.range_name)), D && !k && n.style.display === "flex" && (Y = Y[`self_${Ux[f.text_align] ?? "start"}`]().max_w("100%")), Q && (Y = Y.h(Q)), I !== void 0 && (Y = Y.w(I).flex_none().whitespace_nowrap()), W = Y.child(W), z ||= D;
    }
    j = j.child(W);
  }
  return j;
}
const Ux = { center: "center", right: "end", end: "end" };
function qx(n) {
  const a = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(a)) return n;
  const r = a.length === 9 ? Number.parseInt(a.slice(7), 16) : 255;
  return `${a.slice(0, 7)}${Math.round(r / 2).toString(16).padStart(2, "0")}`;
}
const vp = /^(?:[!-,.-~]+|\S)$/u, yp = (n) => {
  for (const a of n.children ?? []) {
    if (a.kind === "input" && /^(checkbox|radio)$/.test(a.input_type)) return a;
    const r = a.kind === "text" ? null : yp(a);
    if (r) return r;
  }
  return null;
}, xp = (n, a) => n.id === a || (n.children ?? []).some((r) => r.kind !== "text" && xp(r, a)), wp = (n) => !!n.markup || (n.children ?? []).some((a) => a.kind !== "text" && wp(a));
function da(n) {
  const a = n.line_height;
  return typeof a == "string" && a.endsWith("px") ? Number.parseFloat(a) : typeof a == "number" && typeof n.text_size == "number" ? a * n.text_size : null;
}
function Ix(n, a, r, o, s = 0, u = !1) {
  const m = [n.root, ...n.overlays];
  fr = /* @__PURE__ */ new Set(), Us = null;
  for (const b of m) hp(b, fr);
  const f = s > 0 ? Xx(m, s) : /* @__PURE__ */ new Map();
  s > 0 && o.measure && Gx(m, s, o.measure, f), Qx(m, f), Vx(m, f), o.measure && Lx(m, o.measure, f);
  const p = a.reuse && a.renderGeneration ? r.retained ??= { built: /* @__PURE__ */ new Map(), overrides: /* @__PURE__ */ new Map(), generation: -1 } : null, v = new Map(f);
  p && n.root && ($e = { from: p.built, generation: p.generation, clean: /* @__PURE__ */ new Set(), next: /* @__PURE__ */ new Map() }, bp(n.root, f, p.overrides, $e.clean));
  let x;
  try {
    x = a.div().relative().size_full().child(qs(n.root, a, r, o, !1, !1, null, {}, !1, f)), p && Object.assign(p, { built: $e?.next ?? /* @__PURE__ */ new Map(), overrides: v, generation: a.renderGeneration() ?? -1 });
  } finally {
    $e = null;
  }
  let y = u && n.overlays.length ? a.div().relative().size_full().window_layer() : x;
  for (const b of n.overlays) y = y.child(qs(b, a, r, o, !0, !1, null, {}, !1, f));
  return y === x ? x : x.child(y);
}
function Gx(n, a, r, o) {
  (Ji.scale !== a || Ji.measure !== r) && (Ji = { scale: a, measure: r, widths: /* @__PURE__ */ new WeakMap(), fonts: /* @__PURE__ */ new WeakMap(), keys: /* @__PURE__ */ new WeakMap(), visits: /* @__PURE__ */ new WeakMap() });
  const { widths: s, fonts: u, keys: m, visits: f } = Ji, p = [], v = (R, U) => o.set(R, { ...o.get(R), ...U }), x = (R, U) => {
    p.push(R, U), v(R, U);
  }, y = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function b(R, U, F) {
    if (R.kind === "text") {
      if (!(U.whitespace === "nowrap" || vp.test(R.text)) || U.text_ellipsis || F || typeof U.text_size != "number") return NaN;
      const O = r(R.text, { size: U.text_size, weight: U.font_weight ?? 400, family: U.font_family ?? ".SystemUIFont", italic: !!U.italic });
      return Number.isFinite(O) ? O : NaN;
    }
    if (!Te(R) || R.kind === "input" || R.kind === "engine" || R.markup) return S(R);
    const J = `${U.text_size}|${U.font_weight}|${U.font_family}|${U.italic}|${U.whitespace}|${U.text_ellipsis}|${+F}`;
    if (m.get(R) === J && s.has(R)) return s.get(R);
    m.set(R, J);
    const B = { ...U };
    for (const z of y) R.style[z] !== void 0 && (B[z] = R.style[z]);
    B.text_ellipsis = !!R.style.text_ellipsis, u.set(R, B);
    const g = R.style, h = (R.children ?? []).filter(Ve), _ = h.map((z) => b(z, B, F || !!R.tabular));
    let k = S(R);
    if (!Number.isFinite(k) && g.w === void 0) {
      const z = h.map((A, G) => _[G] + (A.kind === "text" ? 0 : ot(A.style.ml) + ot(A.style.mr)));
      let O;
      h.length ? Re(R) ? O = h.some((A) => A.kind !== "text" && A.style.flex_grow > 0) || g.flex_wrap === "wrap" ? NaN : z.reduce((A, G) => A + G, 0) + ot(g.gap_x) * (h.length - 1) : O = Math.max(...z) : O = 0, k = O + ot(g.pl) + ot(g.pr) + ot(g.border_l) + ot(g.border_r), typeof g.min_w == "number" && (k = Math.max(k, g.min_w)), typeof g.max_w == "number" && (k = Math.min(k, g.max_w));
    }
    return s.set(R, k), k;
  }
  const S = (R) => typeof R.style?.w == "number" ? R.style.w : NaN, N = () => ({ exact: 0, laid: 0 }), E = (R, U) => {
    if (!Number.isFinite(U))
      return Object.assign(R, N()), NaN;
    R.exact += U;
    const F = Math.round(R.exact * a + 1e-9) / a, J = F - R.laid;
    return R.laid = F, J;
  }, T = (R) => Re(R) && R.style.flex_wrap !== "wrap" && (R.style.justify ?? "start") === "start";
  function j(R) {
    if (!R || R.kind === "text" || !Te(R)) return;
    const U = m.get(R), F = f.get(R);
    if (F && U !== void 0 && F.key === U) {
      for (let g = 0; g < F.log.length; g += 2)
        p.push(F.log[g], F.log[g + 1]), v(F.log[g], F.log[g + 1]);
      return;
    }
    const J = p.length, B = (R.children ?? []).filter(Ve);
    if (T(R) && B.length > 1) {
      const g = ot(R.style.gap_x), h = N(), _ = !(g && B.some((k) => k.kind === "text" || !Number.isFinite(ot(k.style.ml))));
      x(R, { border_l: E(h, ot(R.style.border_l)), pl: E(h, ot(R.style.pl)) }), _ && g && x(R, { gap_x: 0 }), B.forEach((k, z) => {
        const O = (z && _ ? g : 0) + (k.kind === "text" ? 0 : ot(k.style.ml));
        if (k.kind === "text")
          O && Object.assign(h, N());
        else {
          const D = E(h, O);
          Number.isFinite(D) && x(k, { ml: D });
        }
        const A = k.kind === "text" ? u.get(R) ?? {} : null, G = k.kind === "text" ? b(k, A, !!R.tabular) : s.get(k);
        if ((k.kind === "text" || !(k.style.flex_grow > 0)) && Number.isFinite(G)) {
          const D = { w: E(h, G) };
          k.kind !== "text" && typeof k.style.w != "number" && k.style.min_w === void 0 && (D.whitespace = "nowrap", D.flex_shrink = 0), x(k, D);
        } else Object.assign(h, N());
        if (k.kind !== "text") {
          const D = E(h, ot(k.style.mr));
          Number.isFinite(D) && x(k, { mr: D });
        }
      });
    }
    for (const g of R.children ?? []) g.kind !== "text" && j(g);
    U !== void 0 && f.set(R, { key: U, log: p.slice(J) });
  }
  for (const R of n)
    R && (b(R, {}, !1), j(R));
}
let Ji = { scale: 0, measure: null };
const Yx = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function Lx(n, a, r) {
  const o = ["text_size", "font_weight", "font_family", "italic", "line_height"], s = (x) => typeof x == "number" ? x : 0, u = (x, y) => y && mr(y) && !Re(y) && x.style.position !== "absolute" && !["start", "center", "end"].includes(x.style.self) && !["start", "center", "end"].includes(y.style.items);
  Wi.measure !== a && (Wi = { measure: a, walks: /* @__PURE__ */ new WeakMap() });
  const m = [], f = (x, y) => {
    m.push(x, y), r.set(x, { ...r.get(x), ...y });
  }, p = (x, y, b, S) => {
    if (!x || x.kind === "text" || !Te(x)) return;
    const N = `${b}|${+u(x, y)}|${S.text_size}|${S.font_weight}|${S.font_family}|${S.italic}|${S.line_height}`, E = Wi.walks.get(x);
    if (E?.key === N) {
      for (let j = 0; j < E.log.length; j += 2) f(E.log[j], E.log[j + 1]);
      return;
    }
    const T = m.length;
    v(x, y, b, S), Wi.walks.set(x, { key: N, log: m.slice(T) });
  }, v = (x, y, b, S) => {
    const N = x.style;
    let E = typeof N.w == "number" ? N.w : N.w === "100%" ? b : u(x, y) ? b - s(N.ml) - s(N.mr) : NaN;
    typeof N.max_w == "number" && (E = Math.min(E, N.max_w));
    const T = E - s(N.pl) - s(N.pr) - s(N.border_l) - s(N.border_r), j = { ...S };
    for (const U of o) N[U] !== void 0 && (j[U] = N[U]);
    const R = x.children ?? [];
    if (x.break_anywhere && Number.isFinite(T) && T > 0 && typeof j.text_size == "number" && R.length && R.every((U) => U.kind === "text")) {
      const U = { size: j.text_size, weight: j.font_weight ?? 400, family: j.font_family ?? ".SystemUIFont", italic: !!j.italic }, F = (g) => a(g.trimEnd(), U) <= T + 0.01;
      let J = 0;
      for (const g of R) {
        const h = [];
        for (const k of g.text.split(`
`)) {
          let z = "";
          for (const O of k.split(Yx)) {
            if (F(z + O)) {
              z += O;
              continue;
            }
            z && h.push(z.trimEnd()), z = "";
            for (const A of O)
              z && !F(z + A) && (h.push(z), z = ""), z += A;
          }
          h.push(z.trimEnd());
        }
        const _ = h.join(`
`);
        h.every((k) => !k || F(k)) ? _ !== g.text && f(g, { text: _ }) : J = NaN, J += h.length;
      }
      const B = da(j);
      Number.isFinite(J) && B && N.h === void 0 && R.length === 1 && f(x, { h: J * B + s(N.pt) + s(N.pb) + s(N.border_t) + s(N.border_b) });
    }
    for (const U of R) p(U, x, Re(x) ? NaN : T, j);
  };
  for (const x of n) p(x, null, NaN, {});
}
let Wi = { measure: null };
function Vx(n, a) {
  const r = (o, s) => {
    if (!o || o.kind === "text" || !Te(o)) return;
    const u = o.style, m = u.position === "absolute" ? u.w === void 0 && (u.left === void 0 || u.right === void 0) : s && typeof u.w != "number";
    if (m && Re(o))
      for (const f of o.children ?? []) {
        const p = f.kind === "text" ? void 0 : f.style.flex_basis;
        f.kind !== "text" && f.style.flex_grow > 0 && (p === 0 || typeof p == "string" && p.endsWith("%")) && a.set(f, { ...a.get(f), flex_basis: "auto" });
      }
    for (const f of o.children ?? []) r(f, m);
  };
  for (const o of n) r(o, !1);
}
function Qx(n, a) {
  const r = a.heights ?? /* @__PURE__ */ new Map(), o = (p) => r.get(p), s = (p) => {
    const v = o(p);
    if (Number.isFinite(v)) return v;
    if (p.kind === "text" || !Te(p)) return 0;
    const x = p.style, y = typeof x.min_h == "number" ? x.min_h : 0, b = (p.children ?? []).filter(Ve), S = b.map((T) => s(T) + (T.kind === "text" ? 0 : Math.max(0, ot(T.style.mt) || 0) + Math.max(0, ot(T.style.mb) || 0))), N = b.length ? Re(p) ? Math.max(...S) : S.reduce((T, j) => T + j, 0) + (x.display === "flex" ? (ot(x.gap_y) || 0) * (b.length - 1) : 0) : 0, E = [x.pt, x.pb, x.border_t, x.border_b].reduce((T, j) => T + (ot(j) || 0), 0);
    return Math.max(y, N + E);
  }, u = (p) => !(p.children ?? []).filter(Ve).length || Re(p) ? NaN : s({ ...p, style: { ...p.style, h: void 0, max_h: void 0, min_h: void 0 } }), m = (p, v) => {
    const x = p.style;
    if (typeof x.h == "number") return x.h;
    if (typeof x.max_h == "number") return x.max_h;
    if (!v || !mr(v) || Re(v)) return NaN;
    const y = v.style, b = typeof y.h == "number" ? y.h : typeof y.max_h == "number" ? y.max_h : NaN, S = (v.children ?? []).filter(Ve);
    let N = 0;
    for (const T of S) {
      if (T === p) continue;
      const j = o(T);
      if (!Number.isFinite(j)) return NaN;
      N += j + (T.kind === "text" ? 0 : ot(T.style.mt) + ot(T.style.mb));
    }
    const E = y.display === "flex" ? ot(y.gap_y) * Math.max(0, S.length - 1) : 0;
    return b - ot(y.pt) - ot(y.pb) - ot(y.border_t) - ot(y.border_b) - N - E - ot(x.mt) - ot(x.mb);
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
const Kx = ["text_size", "line_height", "whitespace", "text_ellipsis"], ot = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, mr = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Re = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Ve = (n) => n.kind === "text" || Te(n) && n.style.position !== "absolute";
function Xx(n, a) {
  gs.scale !== a && (gs = _p(a));
  const { heights: r, texts: o, textKeys: s, visits: u, places: m } = gs, f = /* @__PURE__ */ new Map(), p = [], v = (B, g) => {
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
    if (B.kind === "text") return g.whitespace === "nowrap" || vp.test(B.text) ? da(g) ?? NaN : NaN;
    const h = `${g.text_size}|${g.line_height}|${g.whitespace}|${g.text_ellipsis}`;
    if (s.get(B) === h && r.has(B)) return r.get(B);
    let _ = g;
    for (const G of Kx) B.style[G] !== void 0 && B.style[G] !== _[G] && (_ === g && (_ = { ...g }), _[G] = B.style[G]);
    s.set(B, h), o.set(B, _);
    const k = B.style, z = (B.children ?? []).filter(Ve), O = z.map((G) => b(G, _));
    let A;
    if (k.h !== void 0 && k.h !== "auto") A = ot(k.h);
    else if (B.kind === "engine") A = NaN;
    else if (B.kind === "input")
      A = (B.input_type === "textarea" || B.input_type === "select" ? NaN : da(_) ?? NaN) + ot(k.pt) + ot(k.pb) + ot(k.border_t) + ot(k.border_b), k.min_h !== void 0 && (A = Math.max(A, ot(k.min_h)));
    else {
      const G = z.map((D, Q) => (D.kind === "text" ? 0 : ot(D.style.mt) + ot(D.style.mb)) + O[Q]);
      let W;
      if (Re(B)) W = k.flex_wrap === "wrap" ? NaN : k.items === "baseline" ? N(z, O, _) : Math.max(0, ...G);
      else if (mr(B)) {
        const D = z.some((I) => I.kind !== "text" && (I.style.flex_grow > 0 || I.style.flex_basis !== void 0)), Q = k.display !== "flex" && z.some((I) => I.kind !== "text" && (ot(I.style.mt) || ot(I.style.mb)));
        W = D || Q ? NaN : G.reduce((I, Y) => I + Y, 0) + (k.display === "flex" ? ot(k.gap_y) * Math.max(0, z.length - 1) : 0);
      } else W = NaN;
      A = W + ot(k.pt) + ot(k.pb) + ot(k.border_t) + ot(k.border_b), k.min_h !== void 0 && (A = Math.max(A, ot(k.min_h))), k.max_h !== void 0 && (A = Math.min(A, ot(k.max_h)));
    }
    return r.set(B, A), A;
  }
  const S = (B) => (da(B) - (cr + Em) * B.text_size) / 2 + cr * B.text_size;
  function N(B, g, h) {
    let _ = 0, k = 0;
    for (const [z, O] of B.entries()) {
      const A = O.kind === "text" ? h : o.get(O);
      if (!(O.kind === "text" || (O.children ?? []).filter(Ve).every((Q) => Q.kind === "text")) || !Number.isFinite(g[z]) || typeof A.text_size != "number") return NaN;
      const W = O.kind === "text" ? {} : O.style, D = ot(W.mt) + ot(W.border_t) + ot(W.pt) + S(A);
      _ = Math.max(_, D), k = Math.max(k, ot(W.mt) + g[z] + ot(W.mb) - D);
    }
    return _ + k;
  }
  const E = () => ({ exact: 0, laid: 0 }), T = (B, g) => {
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
    if (mr(B) && !Re(B)) {
      const k = E();
      x(B, { border_t: T(k, ot(B.style.border_t)), pt: T(k, ot(B.style.pt)) }), R(B, k);
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
        Number.isFinite(O) ? x(k, { h: T(g, O) }) : Object.assign(g, E());
        return;
      }
      if (x(k, { mt: T(g, (z ? _ : 0) + ot(k.style.mt)) }), Number.isFinite(r.get(k))) F(k, g);
      else if (U(k)) {
        const O = k.style;
        x(k, { border_t: T(g, ot(O.border_t)), pt: T(g, ot(O.pt)) }), x(k, { pb: T(g, ot(O.pb)), border_b: T(g, ot(O.border_b)) });
      } else
        j(k), Object.assign(g, E());
      x(k, { mb: T(g, ot(k.style.mb)) });
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
    J(B, g), m.set(B, { key: h, log: p.slice(k), exact: g.exact - z, laid: g.laid - O });
  }
  function J(B, g) {
    const h = B.style;
    for (const A of (B.children ?? []).filter((G) => G.kind !== "text" && Te(G) && G.style.position === "absolute")) j(A);
    const _ = g.laid, k = g.exact;
    x(B, { border_t: T(g, ot(h.border_t)), pt: T(g, ot(h.pt)) });
    const z = h.h !== void 0 && h.h !== "auto", O = r.get(B) - ot(h.pt) - ot(h.pb) - ot(h.border_t) - ot(h.border_b);
    if (B.kind === "input")
      z || T(g, O);
    else if (Re(B) || z && (h.justify ?? "start") !== "start") {
      for (const A of (B.children ?? []).filter(Ve)) A.kind !== "text" && j(A);
      z || T(g, O);
    } else !R(B, g) && !z && T(g, O);
    if (z) {
      g.exact = k + r.get(B), g.laid = Math.round(g.exact * a + 1e-9) / a, x(B, { h: g.laid - _ });
      return;
    }
    x(B, { pb: T(g, ot(h.pb)), border_b: T(g, ot(h.border_b)) }), x(B, { h: g.laid - _ });
  }
  for (const B of n)
    b(B, {}), j(B);
  return Object.defineProperty(f, "heights", { value: r }), f;
}
const _p = (n) => ({ scale: n, heights: /* @__PURE__ */ new WeakMap(), texts: /* @__PURE__ */ new WeakMap(), textKeys: /* @__PURE__ */ new WeakMap(), visits: /* @__PURE__ */ new WeakMap(), places: /* @__PURE__ */ new WeakMap() });
let gs = _p(0);
const Px = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-menu-button", selector: '[data-testid^="session-menu-button-"]', key: { self: !0, attr: "data-testid", strip: "session-menu-button-" } }, { name: "session-fold-button", selector: '[data-testid^="session-fold-"]', key: { self: !0, attr: "data-testid", strip: "session-fold-" } }, { name: "session-elbow", selector: '[data-testid^="session-elbow-"]', key: { self: !0, attr: "data-testid", strip: "session-elbow-" } }, { name: "session-rollup", selector: '[data-testid^="session-rollup-"]', key: { self: !0, attr: "data-testid", strip: "session-rollup-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-show-beside", selector: '[data-testid="tab-menu-show-beside"]' }, { name: "tab-menu-beside-list", selector: '[data-testid="tab-split-menu"] [role="menu"]' }, { name: "tab-menu-beside-item", selector: '[data-testid="tab-split-menu"] [role="menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] [role="menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] [role="menu"] > button', attr: "data-testid" } }, { name: "tab-menu-empty", selector: '[data-testid="tab-menu-empty"]' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }], window: [{ name: "sidebar-card", selector: '[data-testid="sidebar-card"]' }, { name: "main-card", selector: '[data-testid="main-card"]' }, { name: "tools-card", selector: '[data-testid="tools-card"]' }, { name: "sidebar-toggle", selector: '[data-testid="sidebar-collapse-toggle"]' }, { name: "drawer-toggle", selector: '[data-testid="workspace-tools-toggle"]' }, { name: "resize-sidebar", selector: '[data-testid="resize-sidebar"]' }, { name: "resize-tools", selector: '[data-testid="resize-tools"]' }, { name: "tools-tab", selector: 'nav[aria-label="Files, Git and Browser"] > button' }, { name: "status-bar", selector: "footer.status-bar" }], settings: [{ name: "settings-modal", selector: '[data-testid="settings-modal"]' }, { name: "settings-nav-card", selector: '[data-testid="settings-modal"] > nav' }, { name: "settings-close", selector: '[data-testid="settings-close"]' }, { name: "settings-nav", selector: 'nav [data-testid^="settings-nav-"]', key: { self: !0, attr: "data-testid", strip: "settings-nav-" } }, { name: "settings-main-card", selector: '[data-testid="settings-modal"] > main' }, { name: "settings-search", selector: '[data-testid="settings-search"]' }, { name: "settings-title", selector: '[data-testid="settings-modal"] > main h1' }, { name: "settings-body", selector: '[data-testid="settings-modal"] .settings-modal__body' }, { name: "settings-group-title", selector: '[data-testid="settings-modal"] > main h3' }, { name: "settings-group-card", selector: '[data-testid="settings-modal"] > main section > div.rounded-ui' }, { name: "settings-row", selector: '[data-testid="settings-modal"] [data-setting-row]' }, { name: "settings-row-title", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:first-child' }, { name: "settings-row-description", selector: '[data-testid="settings-modal"] [data-setting-row] > div:first-child > div:nth-child(2)' }, { name: "settings-result-title", selector: '[data-testid^="settings-result-"] > h2' }], files: [{ name: "files-explorer", selector: '[data-testid="workspace-files-view"]' }, { name: "files-tree", selector: '[data-testid="workspace-file-tree-scroll"]' }, { name: "files-entry", selector: '[data-testid^="workspace-file-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-entry-icon", selector: '[data-testid^="workspace-file-entry-"] > svg[data-file-icon]', key: { closest: '[data-testid^="workspace-file-entry-"]', attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-entry-name", selector: '[data-testid^="workspace-file-entry-"] > span.flex-1', key: { closest: '[data-testid^="workspace-file-entry-"]', attr: "data-testid", strip: "workspace-file-entry-" } }, { name: "files-pane", selector: '[data-testid="workspace-file-pane"]' }, { name: "files-file-title", selector: ".workspace-files__file-title > span:first-child" }, { name: "files-dirty", selector: '.workspace-files__file-title > span[title="Unsaved changes"]' }, { name: "files-save", selector: ".workspace-files__save" }, { name: "files-markdown-view", selector: '[aria-label="Markdown view"]' }, { name: "files-markdown-preview-button", selector: '[aria-label="Markdown view"] > button:last-child' }, { name: "files-markdown-preview", selector: '[data-testid="workspace-markdown-preview"]' }, { name: "files-conflict", selector: '[data-testid="workspace-file-conflict"]' }, { name: "files-conflict-title", selector: '[data-testid="workspace-file-conflict"] > strong' }, { name: "files-conflict-action", selector: '[data-testid="workspace-file-conflict"] button' }, { name: "files-editor", selector: '[data-testid="workspace-file-editor-area"]' }, { name: "editor-text", selector: '[data-testid="workspace-file-editor-area"] .cm-scroller' }, { name: "files-asset", selector: '[data-testid="workspace-file-asset"]' }, { name: "files-asset-header", selector: '[data-testid="workspace-file-asset"] > header' }, { name: "files-asset-title", selector: '[data-testid="workspace-file-asset"] > header > strong' }, { name: "files-image-viewer", selector: '[data-testid="workspace-image-viewer"]' }, { name: "files-image-toolbar", selector: '[data-testid="workspace-image-viewer"] > [role="toolbar"]' }, { name: "files-image-status", selector: '[data-testid="workspace-image-info"]' }], review: [{ name: "review-root", selector: '[data-testid="workspace-git-review"]' }, { name: "git-refresh", selector: '[data-testid="git-refresh"]' }, { name: "git-status", selector: '[data-testid="git-status"]' }, { name: "git-diff", selector: '[data-testid="git-diff"]' }, { name: "git-diff-empty", selector: '[data-testid="git-diff-empty"]' }, { name: "git-file-header", selector: '[data-testid="git-diff"] article > header' }, { name: "git-hunk-header", selector: '[data-testid="git-diff"] section > div:first-child' }, { name: "git-diff-line", selector: '[data-testid="git-diff-line"]' }, { name: "git-line-comments", selector: '[data-testid="git-line-comments"]' }, { name: "git-comment-composer", selector: '[data-testid="git-comment-composer"]' }] };
export {
  Px as NAMED_ELEMENTS,
  d0 as React,
  Z0 as SCHEMA,
  $x as STYLE_KEYS,
  Ix as describeToGpui,
  Zx as jsxRuntime,
  Jx as mount,
  Wx as reactDom,
  Fx as sdk
};
