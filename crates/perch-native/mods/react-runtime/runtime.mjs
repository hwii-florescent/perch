function Bd(n, i) {
  for (var o = 0; o < i.length; o++) {
    const c = i[o];
    if (typeof c != "string" && !Array.isArray(c)) {
      for (const s in c)
        if (s !== "default" && !(s in n)) {
          const d = Object.getOwnPropertyDescriptor(c, s);
          d && Object.defineProperty(n, s, d.get ? d : {
            enumerable: !0,
            get: () => c[s]
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
//! `:first-child`, `:last-child`, `:only-child`, `:nth-child(n)`, `:not()`, `:is()`, `:where()`, `:root`, the state pseudo-classes
//! (`:hover`, `:focus`, `:focus-visible`, `:focus-within`, `:active`, `:disabled`, `:enabled`, `:checked`), and the
//! descendant and child combinators. Anything else (`+`, `~`, `:has()`, pseudo-elements, ...) throws a
//! `SelectorError`, so a caller can skip a rule it cannot evaluate instead of guessing.
//!
//! An element is anything with `tagName` (lower case), `getAttribute(name)`, `parentElement` and `children`
//! (elements only). State pseudo-classes ask `options.state(element, name, isSubject)`; without it they never match.
class ze extends Error {
}
const th = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]), eh = /* @__PURE__ */ new Set(["not", "is", "where", "nth-child"]), ah = /* @__PURE__ */ new Set(["first-child", "last-child", "only-child", "root", ...th]);
function To(n) {
  return n.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (i, o, c) => o ? String.fromCodePoint(parseInt(o, 16)) : c);
}
function pi(n, i) {
  let o = i;
  for (; o < n.length; ) {
    const c = n[o];
    if (c === "\\") {
      o += 2;
      continue;
    }
    if (/[A-Za-z0-9_\- -￿]/.test(c)) {
      o++;
      continue;
    }
    break;
  }
  if (o === i) throw new ze(`expected a name at ${i} in ${JSON.stringify(n)}`);
  return [To(n.slice(i, o)), o];
}
function nh(n, i) {
  let o = 1;
  for (let c = i; c < n.length; c++) {
    const s = n[c];
    if (s === "\\") {
      c++;
      continue;
    }
    if (s === '"' || s === "'") {
      if (c = n.indexOf(s, c + 1), c < 0) break;
      continue;
    }
    if (s === "(") o++;
    else if (s === ")" && --o === 0) return c;
  }
  throw new ze(`unbalanced parenthesis in ${JSON.stringify(n)}`);
}
function Ko(n) {
  const i = [];
  let o = 0, c = 0;
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
    d === "(" || d === "[" ? o++ : d === ")" || d === "]" ? o-- : d === "," && o === 0 && (i.push(n.slice(c, s).trim()), c = s + 1);
  }
  return i.push(n.slice(c).trim()), i.filter(Boolean);
}
function lh(n, i) {
  const o = { tag: null, id: null, classes: [], attrs: [], pseudos: [] };
  let c = !1;
  for (; i < n.length; ) {
    const s = n[i];
    if (s === "*") {
      o.tag = "*", i++, c = !0;
      continue;
    }
    if (s === ".") {
      const [d, p] = pi(n, i + 1);
      o.classes.push(d), i = p, c = !0;
      continue;
    }
    if (s === "#") {
      const [d, p] = pi(n, i + 1);
      o.id = d, i = p, c = !0;
      continue;
    }
    if (s === "[") {
      const d = n.indexOf("]", i);
      if (d < 0) throw new ze(`unclosed [ in ${JSON.stringify(n)}`);
      const p = n.slice(i + 1, d).trim(), m = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(p);
      if (!m) throw new ze(`cannot read the attribute selector [${p}]`);
      const x = m[3] ?? m[4] ?? m[5];
      o.attrs.push({ name: To(m[1]).toLowerCase(), op: m[2] ?? null, value: x === void 0 ? null : To(x) }), i = d + 1, c = !0;
      continue;
    }
    if (s === ":") {
      if (n[i + 1] === ":") throw new ze(`pseudo-elements are not supported (${JSON.stringify(n)})`);
      const [d, p] = pi(n, i + 1);
      i = p;
      const m = d.toLowerCase();
      if (n[i] === "(") {
        if (!eh.has(m)) throw new ze(`:${m}() is not supported`);
        const x = nh(n, i + 1), w = n.slice(i + 1, x).trim();
        if (i = x + 1, m === "nth-child") {
          if (!/^\d+$/.test(w)) throw new ze(`:nth-child(${w}) is not supported (only a number)`);
          o.pseudos.push({ name: m, n: Number(w) });
        } else
          o.pseudos.push({ name: m, list: Ko(w).map(Vo) });
      } else {
        if (!ah.has(m)) throw new ze(`:${m} is not supported`);
        o.pseudos.push({ name: m });
      }
      c = !0;
      continue;
    }
    if (/[A-Za-z_\-\\]/.test(s) && !c) {
      const [d, p] = pi(n, i);
      o.tag = d.toLowerCase(), i = p, c = !0;
      continue;
    }
    break;
  }
  if (!c) throw new ze(`empty compound selector at ${i} in ${JSON.stringify(n)}`);
  return [o, i];
}
function Vo(n) {
  const i = [];
  let o = 0, c = null;
  for (n = n.trim(); o < n.length; ) {
    const [s, d] = lh(n, o);
    i.push({ compound: s, combinator: c }), o = d;
    let p = !1;
    for (; n[o] === " " || n[o] === `
` || n[o] === "	"; )
      o++, p = !0;
    if (o >= n.length) break;
    const m = n[o];
    if (m === ">")
      for (c = ">", o++; n[o] === " "; ) o++;
    else {
      if (m === "+" || m === "~") throw new ze(`the ${m} combinator is not supported`);
      if (p) c = " ";
      else throw new ze(`unexpected ${JSON.stringify(m)} in ${JSON.stringify(n)}`);
    }
  }
  if (!i.length) throw new ze("empty selector");
  return i;
}
const Ju = /* @__PURE__ */ new Map();
function Mi(n) {
  let i = Ju.get(n);
  return i || (i = Ko(n).map(Vo), Ju.set(n, i)), i;
}
function qd(n) {
  const i = [0, 0, 0], o = (c) => {
    i[0] += c[0], i[1] += c[1], i[2] += c[2];
  };
  for (const { compound: c } of n) {
    c.id && i[0]++, i[1] += c.classes.length + c.attrs.length, c.tag && c.tag !== "*" && i[2]++;
    for (const s of c.pseudos)
      if (s.name !== "where")
        if (s.list) {
          const d = s.list.map(qd).sort((p, m) => m[0] - p[0] || m[1] - p[1] || m[2] - p[2])[0];
          o(d);
        } else i[1]++;
  }
  return i;
}
function ih(n, { name: i, op: o, value: c }) {
  const s = n.getAttribute(i);
  if (s == null) return !1;
  if (o === null) return !0;
  switch (o) {
    case "=":
      return s === c;
    case "^=":
      return c !== "" && s.startsWith(c);
    case "$=":
      return c !== "" && s.endsWith(c);
    case "*=":
      return c !== "" && s.includes(c);
    case "~=":
      return s.split(/\s+/).includes(c);
    case "|=":
      return s === c || s.startsWith(`${c}-`);
    default:
      return !1;
  }
}
function hi(n) {
  return n.parentElement ? n.parentElement.children : [n];
}
function rh(n, i, o, c) {
  if (i.tag && i.tag !== "*" && n.tagName !== i.tag || i.id && n.getAttribute("id") !== i.id) return !1;
  if (i.classes.length) {
    const s = n.classList ?? [];
    for (const d of i.classes) if (!s.includes(d)) return !1;
  }
  for (const s of i.attrs) if (!ih(n, s)) return !1;
  for (const s of i.pseudos)
    switch (s.name) {
      case "first-child":
        if (hi(n)[0] !== n) return !1;
        break;
      case "only-child":
        if (hi(n).length !== 1) return !1;
        break;
      case "last-child": {
        const d = hi(n);
        if (d[d.length - 1] !== n) return !1;
        break;
      }
      case "nth-child":
        if (hi(n).indexOf(n) !== s.n - 1) return !1;
        break;
      case "root":
        if (!n.isDocumentRoot) return !1;
        break;
      case "not":
        if (s.list.some((d) => An(n, d, o, c))) return !1;
        break;
      case "is":
      case "where":
        if (!s.list.some((d) => An(n, d, o, c))) return !1;
        break;
      default:
        if (!o.state || !o.state(n, s.name, c)) return !1;
    }
  return !0;
}
function An(n, i, o, c = !0) {
  const s = (d, p, m) => {
    const { compound: x, combinator: w } = i[p];
    if (!rh(d, x, o, m)) return !1;
    if (p === 0) return !0;
    if (w === ">") return !!d.parentElement && s(d.parentElement, p - 1, !1);
    for (let M = d.parentElement; M; M = M.parentElement) if (s(M, p - 1, !1)) return !0;
    return !1;
  };
  return s(n, i.length - 1, c);
}
function oh(n, i, o = {}) {
  return (typeof i == "string" ? Mi(i) : i).some((s) => An(n, s, o));
}
function Yd(n, i, o = {}) {
  return An(n, i, o);
}
function fl(n, i, o = {}) {
  const c = Mi(i), s = [], d = (p) => {
    for (const m of p.children)
      c.some((x) => An(m, x, o)) && s.push(m), d(m);
  };
  return d(n), s;
}
function Gd(n, i, o = {}) {
  const c = Mi(i);
  for (let s = n; s; s = s.parentElement) if (c.some((d) => An(s, d, o))) return s;
  return null;
}
//! The DOM, as much of it as a stock screen's source touches (the web reference's findings, section 9) and no more.
//! The renderer's host instances are `HostElement`s, so a `ref`, `event.currentTarget` and `event.target` are these
//! objects: `closest`, `contains`, `parentElement`, `children`, `dataset`, `getAttribute`, `getBoundingClientRect`.
//! `document` (with `body`, the portal target) and `window` keep listeners for the capture and bubble phases the
//! source registers; `localStorage`, timers, `window.location` and `navigator.clipboard` go to the `perch` host.
//!
//! `installGlobals(perch)` puts `window`, `document`, `localStorage`, `HTMLElement`, `DOMRect` and (where the engine
//! has none) `setTimeout`/`clearTimeout`/`queueMicrotask` on `globalThis`, so a module that names them as globals
//! runs unchanged. `window`, `document` and `localStorage` read the record at `globalThis[GLOBALS]`, which each
//! mount sets to its own and a host running several screens in one script context sets to the running screen's.
let sh = 1;
class Co {
  constructor(i = 0, o = 0, c = 0, s = 0) {
    this.x = i, this.y = o, this.width = c, this.height = s;
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
class Xo {
  constructor() {
    this.listeners = [];
  }
  addEventListener(i, o, c) {
    const s = c === !0 || !!c?.capture;
    this.listeners.some((d) => d.type === i && d.listener === o && d.capture === s) || this.listeners.push({ type: i, listener: o, capture: s });
  }
  removeEventListener(i, o, c) {
    const s = c === !0 || !!c?.capture;
    this.listeners = this.listeners.filter((d) => !(d.type === i && d.listener === o && d.capture === s));
  }
}
class Ai {
  constructor(i) {
    this.nodeType = 3, this.data = String(i), this.parentNode = null, this.hidden = !1;
  }
  get parentElement() {
    return this.parentNode;
  }
  get textContent() {
    return this.data;
  }
}
class re extends Xo {
  constructor(i, o = {}, c = null) {
    super(), this.nodeType = 1, this.id = `n${sh++}`, this.tagName = i.toLowerCase(), this.props = o, this.childNodes = [], this.parentNode = null, this.ownerDocument = c, this.hidden = !1, this.state = { hover: !1, focus: !1, active: !1 }, this.bounds = null, this.version = 0;
  }
  touch() {
    this.version++;
  }
  get nodeName() {
    return this.tagName.toUpperCase();
  }
  get parentElement() {
    return this.parentNode instanceof re ? this.parentNode : null;
  }
  get children() {
    return this.childNodes.filter((i) => i instanceof re);
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
    const i = this.className;
    return this.classCache?.name !== i && (this.classCache = { name: i, list: i.split(/\s+/).filter(Boolean) }), this.classCache.list;
  }
  get textContent() {
    return this.childNodes.map((i) => i.textContent).join("");
  }
  get dataset() {
    const i = {};
    for (const [o, c] of Object.entries(this.props))
      o.startsWith("data-") && c != null && c !== !1 && (i[o.slice(5).replace(/-([a-z])/g, (s, d) => d.toUpperCase())] = String(c));
    return i;
  }
  /** The DOM attribute React would write for `name`, or null. */
  getAttribute(i) {
    const o = this.props;
    if (i === "class") return this.className || null;
    if (i === "id") return o.id != null ? String(o.id) : null;
    if (i === "style") return null;
    let s = o[i === "for" ? "htmlFor" : i === "tabindex" ? "tabIndex" : i];
    if (s === void 0 && !i.includes("-")) {
      const d = i.replace(/-([a-z])/g, (p, m) => m.toUpperCase());
      s = o[d];
    }
    return s == null || typeof s == "function" ? null : typeof s == "boolean" ? i.startsWith("aria-") || i.startsWith("data-") ? String(s) : s ? "" : null : String(s);
  }
  hasAttribute(i) {
    return this.getAttribute(i) !== null;
  }
  appendChild(i) {
    return i.parentNode && i.parentNode.removeChild(i), i.parentNode = this, this.childNodes.push(i), this.touch(), i;
  }
  insertBefore(i, o) {
    i.parentNode && i.parentNode.removeChild(i);
    const c = this.childNodes.indexOf(o);
    return i.parentNode = this, c < 0 ? this.childNodes.push(i) : this.childNodes.splice(c, 0, i), this.touch(), i;
  }
  removeChild(i) {
    const o = this.childNodes.indexOf(i);
    return o >= 0 && this.childNodes.splice(o, 1), i.parentNode = null, this.touch(), i;
  }
  contains(i) {
    for (let o = i; o; o = o.parentNode) if (o === this) return !0;
    return !1;
  }
  matches(i) {
    return oh(this, i);
  }
  closest(i) {
    return Gd(this, i);
  }
  querySelectorAll(i) {
    return fl(this, i);
  }
  querySelector(i) {
    return fl(this, i)[0] ?? null;
  }
  /** The engine's last box for this element; a zero box at the origin before it has been laid out. */
  getBoundingClientRect() {
    const i = this.ownerDocument?.perch?.bounds?.(this.id) ?? this.ownerDocument?.itemBounds?.(this.id) ?? this.bounds;
    return i ? new Co(i.x, i.y, i.width, i.height) : new Co();
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
  set value(i) {
    this.edit = String(i);
  }
  /** A box's tick: what a click just made it (`ticked`, during the change event it causes), else its props'. */
  get checked() {
    return this.ticked ?? !!(this.props.checked ?? this.props.defaultChecked);
  }
  set checked(i) {
    this.ticked = !!i;
  }
  /** Selection in a field: the caret stays at the end of its text, and the one selection kept is all of it
   * (`selectedAll`: the next character typed replaces the text). */
  select() {
    this.selectedAll = !0;
  }
  setSelectionRange(i, o) {
    this.selectedAll = i === 0 && o >= this.value.length && o > 0;
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
    const i = this, o = (p) => String(p).startsWith("--") ? String(p) : String(p).replace(/-([a-z])/g, (m, x) => x.toUpperCase()), c = (p) => {
      const m = i.props.style?.[p];
      return m == null || typeof m == "boolean" ? "" : typeof m == "number" && m !== 0 ? `${m}px` : String(m);
    }, s = (p) => i.inline && p in i.inline ? i.inline[p] : c(p), d = (p, m) => {
      const x = m == null ? "" : String(m);
      s(p) !== x && (i.inline ??= {}, x === c(p) ? delete i.inline[p] : i.inline[p] = x, i.touch(), i.ownerDocument?.restyled());
    };
    return this.styleView = new Proxy({}, {
      get: (p, m) => {
        if (typeof m == "string")
          return m === "setProperty" ? (x, w) => d(o(x), w) : m === "removeProperty" ? (x) => {
            const w = s(o(x));
            return d(o(x), ""), w;
          } : m === "getPropertyValue" ? (x) => s(o(x)) : s(m);
      },
      set: (p, m, x) => (typeof m == "string" && d(m, x), !0)
    }), this.styleView;
  }
  /** What the cascade reads as this element's inline style: its props' `style` under what was written to `style`. */
  get inlineStyle() {
    return this.inline ? { ...this.props.style, ...this.inline } : this.props.style;
  }
  /** This element and what is in it, as this shim's own markup (`markup`), which `dangerouslySetInnerHTML` takes. */
  get outerHTML() {
    return Lu(this);
  }
  /** `outerHTML` without the attributes named in `omit` (by their DOM names), as the web's drag strips its copy. */
  copyMarkup(i = []) {
    return Lu(this, i);
  }
}
const jo = "perch-dom:", ch = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]), uh = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
function Lu(n, i = []) {
  const o = new Set(i.map((s) => uh[s] ?? s)), c = (s) => {
    if (!(s instanceof re)) return { x: s.data, ...s.hidden ? { h: 1 } : {} };
    const d = {};
    for (const [p, m] of Object.entries(s.props))
      ch.has(p) || o.has(p) || m == null || typeof m == "function" || typeof m == "symbol" || (d[p] = m);
    return { t: s.tagName, p: d, c: s.childNodes.map(c), ...s.hidden ? { h: 1 } : {} };
  };
  return jo + JSON.stringify(c(n));
}
function dh(n, i) {
  if (typeof n != "string" || !n.startsWith(jo)) return null;
  let o;
  try {
    o = JSON.parse(n.slice(jo.length));
  } catch {
    return null;
  }
  const c = (d) => !!d && typeof d == "object" && !Array.isArray(d), s = (d) => {
    if (!c(d)) throw new Error("not a node");
    let p;
    if (typeof d.x == "string") p = new Ai(d.x);
    else {
      if (typeof d.t != "string" || !/^[a-z][a-z0-9-]*$/i.test(d.t) || !c(d.p) || !Array.isArray(d.c)) throw new Error("not an element");
      p = new re(d.t, d.p, i);
      for (const m of d.c) p.appendChild(s(m));
    }
    return p.hidden = d.h === 1, p;
  };
  try {
    return [s(o)];
  } catch {
    return null;
  }
}
class mh {
  observe() {
  }
  unobserve() {
  }
  disconnect() {
  }
}
class fh {
  constructor(i = {}) {
    this.map = new Map(Object.entries(i));
  }
  get length() {
    return this.map.size;
  }
  key(i) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(i) {
    return this.map.has(i) ? this.map.get(i) : null;
  }
  setItem(i, o) {
    this.map.set(i, String(o));
  }
  removeItem(i) {
    this.map.delete(i);
  }
  clear() {
    this.map.clear();
  }
}
function Wu(n) {
  for (let i = n; i instanceof re; i = i.parentElement) i.touch();
}
class ph extends Xo {
  constructor(i) {
    super(), this.perch = i, this.documentElement = new re("html", {}, this), this.body = new re("body", {}, this), this.documentElement.appendChild(this.body), this.activeElement = this.body;
  }
  createElement(i) {
    return new re(i, {}, this);
  }
  /** An element's `style` was written: the tree is described again once the writing script is done. */
  restyled() {
    this.restyling || (this.restyling = !0, queueMicrotask(() => {
      this.restyling = !1, this.afterCommit?.();
    }));
  }
  focus(i) {
    this.activeElement && this.activeElement !== i && this.blur(this.activeElement), this.activeElement = i, i.state.focus = !0, i.state.pointerFocus = !1, Wu(i), this.perch?.focused?.(i);
  }
  blur(i) {
    i.state.focus = !1, Wu(i), this.activeElement === i && (this.activeElement = this.body);
  }
  querySelectorAll(i) {
    return fl(this.documentElement, i);
  }
  querySelector(i) {
    return this.querySelectorAll(i)[0] ?? null;
  }
  /** The element whose `id` prop is `id` (React's `useId` ids are not selectors). */
  getElementById(i) {
    return fl(this.documentElement, "*").find((o) => o.props?.id === i) ?? null;
  }
}
class hh extends Xo {
  constructor(i, o) {
    super(), this.perch = i, this.document = o, this.location = { get hostname() {
      return i.hostname ?? "localhost";
    } };
  }
  get innerWidth() {
    return this.perch.viewport?.().width ?? 1e3;
  }
  get innerHeight() {
    return this.perch.viewport?.().height ?? 800;
  }
  setTimeout(i, o, ...c) {
    return globalThis.setTimeout(i, o, ...c);
  }
  clearTimeout(i) {
    return globalThis.clearTimeout(i);
  }
}
function Qd(n) {
  return {
    setTimeout: (i, o = 0, ...c) => n.setTimeout(() => i(...c), Math.max(0, Number(o) || 0)),
    clearTimeout: (i) => {
      i != null && n.clearTimeout(i);
    }
  };
}
const Fu = Symbol.for("perch.react.globals");
function qe(n, i, o) {
  Object.defineProperty(n, i, { value: o, configurable: !0, writable: !0, enumerable: !1 });
}
function gh(n, i = globalThis) {
  const o = new ph(n), c = new hh(n, o);
  o.defaultView = c;
  const s = n.storage ?? new fh();
  if (typeof i.setTimeout != "function") {
    if (typeof n.setTimeout != "function") throw new Error("the engine has no setTimeout and the perch host gives none (perch.setTimeout)");
    const m = Qd(n);
    qe(i, "setTimeout", m.setTimeout), qe(i, "clearTimeout", m.clearTimeout);
  }
  typeof i.queueMicrotask != "function" && qe(i, "queueMicrotask", (m) => {
    Promise.resolve().then(m);
  }), qe(i, "requestAnimationFrame", (m) => i.setTimeout(() => m(Date.now()), 0)), qe(i, "cancelAnimationFrame", (m) => i.clearTimeout(m));
  const d = { document: o, window: c, localStorage: s };
  for (const m of Object.keys(d))
    Object.defineProperty(i, m, { get: () => i[Fu]?.[m], configurable: !0, enumerable: !1 });
  i[Fu] = d, qe(i, "HTMLElement", re), qe(i, "Element", re), qe(i, "DOMRect", Co), typeof i.ResizeObserver != "function" && qe(i, "ResizeObserver", mh);
  const p = i.navigator && typeof i.navigator == "object" ? i.navigator : {};
  if (!p.clipboard && n.clipboard)
    try {
      qe(p, "clipboard", n.clipboard);
    } catch {
    }
  return i.navigator || qe(i, "navigator", p), { document: o, window: c, globals: d };
}
function Mo(n, i = !1) {
  if (!(i ? n?.tagName === "input" && Kd(n) : n?.tagName === "button" && !/^(button|reset)$/.test(String(n.props.type ?? "submit")) && !n.props.disabled)) return null;
  for (let c = n.parentElement; c; c = c.parentElement) if (c.tagName === "form") return c;
  return null;
}
const Kd = (n) => n?.tagName === "textarea" || n?.tagName === "input" && /^(text|search|url|email|tel|password|number|)$/.test(String(n.props.type ?? ""));
//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
const Iu = globalThis.perch;
if (typeof globalThis.setTimeout != "function" && typeof Iu?.setTimeout == "function") {
  const n = Qd(Iu);
  globalThis.setTimeout = n.setTimeout, globalThis.clearTimeout = n.clearTimeout;
}
typeof globalThis.queueMicrotask != "function" && (globalThis.queueMicrotask = (n) => {
  Promise.resolve().then(n);
});
function Zo(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
var xo = { exports: {} }, ct = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var $u;
function bh() {
  if ($u) return ct;
  $u = 1;
  var n = Symbol.for("react.transitional.element"), i = Symbol.for("react.portal"), o = Symbol.for("react.fragment"), c = Symbol.for("react.strict_mode"), s = Symbol.for("react.profiler"), d = Symbol.for("react.consumer"), p = Symbol.for("react.context"), m = Symbol.for("react.forward_ref"), x = Symbol.for("react.suspense"), w = Symbol.for("react.memo"), M = Symbol.for("react.lazy"), D = Symbol.for("react.activity"), k = Symbol.iterator;
  function g(v) {
    return v === null || typeof v != "object" ? null : (v = k && v[k] || v["@@iterator"], typeof v == "function" ? v : null);
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
  }, _ = Object.assign, z = {};
  function Y(v, q, tt) {
    this.props = v, this.context = q, this.refs = z, this.updater = tt || S;
  }
  Y.prototype.isReactComponent = {}, Y.prototype.setState = function(v, q) {
    if (typeof v != "object" && typeof v != "function" && v != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, v, q, "setState");
  }, Y.prototype.forceUpdate = function(v) {
    this.updater.enqueueForceUpdate(this, v, "forceUpdate");
  };
  function E() {
  }
  E.prototype = Y.prototype;
  function N(v, q, tt) {
    this.props = v, this.context = q, this.refs = z, this.updater = tt || S;
  }
  var A = N.prototype = new E();
  A.constructor = N, _(A, Y.prototype), A.isPureReactComponent = !0;
  var H = Array.isArray;
  function C() {
  }
  var b = { H: null, A: null, T: null, S: null }, h = Object.prototype.hasOwnProperty;
  function G(v, q, tt) {
    var $ = tt.ref;
    return {
      $$typeof: n,
      type: v,
      key: q,
      ref: $ !== void 0 ? $ : null,
      props: tt
    };
  }
  function J(v, q) {
    return G(v.type, q, v.props);
  }
  function at(v) {
    return typeof v == "object" && v !== null && v.$$typeof === n;
  }
  function ot(v) {
    var q = { "=": "=0", ":": "=2" };
    return "$" + v.replace(/[=:]/g, function(tt) {
      return q[tt];
    });
  }
  var Mt = /\/+/g;
  function Kt(v, q) {
    return typeof v == "object" && v !== null && v.key != null ? ot("" + v.key) : q.toString(36);
  }
  function Nt(v) {
    switch (v.status) {
      case "fulfilled":
        return v.value;
      case "rejected":
        throw v.reason;
      default:
        switch (typeof v.status == "string" ? v.then(C, C) : (v.status = "pending", v.then(
          function(q) {
            v.status === "pending" && (v.status = "fulfilled", v.value = q);
          },
          function(q) {
            v.status === "pending" && (v.status = "rejected", v.reason = q);
          }
        )), v.status) {
          case "fulfilled":
            return v.value;
          case "rejected":
            throw v.reason;
        }
    }
    throw v;
  }
  function K(v, q, tt, $, P) {
    var lt = typeof v;
    (lt === "undefined" || lt === "boolean") && (v = null);
    var xt = !1;
    if (v === null) xt = !0;
    else
      switch (lt) {
        case "bigint":
        case "string":
        case "number":
          xt = !0;
          break;
        case "object":
          switch (v.$$typeof) {
            case n:
            case i:
              xt = !0;
              break;
            case M:
              return xt = v._init, K(
                xt(v._payload),
                q,
                tt,
                $,
                P
              );
          }
      }
    if (xt)
      return P = P(v), xt = $ === "" ? "." + Kt(v, 0) : $, H(P) ? (tt = "", xt != null && (tt = xt.replace(Mt, "$&/") + "/"), K(P, q, tt, "", function(Oa) {
        return Oa;
      })) : P != null && (at(P) && (P = J(
        P,
        tt + (P.key == null || v && v.key === P.key ? "" : ("" + P.key).replace(
          Mt,
          "$&/"
        ) + "/") + xt
      )), q.push(P)), 1;
    xt = 0;
    var Jt = $ === "" ? "." : $ + ":";
    if (H(v))
      for (var ut = 0; ut < v.length; ut++)
        $ = v[ut], lt = Jt + Kt($, ut), xt += K(
          $,
          q,
          tt,
          lt,
          P
        );
    else if (ut = g(v), typeof ut == "function")
      for (v = ut.call(v), ut = 0; !($ = v.next()).done; )
        $ = $.value, lt = Jt + Kt($, ut++), xt += K(
          $,
          q,
          tt,
          lt,
          P
        );
    else if (lt === "object") {
      if (typeof v.then == "function")
        return K(
          Nt(v),
          q,
          tt,
          $,
          P
        );
      throw q = String(v), Error(
        "Objects are not valid as a React child (found: " + (q === "[object Object]" ? "object with keys {" + Object.keys(v).join(", ") + "}" : q) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return xt;
  }
  function et(v, q, tt) {
    if (v == null) return v;
    var $ = [], P = 0;
    return K(v, $, "", "", function(lt) {
      return q.call(tt, lt, P++);
    }), $;
  }
  function nt(v) {
    if (v._status === -1) {
      var q = v._result;
      q = q(), q.then(
        function(tt) {
          (v._status === 0 || v._status === -1) && (v._status = 1, v._result = tt);
        },
        function(tt) {
          (v._status === 0 || v._status === -1) && (v._status = 2, v._result = tt);
        }
      ), v._status === -1 && (v._status = 0, v._result = q);
    }
    if (v._status === 1) return v._result.default;
    throw v._result;
  }
  var U = typeof reportError == "function" ? reportError : function(v) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var q = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof v == "object" && v !== null && typeof v.message == "string" ? String(v.message) : String(v),
        error: v
      });
      if (!window.dispatchEvent(q)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", v);
      return;
    }
    console.error(v);
  }, B = {
    map: et,
    forEach: function(v, q, tt) {
      et(
        v,
        function() {
          q.apply(this, arguments);
        },
        tt
      );
    },
    count: function(v) {
      var q = 0;
      return et(v, function() {
        q++;
      }), q;
    },
    toArray: function(v) {
      return et(v, function(q) {
        return q;
      }) || [];
    },
    only: function(v) {
      if (!at(v))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return v;
    }
  };
  return ct.Activity = D, ct.Children = B, ct.Component = Y, ct.Fragment = o, ct.Profiler = s, ct.PureComponent = N, ct.StrictMode = c, ct.Suspense = x, ct.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = b, ct.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(v) {
      return b.H.useMemoCache(v);
    }
  }, ct.cache = function(v) {
    return function() {
      return v.apply(null, arguments);
    };
  }, ct.cacheSignal = function() {
    return null;
  }, ct.cloneElement = function(v, q, tt) {
    if (v == null)
      throw Error(
        "The argument must be a React element, but you passed " + v + "."
      );
    var $ = _({}, v.props), P = v.key;
    if (q != null)
      for (lt in q.key !== void 0 && (P = "" + q.key), q)
        !h.call(q, lt) || lt === "key" || lt === "__self" || lt === "__source" || lt === "ref" && q.ref === void 0 || ($[lt] = q[lt]);
    var lt = arguments.length - 2;
    if (lt === 1) $.children = tt;
    else if (1 < lt) {
      for (var xt = Array(lt), Jt = 0; Jt < lt; Jt++)
        xt[Jt] = arguments[Jt + 2];
      $.children = xt;
    }
    return G(v.type, P, $);
  }, ct.createContext = function(v) {
    return v = {
      $$typeof: p,
      _currentValue: v,
      _currentValue2: v,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, v.Provider = v, v.Consumer = {
      $$typeof: d,
      _context: v
    }, v;
  }, ct.createElement = function(v, q, tt) {
    var $, P = {}, lt = null;
    if (q != null)
      for ($ in q.key !== void 0 && (lt = "" + q.key), q)
        h.call(q, $) && $ !== "key" && $ !== "__self" && $ !== "__source" && (P[$] = q[$]);
    var xt = arguments.length - 2;
    if (xt === 1) P.children = tt;
    else if (1 < xt) {
      for (var Jt = Array(xt), ut = 0; ut < xt; ut++)
        Jt[ut] = arguments[ut + 2];
      P.children = Jt;
    }
    if (v && v.defaultProps)
      for ($ in xt = v.defaultProps, xt)
        P[$] === void 0 && (P[$] = xt[$]);
    return G(v, lt, P);
  }, ct.createRef = function() {
    return { current: null };
  }, ct.forwardRef = function(v) {
    return { $$typeof: m, render: v };
  }, ct.isValidElement = at, ct.lazy = function(v) {
    return {
      $$typeof: M,
      _payload: { _status: -1, _result: v },
      _init: nt
    };
  }, ct.memo = function(v, q) {
    return {
      $$typeof: w,
      type: v,
      compare: q === void 0 ? null : q
    };
  }, ct.startTransition = function(v) {
    var q = b.T, tt = {};
    b.T = tt;
    try {
      var $ = v(), P = b.S;
      P !== null && P(tt, $), typeof $ == "object" && $ !== null && typeof $.then == "function" && $.then(C, U);
    } catch (lt) {
      U(lt);
    } finally {
      q !== null && tt.types !== null && (q.types = tt.types), b.T = q;
    }
  }, ct.unstable_useCacheRefresh = function() {
    return b.H.useCacheRefresh();
  }, ct.use = function(v) {
    return b.H.use(v);
  }, ct.useActionState = function(v, q, tt) {
    return b.H.useActionState(v, q, tt);
  }, ct.useCallback = function(v, q) {
    return b.H.useCallback(v, q);
  }, ct.useContext = function(v) {
    return b.H.useContext(v);
  }, ct.useDebugValue = function() {
  }, ct.useDeferredValue = function(v, q) {
    return b.H.useDeferredValue(v, q);
  }, ct.useEffect = function(v, q) {
    return b.H.useEffect(v, q);
  }, ct.useEffectEvent = function(v) {
    return b.H.useEffectEvent(v);
  }, ct.useId = function() {
    return b.H.useId();
  }, ct.useImperativeHandle = function(v, q, tt) {
    return b.H.useImperativeHandle(v, q, tt);
  }, ct.useInsertionEffect = function(v, q) {
    return b.H.useInsertionEffect(v, q);
  }, ct.useLayoutEffect = function(v, q) {
    return b.H.useLayoutEffect(v, q);
  }, ct.useMemo = function(v, q) {
    return b.H.useMemo(v, q);
  }, ct.useOptimistic = function(v, q) {
    return b.H.useOptimistic(v, q);
  }, ct.useReducer = function(v, q, tt) {
    return b.H.useReducer(v, q, tt);
  }, ct.useRef = function(v) {
    return b.H.useRef(v);
  }, ct.useState = function(v) {
    return b.H.useState(v);
  }, ct.useSyncExternalStore = function(v, q, tt) {
    return b.H.useSyncExternalStore(
      v,
      q,
      tt
    );
  }, ct.useTransition = function() {
    return b.H.useTransition();
  }, ct.version = "19.2.8", ct;
}
var Pu;
function Vd() {
  return Pu || (Pu = 1, xo.exports = bh()), xo.exports;
}
var ft = Vd();
const vh = /* @__PURE__ */ Zo(ft), mv = /* @__PURE__ */ Bd({
  __proto__: null,
  default: vh
}, [ft]);
var wo = { exports: {} }, ul = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var td;
function yh() {
  if (td) return ul;
  td = 1;
  var n = Symbol.for("react.transitional.element"), i = Symbol.for("react.fragment");
  function o(c, s, d) {
    var p = null;
    if (d !== void 0 && (p = "" + d), s.key !== void 0 && (p = "" + s.key), "key" in s) {
      d = {};
      for (var m in s)
        m !== "key" && (d[m] = s[m]);
    } else d = s;
    return s = d.ref, {
      $$typeof: n,
      type: c,
      key: p,
      ref: s !== void 0 ? s : null,
      props: d
    };
  }
  return ul.Fragment = i, ul.jsx = o, ul.jsxs = o, ul;
}
var ed;
function xh() {
  return ed || (ed = 1, wo.exports = yh()), wo.exports;
}
var zt = xh();
const wh = /* @__PURE__ */ Zo(zt), fv = /* @__PURE__ */ Bd({
  __proto__: null,
  default: wh
}, [zt]);
var _o = { exports: {} }, So = { exports: {} }, zo = { exports: {} }, ko = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var ad;
function _h() {
  return ad || (ad = 1, (function(n) {
    function i(K, et) {
      var nt = K.length;
      K.push(et);
      t: for (; 0 < nt; ) {
        var U = nt - 1 >>> 1, B = K[U];
        if (0 < s(B, et))
          K[U] = et, K[nt] = B, nt = U;
        else break t;
      }
    }
    function o(K) {
      return K.length === 0 ? null : K[0];
    }
    function c(K) {
      if (K.length === 0) return null;
      var et = K[0], nt = K.pop();
      if (nt !== et) {
        K[0] = nt;
        t: for (var U = 0, B = K.length, v = B >>> 1; U < v; ) {
          var q = 2 * (U + 1) - 1, tt = K[q], $ = q + 1, P = K[$];
          if (0 > s(tt, nt))
            $ < B && 0 > s(P, tt) ? (K[U] = P, K[$] = nt, U = $) : (K[U] = tt, K[q] = nt, U = q);
          else if ($ < B && 0 > s(P, nt))
            K[U] = P, K[$] = nt, U = $;
          else break t;
        }
      }
      return et;
    }
    function s(K, et) {
      var nt = K.sortIndex - et.sortIndex;
      return nt !== 0 ? nt : K.id - et.id;
    }
    if (n.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
      var d = performance;
      n.unstable_now = function() {
        return d.now();
      };
    } else {
      var p = Date, m = p.now();
      n.unstable_now = function() {
        return p.now() - m;
      };
    }
    var x = [], w = [], M = 1, D = null, k = 3, g = !1, S = !1, _ = !1, z = !1, Y = typeof setTimeout == "function" ? setTimeout : null, E = typeof clearTimeout == "function" ? clearTimeout : null, N = typeof setImmediate < "u" ? setImmediate : null;
    function A(K) {
      for (var et = o(w); et !== null; ) {
        if (et.callback === null) c(w);
        else if (et.startTime <= K)
          c(w), et.sortIndex = et.expirationTime, i(x, et);
        else break;
        et = o(w);
      }
    }
    function H(K) {
      if (_ = !1, A(K), !S)
        if (o(x) !== null)
          S = !0, C || (C = !0, ot());
        else {
          var et = o(w);
          et !== null && Nt(H, et.startTime - K);
        }
    }
    var C = !1, b = -1, h = 5, G = -1;
    function J() {
      return z ? !0 : !(n.unstable_now() - G < h);
    }
    function at() {
      if (z = !1, C) {
        var K = n.unstable_now();
        G = K;
        var et = !0;
        try {
          t: {
            S = !1, _ && (_ = !1, E(b), b = -1), g = !0;
            var nt = k;
            try {
              e: {
                for (A(K), D = o(x); D !== null && !(D.expirationTime > K && J()); ) {
                  var U = D.callback;
                  if (typeof U == "function") {
                    D.callback = null, k = D.priorityLevel;
                    var B = U(
                      D.expirationTime <= K
                    );
                    if (K = n.unstable_now(), typeof B == "function") {
                      D.callback = B, A(K), et = !0;
                      break e;
                    }
                    D === o(x) && c(x), A(K);
                  } else c(x);
                  D = o(x);
                }
                if (D !== null) et = !0;
                else {
                  var v = o(w);
                  v !== null && Nt(
                    H,
                    v.startTime - K
                  ), et = !1;
                }
              }
              break t;
            } finally {
              D = null, k = nt, g = !1;
            }
            et = void 0;
          }
        } finally {
          et ? ot() : C = !1;
        }
      }
    }
    var ot;
    if (typeof N == "function")
      ot = function() {
        N(at);
      };
    else if (typeof MessageChannel < "u") {
      var Mt = new MessageChannel(), Kt = Mt.port2;
      Mt.port1.onmessage = at, ot = function() {
        Kt.postMessage(null);
      };
    } else
      ot = function() {
        Y(at, 0);
      };
    function Nt(K, et) {
      b = Y(function() {
        K(n.unstable_now());
      }, et);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(K) {
      K.callback = null;
    }, n.unstable_forceFrameRate = function(K) {
      0 > K || 125 < K ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : h = 0 < K ? Math.floor(1e3 / K) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return k;
    }, n.unstable_next = function(K) {
      switch (k) {
        case 1:
        case 2:
        case 3:
          var et = 3;
          break;
        default:
          et = k;
      }
      var nt = k;
      k = et;
      try {
        return K();
      } finally {
        k = nt;
      }
    }, n.unstable_requestPaint = function() {
      z = !0;
    }, n.unstable_runWithPriority = function(K, et) {
      switch (K) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          K = 3;
      }
      var nt = k;
      k = K;
      try {
        return et();
      } finally {
        k = nt;
      }
    }, n.unstable_scheduleCallback = function(K, et, nt) {
      var U = n.unstable_now();
      switch (typeof nt == "object" && nt !== null ? (nt = nt.delay, nt = typeof nt == "number" && 0 < nt ? U + nt : U) : nt = U, K) {
        case 1:
          var B = -1;
          break;
        case 2:
          B = 250;
          break;
        case 5:
          B = 1073741823;
          break;
        case 4:
          B = 1e4;
          break;
        default:
          B = 5e3;
      }
      return B = nt + B, K = {
        id: M++,
        callback: et,
        priorityLevel: K,
        startTime: nt,
        expirationTime: B,
        sortIndex: -1
      }, nt > U ? (K.sortIndex = nt, i(w, K), o(x) === null && K === o(w) && (_ ? (E(b), b = -1) : _ = !0, Nt(H, nt - U))) : (K.sortIndex = B, i(x, K), S || g || (S = !0, C || (C = !0, ot()))), K;
    }, n.unstable_shouldYield = J, n.unstable_wrapCallback = function(K) {
      var et = k;
      return function() {
        var nt = k;
        k = et;
        try {
          return K.apply(this, arguments);
        } finally {
          k = nt;
        }
      };
    };
  })(ko)), ko;
}
var nd;
function Sh() {
  return nd || (nd = 1, zo.exports = _h()), zo.exports;
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
var ld;
function zh() {
  return ld || (ld = 1, (function(n) {
    n.exports = function(i) {
      function o(t, e, a, l) {
        return new lf(t, e, a, l);
      }
      function c() {
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
      function p(t) {
        if (d(t) !== t)
          throw Error(s(188));
      }
      function m(t) {
        var e = t.alternate;
        if (!e) {
          if (e = d(t), e === null) throw Error(s(188));
          return e !== t ? null : t;
        }
        for (var a = t, l = e; ; ) {
          var r = a.return;
          if (r === null) break;
          var u = r.alternate;
          if (u === null) {
            if (l = r.return, l !== null) {
              a = l;
              continue;
            }
            break;
          }
          if (r.child === u.child) {
            for (u = r.child; u; ) {
              if (u === a) return p(r), t;
              if (u === l) return p(r), e;
              u = u.sibling;
            }
            throw Error(s(188));
          }
          if (a.return !== l.return) a = r, l = u;
          else {
            for (var f = !1, y = r.child; y; ) {
              if (y === a) {
                f = !0, a = r, l = u;
                break;
              }
              if (y === l) {
                f = !0, l = r, a = u;
                break;
              }
              y = y.sibling;
            }
            if (!f) {
              for (y = u.child; y; ) {
                if (y === a) {
                  f = !0, a = u, l = r;
                  break;
                }
                if (y === l) {
                  f = !0, l = u, a = r;
                  break;
                }
                y = y.sibling;
              }
              if (!f) throw Error(s(189));
            }
          }
          if (a.alternate !== l) throw Error(s(190));
        }
        if (a.tag !== 3) throw Error(s(188));
        return a.stateNode.current === a ? t : e;
      }
      function x(t) {
        var e = t.tag;
        if (e === 5 || e === 26 || e === 27 || e === 6) return t;
        for (t = t.child; t !== null; ) {
          if (e = x(t), e !== null) return e;
          t = t.sibling;
        }
        return null;
      }
      function w(t) {
        var e = t.tag;
        if (e === 5 || e === 26 || e === 27 || e === 6) return t;
        for (t = t.child; t !== null; ) {
          if (t.tag !== 4 && (e = w(t), e !== null))
            return e;
          t = t.sibling;
        }
        return null;
      }
      function M(t) {
        return t === null || typeof t != "object" ? null : (t = mu && t[mu] || t["@@iterator"], typeof t == "function" ? t : null);
      }
      function D(t) {
        if (t == null) return null;
        if (typeof t == "function")
          return t.$$typeof === uf ? null : t.displayName || t.name || null;
        if (typeof t == "string") return t;
        switch (t) {
          case dn:
            return "Fragment";
          case qr:
            return "Profiler";
          case uu:
            return "StrictMode";
          case Gr:
            return "Suspense";
          case Qr:
            return "SuspenseList";
          case Vr:
            return "Activity";
        }
        if (typeof t == "object")
          switch (t.$$typeof) {
            case un:
              return "Portal";
            case va:
              return t.displayName || "Context";
            case du:
              return (t._context.displayName || "Context") + ".Consumer";
            case Yr:
              var e = t.render;
              return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
            case Kr:
              return e = t.displayName || null, e !== null ? e : D(t.type) || "Memo";
            case ya:
              e = t._payload, t = t._init;
              try {
                return D(t(e));
              } catch {
              }
          }
        return null;
      }
      function k(t) {
        return { current: t };
      }
      function g(t) {
        0 > pn || (t.current = Fr[pn], Fr[pn] = null, pn--);
      }
      function S(t, e) {
        pn++, Fr[pn] = t.current, t.current = e;
      }
      function _(t) {
        return t >>>= 0, t === 0 ? 32 : 31 - (Bp(t) / qp | 0) | 0;
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
      function Y(t, e, a) {
        var l = t.pendingLanes;
        if (l === 0) return 0;
        var r = 0, u = t.suspendedLanes, f = t.pingedLanes;
        t = t.warmLanes;
        var y = l & 134217727;
        return y !== 0 ? (l = y & ~u, l !== 0 ? r = z(l) : (f &= y, f !== 0 ? r = z(f) : a || (a = y & ~t, a !== 0 && (r = z(a))))) : (y = l & ~u, y !== 0 ? r = z(y) : f !== 0 ? r = z(f) : a || (a = l & ~t, a !== 0 && (r = z(a)))), r === 0 ? 0 : e !== 0 && e !== r && (e & u) === 0 && (u = r & -r, a = e & -e, u >= a || u === 32 && (a & 4194048) !== 0) ? e : r;
      }
      function E(t, e) {
        return (t.pendingLanes & ~(t.suspendedLanes & ~t.pingedLanes) & e) === 0;
      }
      function N(t, e) {
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
      function A() {
        var t = Wl;
        return Wl <<= 1, (Wl & 62914560) === 0 && (Wl = 4194304), t;
      }
      function H(t) {
        for (var e = [], a = 0; 31 > a; a++) e.push(t);
        return e;
      }
      function C(t, e) {
        t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
      }
      function b(t, e, a, l, r, u) {
        var f = t.pendingLanes;
        t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
        var y = t.entanglements, R = t.expirationTimes, Q = t.hiddenUpdates;
        for (a = f & ~a; 0 < a; ) {
          var Z = 31 - be(a), V = 1 << Z;
          y[Z] = 0, R[Z] = -1;
          var L = Q[Z];
          if (L !== null)
            for (Q[Z] = null, Z = 0; Z < L.length; Z++) {
              var dt = L[Z];
              dt !== null && (dt.lane &= -536870913);
            }
          a &= ~V;
        }
        l !== 0 && h(t, l, 0), u !== 0 && r === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(f & ~e));
      }
      function h(t, e, a) {
        t.pendingLanes |= e, t.suspendedLanes &= ~e;
        var l = 31 - be(e);
        t.entangledLanes |= e, t.entanglements[l] = t.entanglements[l] | 1073741824 | a & 261930;
      }
      function G(t, e) {
        var a = t.entangledLanes |= e;
        for (t = t.entanglements; a; ) {
          var l = 31 - be(a), r = 1 << l;
          r & e | t[l] & e && (t[l] |= e), a &= ~r;
        }
      }
      function J(t, e) {
        var a = e & -e;
        return a = (a & 42) !== 0 ? 1 : at(a), (a & (t.suspendedLanes | e)) !== 0 ? 0 : a;
      }
      function at(t) {
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
      function ot(t) {
        return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function Mt(t) {
        if (typeof Vp == "function" && Xp(t), ve && typeof ve.setStrictMode == "function")
          try {
            ve.setStrictMode($n, t);
          } catch {
          }
      }
      function Kt(t, e) {
        return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
      }
      function Nt(t) {
        if (Pr === void 0)
          try {
            throw Error();
          } catch (a) {
            var e = a.stack.trim().match(/\n( *(at )?)/);
            Pr = e && e[1] || "", Bu = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
          }
        return `
` + Pr + t + Bu;
      }
      function K(t, e) {
        if (!t || to) return "";
        to = !0;
        var a = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var l = {
            DetermineComponentFrameRoot: function() {
              try {
                if (e) {
                  var V = function() {
                    throw Error();
                  };
                  if (Object.defineProperty(V.prototype, "props", {
                    set: function() {
                      throw Error();
                    }
                  }), typeof Reflect == "object" && Reflect.construct) {
                    try {
                      Reflect.construct(V, []);
                    } catch (dt) {
                      var L = dt;
                    }
                    Reflect.construct(t, [], V);
                  } else {
                    try {
                      V.call();
                    } catch (dt) {
                      L = dt;
                    }
                    t.call(V.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (dt) {
                    L = dt;
                  }
                  (V = t()) && typeof V.catch == "function" && V.catch(function() {
                  });
                }
              } catch (dt) {
                if (dt && L && typeof dt.stack == "string")
                  return [dt.stack, L.stack];
              }
              return [null, null];
            }
          };
          l.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
          var r = Object.getOwnPropertyDescriptor(
            l.DetermineComponentFrameRoot,
            "name"
          );
          r && r.configurable && Object.defineProperty(
            l.DetermineComponentFrameRoot,
            "name",
            { value: "DetermineComponentFrameRoot" }
          );
          var u = l.DetermineComponentFrameRoot(), f = u[0], y = u[1];
          if (f && y) {
            var R = f.split(`
`), Q = y.split(`
`);
            for (r = l = 0; l < R.length && !R[l].includes("DetermineComponentFrameRoot"); )
              l++;
            for (; r < Q.length && !Q[r].includes(
              "DetermineComponentFrameRoot"
            ); )
              r++;
            if (l === R.length || r === Q.length)
              for (l = R.length - 1, r = Q.length - 1; 1 <= l && 0 <= r && R[l] !== Q[r]; )
                r--;
            for (; 1 <= l && 0 <= r; l--, r--)
              if (R[l] !== Q[r]) {
                if (l !== 1 || r !== 1)
                  do
                    if (l--, r--, 0 > r || R[l] !== Q[r]) {
                      var Z = `
` + R[l].replace(" at new ", " at ");
                      return t.displayName && Z.includes("<anonymous>") && (Z = Z.replace("<anonymous>", t.displayName)), Z;
                    }
                  while (1 <= l && 0 <= r);
                break;
              }
          }
        } finally {
          to = !1, Error.prepareStackTrace = a;
        }
        return (a = t ? t.displayName || t.name : "") ? Nt(a) : "";
      }
      function et(t, e) {
        switch (t.tag) {
          case 26:
          case 27:
          case 5:
            return Nt(t.type);
          case 16:
            return Nt("Lazy");
          case 13:
            return t.child !== e && e !== null ? Nt("Suspense Fallback") : Nt("Suspense");
          case 19:
            return Nt("SuspenseList");
          case 0:
          case 15:
            return K(t.type, !1);
          case 11:
            return K(t.type.render, !1);
          case 1:
            return K(t.type, !0);
          case 31:
            return Nt("Activity");
          default:
            return "";
        }
      }
      function nt(t) {
        try {
          var e = "", a = null;
          do
            e += et(t, a), a = t, t = t.return;
          while (t);
          return e;
        } catch (l) {
          return `
Error generating stack: ` + l.message + `
` + l.stack;
        }
      }
      function U(t, e) {
        if (typeof t == "object" && t !== null) {
          var a = qu.get(t);
          return a !== void 0 ? a : (e = {
            value: t,
            source: e,
            stack: nt(e)
          }, qu.set(t, e), e);
        }
        return {
          value: t,
          source: e,
          stack: nt(e)
        };
      }
      function B(t, e) {
        gn[bn++] = Pn, gn[bn++] = Il, Il = t, Pn = e;
      }
      function v(t, e, a) {
        ke[Ee++] = Ve, ke[Ee++] = Xe, ke[Ee++] = xa, xa = t;
        var l = Ve;
        t = Xe;
        var r = 32 - be(l) - 1;
        l &= ~(1 << r), a += 1;
        var u = 32 - be(e) + r;
        if (30 < u) {
          var f = r - r % 5;
          u = (l & (1 << f) - 1).toString(32), l >>= f, r -= f, Ve = 1 << 32 - be(e) + r | a << r | l, Xe = u + t;
        } else
          Ve = 1 << u | a << r | l, Xe = t;
      }
      function q(t) {
        t.return !== null && (B(t, 1), v(t, 1, 0));
      }
      function tt(t) {
        for (; t === Il; )
          Il = gn[--bn], gn[bn] = null, Pn = gn[--bn], gn[bn] = null;
        for (; t === xa; )
          xa = ke[--Ee], ke[Ee] = null, Xe = ke[--Ee], ke[Ee] = null, Ve = ke[--Ee], ke[Ee] = null;
      }
      function $(t, e) {
        ke[Ee++] = Ve, ke[Ee++] = Xe, ke[Ee++] = xa, Ve = e.id, Xe = e.overflow, xa = t;
      }
      function P(t, e) {
        S(wa, e), S(tl, t), S(Pt, null), t = ff(e), g(Pt), S(Pt, t);
      }
      function lt() {
        g(Pt), g(tl), g(wa);
      }
      function xt(t) {
        t.memoizedState !== null && S($l, t);
        var e = Pt.current, a = pf(e, t.type);
        e !== a && (S(tl, t), S(Pt, a));
      }
      function Jt(t) {
        tl.current === t && (g(Pt), g(tl)), $l.current === t && (g($l), ta ? Ka._currentValue = mn : Ka._currentValue2 = mn);
      }
      function ut(t) {
        var e = Error(
          s(
            418,
            1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
            ""
          )
        );
        throw Rn(U(e, t)), eo;
      }
      function Oa(t, e) {
        if (!le) throw Error(s(175));
        pp(
          t.stateNode,
          t.type,
          t.memoizedProps,
          e,
          t
        ) || ut(t, !0);
      }
      function Ra(t) {
        for (te = t.return; te; )
          switch (te.tag) {
            case 5:
            case 31:
            case 13:
              Ne = !1;
              return;
            case 27:
            case 3:
              Ne = !0;
              return;
            default:
              te = te.return;
          }
      }
      function Ae(t) {
        if (!le || t !== te) return !1;
        if (!yt) return Ra(t), yt = !0, !1;
        var e = t.tag;
        if (Vt ? e !== 3 && e !== 27 && (e !== 5 || ku(t.type) && !Zl(t.type, t.memoizedProps)) && At && ut(t) : e !== 3 && (e !== 5 || ku(t.type) && !Zl(t.type, t.memoizedProps)) && At && ut(t), Ra(t), e === 13) {
          if (!le) throw Error(s(316));
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          At = yp(t);
        } else if (e === 31) {
          if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
          At = vp(t);
        } else
          At = Vt && e === 27 ? lp(
            t.type,
            At
          ) : te ? zu(t.stateNode) : null;
        return !0;
      }
      function Oe() {
        le && (At = te = null, yt = !1);
      }
      function ua() {
        var t = _a;
        return t !== null && (me === null ? me = t : me.push.apply(
          me,
          t
        ), _a = null), t;
      }
      function Rn(t) {
        _a === null ? _a = [t] : _a.push(t);
      }
      function da(t, e, a) {
        ta ? (S(Pl, e._currentValue), e._currentValue = a) : (S(Pl, e._currentValue2), e._currentValue2 = a);
      }
      function Le(t) {
        var e = Pl.current;
        ta ? t._currentValue = e : t._currentValue2 = e, g(Pl);
      }
      function Di(t, e, a) {
        for (; t !== null; ) {
          var l = t.alternate;
          if ((t.childLanes & e) !== e ? (t.childLanes |= e, l !== null && (l.childLanes |= e)) : l !== null && (l.childLanes & e) !== e && (l.childLanes |= e), t === a) break;
          t = t.return;
        }
      }
      function Ui(t, e, a, l) {
        var r = t.child;
        for (r !== null && (r.return = t); r !== null; ) {
          var u = r.dependencies;
          if (u !== null) {
            var f = r.child;
            u = u.firstContext;
            t: for (; u !== null; ) {
              var y = u;
              u = r;
              for (var R = 0; R < e.length; R++)
                if (y.context === e[R]) {
                  u.lanes |= a, y = u.alternate, y !== null && (y.lanes |= a), Di(
                    u.return,
                    a,
                    t
                  ), l || (f = null);
                  break t;
                }
              u = y.next;
            }
          } else if (r.tag === 18) {
            if (f = r.return, f === null) throw Error(s(341));
            f.lanes |= a, u = f.alternate, u !== null && (u.lanes |= a), Di(f, a, t), f = null;
          } else f = r.child;
          if (f !== null) f.return = r;
          else
            for (f = r; f !== null; ) {
              if (f === t) {
                f = null;
                break;
              }
              if (r = f.sibling, r !== null) {
                r.return = f.return, f = r;
                break;
              }
              f = f.return;
            }
          r = f;
        }
      }
      function nn(t, e, a, l) {
        t = null;
        for (var r = e, u = !1; r !== null; ) {
          if (!u) {
            if ((r.flags & 524288) !== 0) u = !0;
            else if ((r.flags & 262144) !== 0) break;
          }
          if (r.tag === 10) {
            var f = r.alternate;
            if (f === null) throw Error(s(387));
            if (f = f.memoizedProps, f !== null) {
              var y = r.type;
              ye(r.pendingProps.value, f.value) || (t !== null ? t.push(y) : t = [y]);
            }
          } else if (r === $l.current) {
            if (f = r.alternate, f === null) throw Error(s(387));
            f.memoizedState.memoizedState !== r.memoizedState.memoizedState && (t !== null ? t.push(Ka) : t = [Ka]);
          }
          r = r.return;
        }
        t !== null && Ui(
          e,
          t,
          a,
          l
        ), e.flags |= 262144;
      }
      function hl(t) {
        for (t = t.firstContext; t !== null; ) {
          var e = t.context;
          if (!ye(
            ta ? e._currentValue : e._currentValue2,
            t.memoizedValue
          ))
            return !0;
          t = t.next;
        }
        return !1;
      }
      function Ha(t) {
        Va = t, aa = null, t = t.dependencies, t !== null && (t.firstContext = null);
      }
      function It(t) {
        return $o(Va, t);
      }
      function gl(t, e) {
        return Va === null && Ha(t), $o(t, e);
      }
      function $o(t, e) {
        var a = ta ? e._currentValue : e._currentValue2;
        if (e = { context: e, memoizedValue: a, next: null }, aa === null) {
          if (t === null) throw Error(s(308));
          aa = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
        } else aa = aa.next = e;
        return a;
      }
      function Bi() {
        return {
          controller: new Jp(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Hn(t) {
        t.refCount--, t.refCount === 0 && Lp(Wp, function() {
          t.controller.abort();
        });
      }
      function bl() {
      }
      function Ge(t) {
        t !== vn && t.next === null && (vn === null ? ti = vn = t : vn = vn.next = t), ei = !0, ao || (ao = !0, Rm());
      }
      function ln(t, e) {
        if (!no && ei) {
          no = !0;
          do
            for (var a = !1, l = ti; l !== null; ) {
              if (t !== 0) {
                var r = l.pendingLanes;
                if (r === 0) var u = 0;
                else {
                  var f = l.suspendedLanes, y = l.pingedLanes;
                  u = (1 << 31 - be(42 | t) + 1) - 1, u &= r & ~(f & ~y), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
                }
                u !== 0 && (a = !0, ns(l, u));
              } else
                u = vt, u = Y(
                  l,
                  l === Tt ? u : 0,
                  l.cancelPendingCommit !== null || l.timeoutHandle !== Qa
                ), (u & 3) === 0 || E(l, u) || (a = !0, ns(l, u));
              l = l.next;
            }
          while (a);
          no = !1;
        }
      }
      function Po() {
        ts();
      }
      function ts() {
        ei = ao = !1;
        var t = 0;
        Xa !== 0 && Sf() && (t = Xa);
        for (var e = ue(), a = null, l = ti; l !== null; ) {
          var r = l.next, u = es(l, e);
          u === 0 ? (l.next = null, a === null ? ti = r : a.next = r, r === null && (vn = a)) : (a = l, (t !== 0 || (u & 3) !== 0) && (ei = !0)), l = r;
        }
        Xt !== 0 && Xt !== 5 || ln(t), Xa !== 0 && (Xa = 0);
      }
      function es(t, e) {
        for (var a = t.suspendedLanes, l = t.pingedLanes, r = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
          var f = 31 - be(u), y = 1 << f, R = r[f];
          R === -1 ? ((y & a) === 0 || (y & l) !== 0) && (r[f] = N(y, e)) : R <= e && (t.expiredLanes |= y), u &= ~y;
        }
        if (e = Tt, a = vt, a = Y(
          t,
          t === e ? a : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Qa
        ), l = t.callbackNode, a === 0 || t === e && (kt === 2 || kt === 9) || t.cancelPendingCommit !== null)
          return l !== null && l !== null && Ir(l), t.callbackNode = null, t.callbackPriority = 0;
        if ((a & 3) === 0 || E(t, a)) {
          if (e = a & -a, e === t.callbackPriority) return e;
          switch (l !== null && Ir(l), ot(a)) {
            case 2:
            case 8:
              a = Qp;
              break;
            case 32:
              a = $r;
              break;
            case 268435456:
              a = Kp;
              break;
            default:
              a = $r;
          }
          return l = as.bind(null, t), a = Fl(a, l), t.callbackPriority = e, t.callbackNode = a, e;
        }
        return l !== null && l !== null && Ir(l), t.callbackPriority = 2, t.callbackNode = null, 2;
      }
      function as(t, e) {
        if (Xt !== 0 && Xt !== 5)
          return t.callbackNode = null, t.callbackPriority = 0, null;
        var a = t.callbackNode;
        if (Ln() && t.callbackNode !== a)
          return null;
        var l = vt;
        return l = Y(
          t,
          t === Tt ? l : 0,
          t.cancelPendingCommit !== null || t.timeoutHandle !== Qa
        ), l === 0 ? null : (qc(t, l, e), es(t, ue()), t.callbackNode != null && t.callbackNode === a ? as.bind(null, t) : null);
      }
      function ns(t, e) {
        if (Ln()) return null;
        qc(t, e, !0);
      }
      function Rm() {
        jf ? Mf(function() {
          (gt & 6) !== 0 ? Fl(
            Du,
            Po
          ) : ts();
        }) : Fl(
          Du,
          Po
        );
      }
      function qi() {
        if (Xa === 0) {
          var t = yn;
          t === 0 && (t = Jl, Jl <<= 1, (Jl & 261888) === 0 && (Jl = 256)), Xa = t;
        }
        return Xa;
      }
      function Hm(t, e) {
        if (el === null) {
          var a = el = [];
          lo = 0, yn = qi(), xn = {
            status: "pending",
            value: void 0,
            then: function(l) {
              a.push(l);
            }
          };
        }
        return lo++, e.then(ls, ls), e;
      }
      function ls() {
        if (--lo === 0 && el !== null) {
          xn !== null && (xn.status = "fulfilled");
          var t = el;
          el = null, yn = 0, xn = null;
          for (var e = 0; e < t.length; e++) (0, t[e])();
        }
      }
      function Dm(t, e) {
        var a = [], l = {
          status: "pending",
          value: null,
          reason: null,
          then: function(r) {
            a.push(r);
          }
        };
        return t.then(
          function() {
            l.status = "fulfilled", l.value = e;
            for (var r = 0; r < a.length; r++) (0, a[r])(e);
          },
          function(r) {
            for (l.status = "rejected", l.reason = r, r = 0; r < a.length; r++)
              (0, a[r])(void 0);
          }
        ), l;
      }
      function Yi() {
        var t = Za.current;
        return t !== null ? t : Tt.pooledCache;
      }
      function vl(t, e) {
        e === null ? S(Za, Za.current) : S(Za, e.pool);
      }
      function is() {
        var t = Yi();
        return t === null ? null : {
          parent: ta ? Ot._currentValue : Ot._currentValue2,
          pool: t
        };
      }
      function yl(t, e) {
        if (ye(t, e)) return !0;
        if (typeof t != "object" || t === null || typeof e != "object" || e === null)
          return !1;
        var a = Object.keys(t), l = Object.keys(e);
        if (a.length !== l.length) return !1;
        for (l = 0; l < a.length; l++) {
          var r = a[l];
          if (!Zp.call(e, r) || !ye(t[r], e[r]))
            return !1;
        }
        return !0;
      }
      function rs(t) {
        return t = t.status, t === "fulfilled" || t === "rejected";
      }
      function os(t, e, a) {
        switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(bl, bl), e = a), e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, cs(t), t;
          default:
            if (typeof e.status == "string") e.then(bl, bl);
            else {
              if (t = Tt, t !== null && 100 < t.shellSuspendCounter)
                throw Error(s(482));
              t = e, t.status = "pending", t.then(
                function(l) {
                  if (e.status === "pending") {
                    var r = e;
                    r.status = "fulfilled", r.value = l;
                  }
                },
                function(l) {
                  if (e.status === "pending") {
                    var r = e;
                    r.status = "rejected", r.reason = l;
                  }
                }
              );
            }
            switch (e.status) {
              case "fulfilled":
                return e.value;
              case "rejected":
                throw t = e.reason, cs(t), t;
            }
            throw Ja = e, wn;
        }
      }
      function Da(t) {
        try {
          var e = t._init;
          return e(t._payload);
        } catch (a) {
          throw a !== null && typeof a == "object" && typeof a.then == "function" ? (Ja = a, wn) : a;
        }
      }
      function ss() {
        if (Ja === null) throw Error(s(459));
        var t = Ja;
        return Ja = null, t;
      }
      function cs(t) {
        if (t === wn || t === ai)
          throw Error(s(483));
      }
      function xl(t) {
        var e = al;
        return al += 1, _n === null && (_n = []), os(_n, t, e);
      }
      function Dn(t, e) {
        e = e.props.ref, t.ref = e !== void 0 ? e : null;
      }
      function wl(t, e) {
        throw e.$$typeof === sf ? Error(s(525)) : (t = Object.prototype.toString.call(e), Error(
          s(
            31,
            t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
          )
        ));
      }
      function us(t) {
        function e(j, T) {
          if (t) {
            var O = j.deletions;
            O === null ? (j.deletions = [T], j.flags |= 16) : O.push(T);
          }
        }
        function a(j, T) {
          if (!t) return null;
          for (; T !== null; )
            e(j, T), T = T.sibling;
          return null;
        }
        function l(j) {
          for (var T = /* @__PURE__ */ new Map(); j !== null; )
            j.key !== null ? T.set(j.key, j) : T.set(j.index, j), j = j.sibling;
          return T;
        }
        function r(j, T) {
          return j = Pe(j, T), j.index = 0, j.sibling = null, j;
        }
        function u(j, T, O) {
          return j.index = O, t ? (O = j.alternate, O !== null ? (O = O.index, O < T ? (j.flags |= 67108866, T) : O) : (j.flags |= 67108866, T)) : (j.flags |= 1048576, T);
        }
        function f(j) {
          return t && j.alternate === null && (j.flags |= 67108866), j;
        }
        function y(j, T, O, X) {
          return T === null || T.tag !== 6 ? (T = Hr(O, j.mode, X), T.return = j, T) : (T = r(T, O), T.return = j, T);
        }
        function R(j, T, O, X) {
          var rt = O.type;
          return rt === dn ? Z(
            j,
            T,
            O.props.children,
            X,
            O.key
          ) : T !== null && (T.elementType === rt || typeof rt == "object" && rt !== null && rt.$$typeof === ya && Da(rt) === T.type) ? (T = r(T, O.props), Dn(T, O), T.return = j, T) : (T = Kl(
            O.type,
            O.key,
            O.props,
            null,
            j.mode,
            X
          ), Dn(T, O), T.return = j, T);
        }
        function Q(j, T, O, X) {
          return T === null || T.tag !== 4 || T.stateNode.containerInfo !== O.containerInfo || T.stateNode.implementation !== O.implementation ? (T = Dr(O, j.mode, X), T.return = j, T) : (T = r(T, O.children || []), T.return = j, T);
        }
        function Z(j, T, O, X, rt) {
          return T === null || T.tag !== 7 ? (T = Ga(
            O,
            j.mode,
            X,
            rt
          ), T.return = j, T) : (T = r(T, O), T.return = j, T);
        }
        function V(j, T, O) {
          if (typeof T == "string" && T !== "" || typeof T == "number" || typeof T == "bigint")
            return T = Hr(
              "" + T,
              j.mode,
              O
            ), T.return = j, T;
          if (typeof T == "object" && T !== null) {
            switch (T.$$typeof) {
              case Vl:
                return O = Kl(
                  T.type,
                  T.key,
                  T.props,
                  null,
                  j.mode,
                  O
                ), Dn(O, T), O.return = j, O;
              case un:
                return T = Dr(
                  T,
                  j.mode,
                  O
                ), T.return = j, T;
              case ya:
                return T = Da(T), V(j, T, O);
            }
            if (Xl(T) || M(T))
              return T = Ga(
                T,
                j.mode,
                O,
                null
              ), T.return = j, T;
            if (typeof T.then == "function")
              return V(j, xl(T), O);
            if (T.$$typeof === va)
              return V(
                j,
                gl(j, T),
                O
              );
            wl(j, T);
          }
          return null;
        }
        function L(j, T, O, X) {
          var rt = T !== null ? T.key : null;
          if (typeof O == "string" && O !== "" || typeof O == "number" || typeof O == "bigint")
            return rt !== null ? null : y(j, T, "" + O, X);
          if (typeof O == "object" && O !== null) {
            switch (O.$$typeof) {
              case Vl:
                return O.key === rt ? R(j, T, O, X) : null;
              case un:
                return O.key === rt ? Q(j, T, O, X) : null;
              case ya:
                return O = Da(O), L(j, T, O, X);
            }
            if (Xl(O) || M(O))
              return rt !== null ? null : Z(j, T, O, X, null);
            if (typeof O.then == "function")
              return L(
                j,
                T,
                xl(O),
                X
              );
            if (O.$$typeof === va)
              return L(
                j,
                T,
                gl(j, O),
                X
              );
            wl(j, O);
          }
          return null;
        }
        function dt(j, T, O, X, rt) {
          if (typeof X == "string" && X !== "" || typeof X == "number" || typeof X == "bigint")
            return j = j.get(O) || null, y(T, j, "" + X, rt);
          if (typeof X == "object" && X !== null) {
            switch (X.$$typeof) {
              case Vl:
                return j = j.get(
                  X.key === null ? O : X.key
                ) || null, R(T, j, X, rt);
              case un:
                return j = j.get(
                  X.key === null ? O : X.key
                ) || null, Q(T, j, X, rt);
              case ya:
                return X = Da(X), dt(
                  j,
                  T,
                  O,
                  X,
                  rt
                );
            }
            if (Xl(X) || M(X))
              return j = j.get(O) || null, Z(T, j, X, rt, null);
            if (typeof X.then == "function")
              return dt(
                j,
                T,
                O,
                xl(X),
                rt
              );
            if (X.$$typeof === va)
              return dt(
                j,
                T,
                O,
                gl(T, X),
                rt
              );
            wl(T, X);
          }
          return null;
        }
        function ee(j, T, O, X) {
          for (var rt = null, Rt = null, st = T, _t = T = 0, Ft = null; st !== null && _t < O.length; _t++) {
            st.index > _t ? (Ft = st, st = null) : Ft = st.sibling;
            var St = L(
              j,
              st,
              O[_t],
              X
            );
            if (St === null) {
              st === null && (st = Ft);
              break;
            }
            t && st && St.alternate === null && e(j, st), T = u(St, T, _t), Rt === null ? rt = St : Rt.sibling = St, Rt = St, st = Ft;
          }
          if (_t === O.length)
            return a(j, st), yt && B(j, _t), rt;
          if (st === null) {
            for (; _t < O.length; _t++)
              st = V(j, O[_t], X), st !== null && (T = u(
                st,
                T,
                _t
              ), Rt === null ? rt = st : Rt.sibling = st, Rt = st);
            return yt && B(j, _t), rt;
          }
          for (st = l(st); _t < O.length; _t++)
            Ft = dt(
              st,
              j,
              _t,
              O[_t],
              X
            ), Ft !== null && (t && Ft.alternate !== null && st.delete(
              Ft.key === null ? _t : Ft.key
            ), T = u(
              Ft,
              T,
              _t
            ), Rt === null ? rt = Ft : Rt.sibling = Ft, Rt = Ft);
          return t && st.forEach(function(Ta) {
            return e(j, Ta);
          }), yt && B(j, _t), rt;
        }
        function cl(j, T, O, X) {
          if (O == null) throw Error(s(151));
          for (var rt = null, Rt = null, st = T, _t = T = 0, Ft = null, St = O.next(); st !== null && !St.done; _t++, St = O.next()) {
            st.index > _t ? (Ft = st, st = null) : Ft = st.sibling;
            var Ta = L(j, st, St.value, X);
            if (Ta === null) {
              st === null && (st = Ft);
              break;
            }
            t && st && Ta.alternate === null && e(j, st), T = u(Ta, T, _t), Rt === null ? rt = Ta : Rt.sibling = Ta, Rt = Ta, st = Ft;
          }
          if (St.done)
            return a(j, st), yt && B(j, _t), rt;
          if (st === null) {
            for (; !St.done; _t++, St = O.next())
              St = V(j, St.value, X), St !== null && (T = u(
                St,
                T,
                _t
              ), Rt === null ? rt = St : Rt.sibling = St, Rt = St);
            return yt && B(j, _t), rt;
          }
          for (st = l(st); !St.done; _t++, St = O.next())
            St = dt(
              st,
              j,
              _t,
              St.value,
              X
            ), St !== null && (t && St.alternate !== null && st.delete(St.key === null ? _t : St.key), T = u(St, T, _t), Rt === null ? rt = St : Rt.sibling = St, Rt = St);
          return t && st.forEach(function(Pp) {
            return e(j, Pp);
          }), yt && B(j, _t), rt;
        }
        function Ia(j, T, O, X) {
          if (typeof O == "object" && O !== null && O.type === dn && O.key === null && (O = O.props.children), typeof O == "object" && O !== null) {
            switch (O.$$typeof) {
              case Vl:
                t: {
                  for (var rt = O.key; T !== null; ) {
                    if (T.key === rt) {
                      if (rt = O.type, rt === dn) {
                        if (T.tag === 7) {
                          a(
                            j,
                            T.sibling
                          ), X = r(
                            T,
                            O.props.children
                          ), X.return = j, j = X;
                          break t;
                        }
                      } else if (T.elementType === rt || typeof rt == "object" && rt !== null && rt.$$typeof === ya && Da(rt) === T.type) {
                        a(
                          j,
                          T.sibling
                        ), X = r(T, O.props), Dn(X, O), X.return = j, j = X;
                        break t;
                      }
                      a(j, T);
                      break;
                    } else e(j, T);
                    T = T.sibling;
                  }
                  O.type === dn ? (X = Ga(
                    O.props.children,
                    j.mode,
                    X,
                    O.key
                  ), X.return = j, j = X) : (X = Kl(
                    O.type,
                    O.key,
                    O.props,
                    null,
                    j.mode,
                    X
                  ), Dn(X, O), X.return = j, j = X);
                }
                return f(j);
              case un:
                t: {
                  for (rt = O.key; T !== null; ) {
                    if (T.key === rt)
                      if (T.tag === 4 && T.stateNode.containerInfo === O.containerInfo && T.stateNode.implementation === O.implementation) {
                        a(
                          j,
                          T.sibling
                        ), X = r(
                          T,
                          O.children || []
                        ), X.return = j, j = X;
                        break t;
                      } else {
                        a(j, T);
                        break;
                      }
                    else e(j, T);
                    T = T.sibling;
                  }
                  X = Dr(O, j.mode, X), X.return = j, j = X;
                }
                return f(j);
              case ya:
                return O = Da(O), Ia(
                  j,
                  T,
                  O,
                  X
                );
            }
            if (Xl(O))
              return ee(
                j,
                T,
                O,
                X
              );
            if (M(O)) {
              if (rt = M(O), typeof rt != "function")
                throw Error(s(150));
              return O = rt.call(O), cl(
                j,
                T,
                O,
                X
              );
            }
            if (typeof O.then == "function")
              return Ia(
                j,
                T,
                xl(O),
                X
              );
            if (O.$$typeof === va)
              return Ia(
                j,
                T,
                gl(j, O),
                X
              );
            wl(j, O);
          }
          return typeof O == "string" && O !== "" || typeof O == "number" || typeof O == "bigint" ? (O = "" + O, T !== null && T.tag === 6 ? (a(j, T.sibling), X = r(T, O), X.return = j, j = X) : (a(j, T), X = Hr(O, j.mode, X), X.return = j, j = X), f(j)) : a(j, T);
        }
        return function(j, T, O, X) {
          try {
            al = 0;
            var rt = Ia(
              j,
              T,
              O,
              X
            );
            return _n = null, rt;
          } catch (st) {
            if (st === wn || st === ai) throw st;
            var Rt = o(29, st, null, j.mode);
            return Rt.lanes = X, Rt.return = j, Rt;
          } finally {
          }
        };
      }
      function _l() {
        for (var t = Sn, e = ro = Sn = 0; e < t; ) {
          var a = Te[e];
          Te[e++] = null;
          var l = Te[e];
          Te[e++] = null;
          var r = Te[e];
          Te[e++] = null;
          var u = Te[e];
          if (Te[e++] = null, l !== null && r !== null) {
            var f = l.pending;
            f === null ? r.next = r : (r.next = f.next, f.next = r), l.pending = r;
          }
          u !== 0 && ds(a, r, u);
        }
      }
      function Sl(t, e, a, l) {
        Te[Sn++] = t, Te[Sn++] = e, Te[Sn++] = a, Te[Sn++] = l, ro |= l, t.lanes |= l, t = t.alternate, t !== null && (t.lanes |= l);
      }
      function Gi(t, e, a, l) {
        return Sl(t, e, a, l), zl(t);
      }
      function Ua(t, e) {
        return Sl(t, null, null, e), zl(t);
      }
      function ds(t, e, a) {
        t.lanes |= a;
        var l = t.alternate;
        l !== null && (l.lanes |= a);
        for (var r = !1, u = t.return; u !== null; )
          u.childLanes |= a, l = u.alternate, l !== null && (l.childLanes |= a), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (r = !0)), t = u, u = u.return;
        return t.tag === 3 ? (u = t.stateNode, r && e !== null && (r = 31 - be(a), t = u.hiddenUpdates, l = t[r], l === null ? t[r] = [e] : l.push(e), e.lane = a | 536870912), u) : null;
      }
      function zl(t) {
        if (50 < sl)
          throw sl = 0, yo = null, Error(s(185));
        for (var e = t.return; e !== null; )
          t = e, e = t.return;
        return t.tag === 3 ? t.stateNode : null;
      }
      function Qi(t) {
        t.updateQueue = {
          baseState: t.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: { pending: null, lanes: 0, hiddenCallbacks: null },
          callbacks: null
        };
      }
      function Ki(t, e) {
        t = t.updateQueue, e.updateQueue === t && (e.updateQueue = {
          baseState: t.baseState,
          firstBaseUpdate: t.firstBaseUpdate,
          lastBaseUpdate: t.lastBaseUpdate,
          shared: t.shared,
          callbacks: null
        });
      }
      function ma(t) {
        return { lane: t, tag: 0, payload: null, callback: null, next: null };
      }
      function fa(t, e, a) {
        var l = t.updateQueue;
        if (l === null) return null;
        if (l = l.shared, (gt & 2) !== 0) {
          var r = l.pending;
          return r === null ? e.next = e : (e.next = r.next, r.next = e), l.pending = e, e = zl(t), ds(t, null, a), e;
        }
        return Sl(t, l, e, a), zl(t);
      }
      function Un(t, e, a) {
        if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
          var l = e.lanes;
          l &= t.pendingLanes, a |= l, e.lanes = a, G(t, a);
        }
      }
      function Vi(t, e) {
        var a = t.updateQueue, l = t.alternate;
        if (l !== null && (l = l.updateQueue, a === l)) {
          var r = null, u = null;
          if (a = a.firstBaseUpdate, a !== null) {
            do {
              var f = {
                lane: a.lane,
                tag: a.tag,
                payload: a.payload,
                callback: null,
                next: null
              };
              u === null ? r = u = f : u = u.next = f, a = a.next;
            } while (a !== null);
            u === null ? r = u = e : u = u.next = e;
          } else r = u = e;
          a = {
            baseState: l.baseState,
            firstBaseUpdate: r,
            lastBaseUpdate: u,
            shared: l.shared,
            callbacks: l.callbacks
          }, t.updateQueue = a;
          return;
        }
        t = a.lastBaseUpdate, t === null ? a.firstBaseUpdate = e : t.next = e, a.lastBaseUpdate = e;
      }
      function Bn() {
        if (oo) {
          var t = xn;
          if (t !== null) throw t;
        }
      }
      function qn(t, e, a, l) {
        oo = !1;
        var r = t.updateQueue;
        Sa = !1;
        var u = r.firstBaseUpdate, f = r.lastBaseUpdate, y = r.shared.pending;
        if (y !== null) {
          r.shared.pending = null;
          var R = y, Q = R.next;
          R.next = null, f === null ? u = Q : f.next = Q, f = R;
          var Z = t.alternate;
          Z !== null && (Z = Z.updateQueue, y = Z.lastBaseUpdate, y !== f && (y === null ? Z.firstBaseUpdate = Q : y.next = Q, Z.lastBaseUpdate = R));
        }
        if (u !== null) {
          var V = r.baseState;
          f = 0, Z = Q = R = null, y = u;
          do {
            var L = y.lane & -536870913, dt = L !== y.lane;
            if (dt ? (vt & L) === L : (l & L) === L) {
              L !== 0 && L === yn && (oo = !0), Z !== null && (Z = Z.next = {
                lane: 0,
                tag: y.tag,
                payload: y.payload,
                callback: null,
                next: null
              });
              t: {
                var ee = t, cl = y;
                L = e;
                var Ia = a;
                switch (cl.tag) {
                  case 1:
                    if (ee = cl.payload, typeof ee == "function") {
                      V = ee.call(
                        Ia,
                        V,
                        L
                      );
                      break t;
                    }
                    V = ee;
                    break t;
                  case 3:
                    ee.flags = ee.flags & -65537 | 128;
                  case 0:
                    if (ee = cl.payload, L = typeof ee == "function" ? ee.call(Ia, V, L) : ee, L == null) break t;
                    V = Br({}, V, L);
                    break t;
                  case 2:
                    Sa = !0;
                }
              }
              L = y.callback, L !== null && (t.flags |= 64, dt && (t.flags |= 8192), dt = r.callbacks, dt === null ? r.callbacks = [L] : dt.push(L));
            } else
              dt = {
                lane: L,
                tag: y.tag,
                payload: y.payload,
                callback: y.callback,
                next: null
              }, Z === null ? (Q = Z = dt, R = V) : Z = Z.next = dt, f |= L;
            if (y = y.next, y === null) {
              if (y = r.shared.pending, y === null)
                break;
              dt = y, y = dt.next, dt.next = null, r.lastBaseUpdate = dt, r.shared.pending = null;
            }
          } while (!0);
          Z === null && (R = V), r.baseState = R, r.firstBaseUpdate = Q, r.lastBaseUpdate = Z, u === null && (r.shared.lanes = 0), ka |= f, t.lanes = f, t.memoizedState = V;
        }
      }
      function ms(t, e) {
        if (typeof t != "function")
          throw Error(s(191, t));
        t.call(e);
      }
      function fs(t, e) {
        var a = t.callbacks;
        if (a !== null)
          for (t.callbacks = null, t = 0; t < a.length; t++)
            ms(a[t], e);
      }
      function ps(t, e) {
        t = ia, S(li, t), S(zn, e), ia = t | e.baseLanes;
      }
      function Xi() {
        S(li, ia), S(zn, zn.current);
      }
      function Zi() {
        ia = li.current, g(zn), g(li);
      }
      function pa(t) {
        var e = t.alternate;
        S(Bt, Bt.current & 1), S(xe, t), Ce === null && (e === null || zn.current !== null || e.memoizedState !== null) && (Ce = t);
      }
      function Ji(t) {
        S(Bt, Bt.current), S(xe, t), Ce === null && (Ce = t);
      }
      function hs(t) {
        t.tag === 22 ? (S(Bt, Bt.current), S(xe, t), Ce === null && (Ce = t)) : ha();
      }
      function ha() {
        S(Bt, Bt.current), S(xe, xe.current);
      }
      function pe(t) {
        g(xe), Ce === t && (Ce = null), g(Bt);
      }
      function kl(t) {
        for (var e = t; e !== null; ) {
          if (e.tag === 13) {
            var a = e.memoizedState;
            if (a !== null && (a = a.dehydrated, a === null || Jr(a) || Lr(a)))
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
      function Li(t, e) {
        if (e === null) return !1;
        for (var a = 0; a < e.length && a < t.length; a++)
          if (!ye(t[a], e[a])) return !1;
        return !0;
      }
      function Wi(t, e, a, l, r, u) {
        return na = u, mt = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, it.H = t === null || t.memoizedState === null ? Qu : so, Wa = !1, u = a(l, r), Wa = !1, kn && (u = bs(
          e,
          a,
          l,
          r
        )), gs(t), u;
      }
      function gs(t) {
        it.H = ll;
        var e = Et !== null && Et.next !== null;
        if (na = 0, qt = Et = mt = null, ii = !1, nl = 0, En = null, e) throw Error(s(300));
        t === null || Yt || (t = t.dependencies, t !== null && hl(t) && (Yt = !0));
      }
      function bs(t, e, a, l) {
        mt = t;
        var r = 0;
        do {
          if (kn && (En = null), nl = 0, kn = !1, 25 <= r) throw Error(s(301));
          if (r += 1, qt = Et = null, t.updateQueue != null) {
            var u = t.updateQueue;
            u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
          }
          it.H = Ku, u = e(a, l);
        } while (kn);
        return u;
      }
      function Um() {
        var t = it.H, e = t.useState()[0];
        return e = typeof e.then == "function" ? Yn(e) : e, t = t.useState()[0], (Et !== null ? Et.memoizedState : null) !== t && (mt.flags |= 1024), e;
      }
      function Fi() {
        var t = ri !== 0;
        return ri = 0, t;
      }
      function Ii(t, e, a) {
        e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
      }
      function $i(t) {
        if (ii) {
          for (t = t.memoizedState; t !== null; ) {
            var e = t.queue;
            e !== null && (e.pending = null), t = t.next;
          }
          ii = !1;
        }
        na = 0, qt = Et = mt = null, kn = !1, nl = ri = 0, En = null;
      }
      function oe() {
        var t = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return qt === null ? mt.memoizedState = qt = t : qt = qt.next = t, qt;
      }
      function Ut() {
        if (Et === null) {
          var t = mt.alternate;
          t = t !== null ? t.memoizedState : null;
        } else t = Et.next;
        var e = qt === null ? mt.memoizedState : qt.next;
        if (e !== null)
          qt = e, Et = t;
        else {
          if (t === null)
            throw mt.alternate === null ? Error(s(467)) : Error(s(310));
          Et = t, t = {
            memoizedState: Et.memoizedState,
            baseState: Et.baseState,
            baseQueue: Et.baseQueue,
            queue: Et.queue,
            next: null
          }, qt === null ? mt.memoizedState = qt = t : qt = qt.next = t;
        }
        return qt;
      }
      function El() {
        return { lastEffect: null, events: null, stores: null, memoCache: null };
      }
      function Yn(t) {
        var e = nl;
        return nl += 1, En === null && (En = []), t = os(En, t, e), e = mt, (qt === null ? e.memoizedState : qt.next) === null && (e = e.alternate, it.H = e === null || e.memoizedState === null ? Qu : so), t;
      }
      function Nl(t) {
        if (t !== null && typeof t == "object") {
          if (typeof t.then == "function") return Yn(t);
          if (t.$$typeof === va) return It(t);
        }
        throw Error(s(438, String(t)));
      }
      function Pi(t) {
        var e = null, a = mt.updateQueue;
        if (a !== null && (e = a.memoCache), e == null) {
          var l = mt.alternate;
          l !== null && (l = l.updateQueue, l !== null && (l = l.memoCache, l != null && (e = {
            data: l.data.map(function(r) {
              return r.slice();
            }),
            index: 0
          })));
        }
        if (e == null && (e = { data: [], index: 0 }), a === null && (a = El(), mt.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0)
          for (a = e.data[e.index] = Array(t), l = 0; l < t; l++)
            a[l] = cf;
        return e.index++, a;
      }
      function We(t, e) {
        return typeof e == "function" ? e(t) : e;
      }
      function Tl(t) {
        var e = Ut();
        return tr(e, Et, t);
      }
      function tr(t, e, a) {
        var l = t.queue;
        if (l === null) throw Error(s(311));
        l.lastRenderedReducer = a;
        var r = t.baseQueue, u = l.pending;
        if (u !== null) {
          if (r !== null) {
            var f = r.next;
            r.next = u.next, u.next = f;
          }
          e.baseQueue = r = u, l.pending = null;
        }
        if (u = t.baseState, r === null) t.memoizedState = u;
        else {
          e = r.next;
          var y = f = null, R = null, Q = e, Z = !1;
          do {
            var V = Q.lane & -536870913;
            if (V !== Q.lane ? (vt & V) === V : (na & V) === V) {
              var L = Q.revertLane;
              if (L === 0)
                R !== null && (R = R.next = {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: Q.action,
                  hasEagerState: Q.hasEagerState,
                  eagerState: Q.eagerState,
                  next: null
                }), V === yn && (Z = !0);
              else if ((na & L) === L) {
                Q = Q.next, L === yn && (Z = !0);
                continue;
              } else
                V = {
                  lane: 0,
                  revertLane: Q.revertLane,
                  gesture: null,
                  action: Q.action,
                  hasEagerState: Q.hasEagerState,
                  eagerState: Q.eagerState,
                  next: null
                }, R === null ? (y = R = V, f = u) : R = R.next = V, mt.lanes |= L, ka |= L;
              V = Q.action, Wa && a(u, V), u = Q.hasEagerState ? Q.eagerState : a(u, V);
            } else
              L = {
                lane: V,
                revertLane: Q.revertLane,
                gesture: Q.gesture,
                action: Q.action,
                hasEagerState: Q.hasEagerState,
                eagerState: Q.eagerState,
                next: null
              }, R === null ? (y = R = L, f = u) : R = R.next = L, mt.lanes |= V, ka |= V;
            Q = Q.next;
          } while (Q !== null && Q !== e);
          if (R === null ? f = u : R.next = y, !ye(u, t.memoizedState) && (Yt = !0, Z && (a = xn, a !== null)))
            throw a;
          t.memoizedState = u, t.baseState = f, t.baseQueue = R, l.lastRenderedState = u;
        }
        return r === null && (l.lanes = 0), [t.memoizedState, l.dispatch];
      }
      function er(t) {
        var e = Ut(), a = e.queue;
        if (a === null) throw Error(s(311));
        a.lastRenderedReducer = t;
        var l = a.dispatch, r = a.pending, u = e.memoizedState;
        if (r !== null) {
          a.pending = null;
          var f = r = r.next;
          do
            u = t(u, f.action), f = f.next;
          while (f !== r);
          ye(u, e.memoizedState) || (Yt = !0), e.memoizedState = u, e.baseQueue === null && (e.baseState = u), a.lastRenderedState = u;
        }
        return [u, l];
      }
      function vs(t, e, a) {
        var l = mt, r = Ut(), u = yt;
        if (u) {
          if (a === void 0)
            throw Error(s(407));
          a = a();
        } else a = e();
        var f = !ye(
          (Et || r).memoizedState,
          a
        );
        if (f && (r.memoizedState = a, Yt = !0), r = r.queue, lr(ws.bind(null, l, r, t), [
          t
        ]), r.getSnapshot !== e || f || qt !== null && qt.memoizedState.tag & 1) {
          if (l.flags |= 2048, rn(
            9,
            { destroy: void 0 },
            xs.bind(
              null,
              l,
              r,
              a,
              e
            ),
            null
          ), Tt === null) throw Error(s(349));
          u || (na & 127) !== 0 || ys(l, e, a);
        }
        return a;
      }
      function ys(t, e, a) {
        t.flags |= 16384, t = { getSnapshot: e, value: a }, e = mt.updateQueue, e === null ? (e = El(), mt.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
      }
      function xs(t, e, a, l) {
        e.value = a, e.getSnapshot = l, _s(e) && Ss(t);
      }
      function ws(t, e, a) {
        return a(function() {
          _s(e) && Ss(t);
        });
      }
      function _s(t) {
        var e = t.getSnapshot;
        t = t.value;
        try {
          var a = e();
          return !ye(t, a);
        } catch {
          return !0;
        }
      }
      function Ss(t) {
        var e = Ua(t, 2);
        e !== null && ce(e, t, 2);
      }
      function ar(t) {
        var e = oe();
        if (typeof t == "function") {
          var a = t;
          if (t = a(), Wa) {
            Mt(!0);
            try {
              a();
            } finally {
              Mt(!1);
            }
          }
        }
        return e.memoizedState = e.baseState = t, e.queue = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: We,
          lastRenderedState: t
        }, e;
      }
      function zs(t, e, a, l) {
        return t.baseState = a, tr(
          t,
          Et,
          typeof l == "function" ? l : We
        );
      }
      function Bm(t, e, a, l, r) {
        if (Ml(t)) throw Error(s(485));
        if (t = e.action, t !== null) {
          var u = {
            payload: r,
            action: t,
            next: null,
            isTransition: !0,
            status: "pending",
            value: null,
            reason: null,
            listeners: [],
            then: function(f) {
              u.listeners.push(f);
            }
          };
          it.T !== null ? a(!0) : u.isTransition = !1, l(u), a = e.pending, a === null ? (u.next = e.pending = u, ks(e, u)) : (u.next = a.next, e.pending = a.next = u);
        }
      }
      function ks(t, e) {
        var a = e.action, l = e.payload, r = t.state;
        if (e.isTransition) {
          var u = it.T, f = {};
          it.T = f;
          try {
            var y = a(r, l), R = it.S;
            R !== null && R(f, y), Es(t, e, y);
          } catch (Q) {
            nr(t, e, Q);
          } finally {
            u !== null && f.types !== null && (u.types = f.types), it.T = u;
          }
        } else
          try {
            u = a(r, l), Es(t, e, u);
          } catch (Q) {
            nr(t, e, Q);
          }
      }
      function Es(t, e, a) {
        a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
          function(l) {
            Ns(t, e, l);
          },
          function(l) {
            return nr(t, e, l);
          }
        ) : Ns(t, e, a);
      }
      function Ns(t, e, a) {
        e.status = "fulfilled", e.value = a, Ts(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, ks(t, a)));
      }
      function nr(t, e, a) {
        var l = t.pending;
        if (t.pending = null, l !== null) {
          l = l.next;
          do
            e.status = "rejected", e.reason = a, Ts(e), e = e.next;
          while (e !== l);
        }
        t.action = null;
      }
      function Ts(t) {
        t = t.listeners;
        for (var e = 0; e < t.length; e++) (0, t[e])();
      }
      function Cs(t, e) {
        return e;
      }
      function js(t, e) {
        if (yt) {
          var a = Tt.formState;
          if (a !== null) {
            t: {
              var l = mt;
              if (yt) {
                if (At) {
                  var r = ap(
                    At,
                    Ne
                  );
                  if (r) {
                    At = zu(r), l = np(r);
                    break t;
                  }
                }
                ut(l);
              }
              l = !1;
            }
            l && (e = a[0]);
          }
        }
        a = oe(), a.memoizedState = a.baseState = e, l = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Cs,
          lastRenderedState: e
        }, a.queue = l, a = Ls.bind(
          null,
          mt,
          l
        ), l.dispatch = a, l = ar(!1);
        var u = sr.bind(
          null,
          mt,
          !1,
          l.queue
        );
        return l = oe(), r = {
          state: e,
          dispatch: null,
          action: t,
          pending: null
        }, l.queue = r, a = Bm.bind(
          null,
          mt,
          r,
          u,
          a
        ), r.dispatch = a, l.memoizedState = t, [e, a, !1];
      }
      function Ms(t) {
        var e = Ut();
        return As(e, Et, t);
      }
      function As(t, e, a) {
        if (e = tr(
          t,
          e,
          Cs
        )[0], t = Tl(We)[0], typeof e == "object" && e !== null && typeof e.then == "function")
          try {
            var l = Yn(e);
          } catch (f) {
            throw f === wn ? ai : f;
          }
        else l = e;
        e = Ut();
        var r = e.queue, u = r.dispatch;
        return a !== e.memoizedState && (mt.flags |= 2048, rn(
          9,
          { destroy: void 0 },
          qm.bind(null, r, a),
          null
        )), [l, u, t];
      }
      function qm(t, e) {
        t.action = e;
      }
      function Os(t) {
        var e = Ut(), a = Et;
        if (a !== null)
          return As(e, a, t);
        Ut(), e = e.memoizedState, a = Ut();
        var l = a.queue.dispatch;
        return a.memoizedState = t, [e, l, !1];
      }
      function rn(t, e, a, l) {
        return t = { tag: t, create: a, deps: l, inst: e, next: null }, e = mt.updateQueue, e === null && (e = El(), mt.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (l = a.next, a.next = t, t.next = l, e.lastEffect = t), t;
      }
      function Rs() {
        return Ut().memoizedState;
      }
      function Cl(t, e, a, l) {
        var r = oe();
        mt.flags |= t, r.memoizedState = rn(
          1 | e,
          { destroy: void 0 },
          a,
          l === void 0 ? null : l
        );
      }
      function jl(t, e, a, l) {
        var r = Ut();
        l = l === void 0 ? null : l;
        var u = r.memoizedState.inst;
        Et !== null && l !== null && Li(l, Et.memoizedState.deps) ? r.memoizedState = rn(e, u, a, l) : (mt.flags |= t, r.memoizedState = rn(
          1 | e,
          u,
          a,
          l
        ));
      }
      function Hs(t, e) {
        Cl(8390656, 8, t, e);
      }
      function lr(t, e) {
        jl(2048, 8, t, e);
      }
      function Ym(t) {
        mt.flags |= 4;
        var e = mt.updateQueue;
        if (e === null)
          e = El(), mt.updateQueue = e, e.events = [t];
        else {
          var a = e.events;
          a === null ? e.events = [t] : a.push(t);
        }
      }
      function Ds(t) {
        var e = Ut().memoizedState;
        return Ym({ ref: e, nextImpl: t }), function() {
          if ((gt & 2) !== 0)
            throw Error(s(440));
          return e.impl.apply(void 0, arguments);
        };
      }
      function Us(t, e) {
        return jl(4, 2, t, e);
      }
      function Bs(t, e) {
        return jl(4, 4, t, e);
      }
      function qs(t, e) {
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
      function Ys(t, e, a) {
        a = a != null ? a.concat([t]) : null, jl(
          4,
          4,
          qs.bind(null, e, t),
          a
        );
      }
      function ir() {
      }
      function Gs(t, e) {
        var a = Ut();
        e = e === void 0 ? null : e;
        var l = a.memoizedState;
        return e !== null && Li(e, l[1]) ? l[0] : (a.memoizedState = [t, e], t);
      }
      function Qs(t, e) {
        var a = Ut();
        e = e === void 0 ? null : e;
        var l = a.memoizedState;
        if (e !== null && Li(e, l[1]))
          return l[0];
        if (l = t(), Wa) {
          Mt(!0);
          try {
            t();
          } finally {
            Mt(!1);
          }
        }
        return a.memoizedState = [l, e], l;
      }
      function rr(t, e, a) {
        return a === void 0 || (na & 1073741824) !== 0 && (vt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = Bc(), mt.lanes |= t, ka |= t, a);
      }
      function Ks(t, e, a, l) {
        return ye(a, e) ? a : zn.current !== null ? (t = rr(t, a, l), ye(t, e) || (Yt = !0), t) : (na & 42) === 0 || (na & 1073741824) !== 0 && (vt & 261930) === 0 ? (Yt = !0, t.memoizedState = a) : (t = Bc(), mt.lanes |= t, ka |= t, e);
      }
      function Vs(t, e, a, l, r) {
        var u = ea();
        Lt(
          u !== 0 && 8 > u ? u : 8
        );
        var f = it.T, y = {};
        it.T = y, sr(t, !1, e, a);
        try {
          var R = r(), Q = it.S;
          if (Q !== null && Q(y, R), R !== null && typeof R == "object" && typeof R.then == "function") {
            var Z = Dm(
              R,
              l
            );
            Gn(
              t,
              e,
              Z,
              he(t)
            );
          } else
            Gn(
              t,
              e,
              l,
              he(t)
            );
        } catch (V) {
          Gn(
            t,
            e,
            { then: function() {
            }, status: "rejected", reason: V },
            he()
          );
        } finally {
          Lt(u), f !== null && y.types !== null && (f.types = y.types), it.T = f;
        }
      }
      function Xs(t) {
        var e = t.memoizedState;
        if (e !== null) return e;
        e = {
          memoizedState: mn,
          baseState: mn,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: We,
            lastRenderedState: mn
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
            lastRenderedReducer: We,
            lastRenderedState: a
          },
          next: null
        }, t.memoizedState = e, t = t.alternate, t !== null && (t.memoizedState = e), e;
      }
      function or() {
        return It(Ka);
      }
      function Zs() {
        return Ut().memoizedState;
      }
      function Js() {
        return Ut().memoizedState;
      }
      function Gm(t) {
        for (var e = t.return; e !== null; ) {
          switch (e.tag) {
            case 24:
            case 3:
              var a = he();
              t = ma(a);
              var l = fa(e, t, a);
              l !== null && (ce(l, e, a), Un(l, e, a)), e = { cache: Bi() }, t.payload = e;
              return;
          }
          e = e.return;
        }
      }
      function Qm(t, e, a) {
        var l = he();
        a = {
          lane: l,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Ml(t) ? Ws(e, a) : (a = Gi(t, e, a, l), a !== null && (ce(a, t, l), Fs(a, e, l)));
      }
      function Ls(t, e, a) {
        var l = he();
        Gn(t, e, a, l);
      }
      function Gn(t, e, a, l) {
        var r = {
          lane: l,
          revertLane: 0,
          gesture: null,
          action: a,
          hasEagerState: !1,
          eagerState: null,
          next: null
        };
        if (Ml(t)) Ws(e, r);
        else {
          var u = t.alternate;
          if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null))
            try {
              var f = e.lastRenderedState, y = u(f, a);
              if (r.hasEagerState = !0, r.eagerState = y, ye(y, f))
                return Sl(t, e, r, 0), Tt === null && _l(), !1;
            } catch {
            } finally {
            }
          if (a = Gi(t, e, r, l), a !== null)
            return ce(a, t, l), Fs(a, e, l), !0;
        }
        return !1;
      }
      function sr(t, e, a, l) {
        if (l = {
          lane: 2,
          revertLane: qi(),
          gesture: null,
          action: l,
          hasEagerState: !1,
          eagerState: null,
          next: null
        }, Ml(t)) {
          if (e) throw Error(s(479));
        } else
          e = Gi(
            t,
            a,
            l,
            2
          ), e !== null && ce(e, t, 2);
      }
      function Ml(t) {
        var e = t.alternate;
        return t === mt || e !== null && e === mt;
      }
      function Ws(t, e) {
        kn = ii = !0;
        var a = t.pending;
        a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
      }
      function Fs(t, e, a) {
        if ((a & 4194048) !== 0) {
          var l = e.lanes;
          l &= t.pendingLanes, a |= l, e.lanes = a, G(t, a);
        }
      }
      function cr(t, e, a, l) {
        e = t.memoizedState, a = a(l, e), a = a == null ? e : Br({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
      }
      function Is(t, e, a, l, r, u, f) {
        return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(l, u, f) : e.prototype && e.prototype.isPureReactComponent ? !yl(a, l) || !yl(r, u) : !0;
      }
      function $s(t, e, a, l) {
        t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, l), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, l), e.state !== t && co.enqueueReplaceState(e, e.state, null);
      }
      function Ba(t, e) {
        var a = e;
        if ("ref" in e) {
          a = {};
          for (var l in e)
            l !== "ref" && (a[l] = e[l]);
        }
        if (t = t.defaultProps) {
          a === e && (a = Br({}, a));
          for (var r in t)
            a[r] === void 0 && (a[r] = t[r]);
        }
        return a;
      }
      function Al(t, e) {
        try {
          var a = t.onUncaughtError;
          a(e.value, { componentStack: e.stack });
        } catch (l) {
          setTimeout(function() {
            throw l;
          });
        }
      }
      function Ps(t, e, a) {
        try {
          var l = t.onCaughtError;
          l(a.value, {
            componentStack: a.stack,
            errorBoundary: e.tag === 1 ? e.stateNode : null
          });
        } catch (r) {
          setTimeout(function() {
            throw r;
          });
        }
      }
      function ur(t, e, a) {
        return a = ma(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
          Al(t, e);
        }, a;
      }
      function tc(t) {
        return t = ma(t), t.tag = 3, t;
      }
      function ec(t, e, a, l) {
        var r = a.type.getDerivedStateFromError;
        if (typeof r == "function") {
          var u = l.value;
          t.payload = function() {
            return r(u);
          }, t.callback = function() {
            Ps(e, a, l);
          };
        }
        var f = a.stateNode;
        f !== null && typeof f.componentDidCatch == "function" && (t.callback = function() {
          Ps(e, a, l), typeof r != "function" && (Ea === null ? Ea = /* @__PURE__ */ new Set([this]) : Ea.add(this));
          var y = l.stack;
          this.componentDidCatch(l.value, {
            componentStack: y !== null ? y : ""
          });
        });
      }
      function Km(t, e, a, l, r) {
        if (a.flags |= 32768, l !== null && typeof l == "object" && typeof l.then == "function") {
          if (e = a.alternate, e !== null && nn(
            e,
            a,
            r,
            !0
          ), a = xe.current, a !== null) {
            switch (a.tag) {
              case 31:
              case 13:
                return Ce === null ? Gl() : a.alternate === null && Dt === 0 && (Dt = 3), a.flags &= -257, a.flags |= 65536, a.lanes = r, l === ni ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([l]) : e.add(l), Or(t, l, r)), !1;
              case 22:
                return a.flags |= 65536, l === ni ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([l])
                }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([l]) : a.add(l)), Or(t, l, r)), !1;
            }
            throw Error(s(435, a.tag));
          }
          return Or(t, l, r), Gl(), !1;
        }
        if (yt)
          return e = xe.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = r, l !== eo && (t = Error(s(422), { cause: l }), Rn(
            U(t, a)
          ))) : (l !== eo && (e = Error(s(423), {
            cause: l
          }), Rn(
            U(e, a)
          )), t = t.current.alternate, t.flags |= 65536, r &= -r, t.lanes |= r, l = U(l, a), r = ur(
            t.stateNode,
            l,
            r
          ), Vi(t, r), Dt !== 4 && (Dt = 2)), !1;
        var u = Error(s(520), { cause: l });
        if (u = U(u, a), rl === null ? rl = [u] : rl.push(u), Dt !== 4 && (Dt = 2), e === null) return !0;
        l = U(l, a), a = e;
        do {
          switch (a.tag) {
            case 3:
              return a.flags |= 65536, t = r & -r, a.lanes |= t, t = ur(a.stateNode, l, t), Vi(a, t), !1;
            case 1:
              if (e = a.type, u = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (Ea === null || !Ea.has(
                u
              ))))
                return a.flags |= 65536, r &= -r, a.lanes |= r, r = tc(r), ec(
                  r,
                  t,
                  a,
                  l
                ), Vi(a, r), !1;
          }
          a = a.return;
        } while (a !== null);
        return !1;
      }
      function $t(t, e, a, l) {
        e.child = t === null ? Gu(e, null, a, l) : La(
          e,
          t.child,
          a,
          l
        );
      }
      function ac(t, e, a, l, r) {
        a = a.render;
        var u = e.ref;
        if ("ref" in l) {
          var f = {};
          for (var y in l)
            y !== "ref" && (f[y] = l[y]);
        } else f = l;
        return Ha(e), l = Wi(
          t,
          e,
          a,
          f,
          u,
          r
        ), y = Fi(), t !== null && !Yt ? (Ii(t, e, r), Fe(t, e, r)) : (yt && y && q(e), e.flags |= 1, $t(t, e, l, r), e.child);
      }
      function nc(t, e, a, l, r) {
        if (t === null) {
          var u = a.type;
          return typeof u == "function" && !Rr(u) && u.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = u, lc(
            t,
            e,
            u,
            l,
            r
          )) : (t = Kl(
            a.type,
            null,
            l,
            e,
            e.mode,
            r
          ), t.ref = e.ref, t.return = e, e.child = t);
        }
        if (u = t.child, !br(t, r)) {
          var f = u.memoizedProps;
          if (a = a.compare, a = a !== null ? a : yl, a(f, l) && t.ref === e.ref)
            return Fe(
              t,
              e,
              r
            );
        }
        return e.flags |= 1, t = Pe(u, l), t.ref = e.ref, t.return = e, e.child = t;
      }
      function lc(t, e, a, l, r) {
        if (t !== null) {
          var u = t.memoizedProps;
          if (yl(u, l) && t.ref === e.ref)
            if (Yt = !1, e.pendingProps = l = u, br(t, r))
              (t.flags & 131072) !== 0 && (Yt = !0);
            else
              return e.lanes = t.lanes, Fe(t, e, r);
        }
        return dr(
          t,
          e,
          a,
          l,
          r
        );
      }
      function ic(t, e, a, l) {
        var r = l.children, u = t !== null ? t.memoizedState : null;
        if (t === null && e.stateNode === null && (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), l.mode === "hidden") {
          if ((e.flags & 128) !== 0) {
            if (u = u !== null ? u.baseLanes | a : a, t !== null) {
              for (l = e.child = t.child, r = 0; l !== null; )
                r = r | l.lanes | l.childLanes, l = l.sibling;
              l = r & ~u;
            } else l = 0, e.child = null;
            return rc(
              t,
              e,
              u,
              a,
              l
            );
          }
          if ((a & 536870912) !== 0)
            e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && vl(
              e,
              u !== null ? u.cachePool : null
            ), u !== null ? ps(e, u) : Xi(), hs(e);
          else
            return l = e.lanes = 536870912, rc(
              t,
              e,
              u !== null ? u.baseLanes | a : a,
              a,
              l
            );
        } else
          u !== null ? (vl(e, u.cachePool), ps(e, u), ha(), e.memoizedState = null) : (t !== null && vl(e, null), Xi(), ha());
        return $t(t, e, r, a), e.child;
      }
      function Qn(t, e) {
        return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), e.sibling;
      }
      function rc(t, e, a, l, r) {
        var u = Yi();
        return u = u === null ? null : {
          parent: ta ? Ot._currentValue : Ot._currentValue2,
          pool: u
        }, e.memoizedState = {
          baseLanes: a,
          cachePool: u
        }, t !== null && vl(e, null), Xi(), hs(e), t !== null && nn(t, e, l, !0), e.childLanes = r, null;
      }
      function Ol(t, e) {
        return e = Hl(
          { mode: e.mode, children: e.children },
          t.mode
        ), e.ref = t.ref, t.child = e, e.return = t, e;
      }
      function oc(t, e, a) {
        return La(e, t.child, null, a), t = Ol(
          e,
          e.pendingProps
        ), t.flags |= 2, pe(e), e.memoizedState = null, t;
      }
      function Vm(t, e, a) {
        var l = e.pendingProps, r = (e.flags & 128) !== 0;
        if (e.flags &= -129, t === null) {
          if (yt) {
            if (l.mode === "hidden")
              return t = Ol(e, l), e.lanes = 536870912, Qn(null, t);
            if (Ji(e), (t = At) ? (t = mp(
              t,
              Ne
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: xa !== null ? { id: Ve, overflow: Xe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = lu(t), a.return = e, e.child = a, te = e, At = null)) : t = null, t === null) throw ut(e);
            return e.lanes = 536870912, null;
          }
          return Ol(e, l);
        }
        var u = t.memoizedState;
        if (u !== null) {
          var f = u.dehydrated;
          if (Ji(e), r)
            if (e.flags & 256)
              e.flags &= -257, e = oc(
                t,
                e,
                a
              );
            else if (e.memoizedState !== null)
              e.child = t.child, e.flags |= 128, e = null;
            else throw Error(s(558));
          else if (Yt || nn(
            t,
            e,
            a,
            !1
          ), r = (a & t.childLanes) !== 0, Yt || r) {
            if (l = Tt, l !== null && (f = J(l, a), f !== 0 && f !== u.retryLane))
              throw u.retryLane = f, Ua(t, f), ce(l, t, f), uo;
            Gl(), e = oc(
              t,
              e,
              a
            );
          } else
            t = u.treeContext, le && (At = op(f), te = e, yt = !0, _a = null, Ne = !1, t !== null && $(e, t)), e = Ol(e, l), e.flags |= 4096;
          return e;
        }
        return t = Pe(t.child, {
          mode: l.mode,
          children: l.children
        }), t.ref = e.ref, e.child = t, t.return = e, t;
      }
      function Rl(t, e) {
        var a = e.ref;
        if (a === null)
          t !== null && t.ref !== null && (e.flags |= 4194816);
        else {
          if (typeof a != "function" && typeof a != "object")
            throw Error(s(284));
          (t === null || t.ref !== a) && (e.flags |= 4194816);
        }
      }
      function dr(t, e, a, l, r) {
        return Ha(e), a = Wi(
          t,
          e,
          a,
          l,
          void 0,
          r
        ), l = Fi(), t !== null && !Yt ? (Ii(t, e, r), Fe(t, e, r)) : (yt && l && q(e), e.flags |= 1, $t(t, e, a, r), e.child);
      }
      function sc(t, e, a, l, r, u) {
        return Ha(e), e.updateQueue = null, a = bs(
          e,
          l,
          a,
          r
        ), gs(t), l = Fi(), t !== null && !Yt ? (Ii(t, e, u), Fe(t, e, u)) : (yt && l && q(e), e.flags |= 1, $t(t, e, a, u), e.child);
      }
      function cc(t, e, a, l, r) {
        if (Ha(e), e.stateNode === null) {
          var u = hn, f = a.contextType;
          typeof f == "object" && f !== null && (u = It(f)), u = new a(l, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = co, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = l, u.state = e.memoizedState, u.refs = {}, Qi(e), f = a.contextType, u.context = typeof f == "object" && f !== null ? It(f) : hn, u.state = e.memoizedState, f = a.getDerivedStateFromProps, typeof f == "function" && (cr(
            e,
            a,
            f,
            l
          ), u.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (f = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), f !== u.state && co.enqueueReplaceState(
            u,
            u.state,
            null
          ), qn(e, l, u, r), Bn(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), l = !0;
        } else if (t === null) {
          u = e.stateNode;
          var y = e.memoizedProps, R = Ba(a, y);
          u.props = R;
          var Q = u.context, Z = a.contextType;
          f = hn, typeof Z == "object" && Z !== null && (f = It(Z));
          var V = a.getDerivedStateFromProps;
          Z = typeof V == "function" || typeof u.getSnapshotBeforeUpdate == "function", y = e.pendingProps !== y, Z || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (y || Q !== f) && $s(
            e,
            u,
            l,
            f
          ), Sa = !1;
          var L = e.memoizedState;
          u.state = L, qn(e, l, u, r), Bn(), Q = e.memoizedState, y || L !== Q || Sa ? (typeof V == "function" && (cr(
            e,
            a,
            V,
            l
          ), Q = e.memoizedState), (R = Sa || Is(
            e,
            a,
            R,
            l,
            L,
            Q,
            f
          )) ? (Z || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = l, e.memoizedState = Q), u.props = l, u.state = Q, u.context = f, l = R) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), l = !1);
        } else {
          u = e.stateNode, Ki(t, e), f = e.memoizedProps, Z = Ba(a, f), u.props = Z, V = e.pendingProps, L = u.context, Q = a.contextType, R = hn, typeof Q == "object" && Q !== null && (R = It(Q)), y = a.getDerivedStateFromProps, (Q = typeof y == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (f !== V || L !== R) && $s(
            e,
            u,
            l,
            R
          ), Sa = !1, L = e.memoizedState, u.state = L, qn(e, l, u, r), Bn();
          var dt = e.memoizedState;
          f !== V || L !== dt || Sa || t !== null && t.dependencies !== null && hl(t.dependencies) ? (typeof y == "function" && (cr(
            e,
            a,
            y,
            l
          ), dt = e.memoizedState), (Z = Sa || Is(
            e,
            a,
            Z,
            l,
            L,
            dt,
            R
          ) || t !== null && t.dependencies !== null && hl(t.dependencies)) ? (Q || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(l, dt, R), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
            l,
            dt,
            R
          )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || f === t.memoizedProps && L === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || f === t.memoizedProps && L === t.memoizedState || (e.flags |= 1024), e.memoizedProps = l, e.memoizedState = dt), u.props = l, u.state = dt, u.context = R, l = Z) : (typeof u.componentDidUpdate != "function" || f === t.memoizedProps && L === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || f === t.memoizedProps && L === t.memoizedState || (e.flags |= 1024), l = !1);
        }
        return u = l, Rl(t, e), l = (e.flags & 128) !== 0, u || l ? (u = e.stateNode, a = l && typeof a.getDerivedStateFromError != "function" ? null : u.render(), e.flags |= 1, t !== null && l ? (e.child = La(
          e,
          t.child,
          null,
          r
        ), e.child = La(
          e,
          null,
          a,
          r
        )) : $t(t, e, a, r), e.memoizedState = u.state, t = e.child) : t = Fe(
          t,
          e,
          r
        ), t;
      }
      function uc(t, e, a, l) {
        return Oe(), e.flags |= 256, $t(t, e, a, l), e.child;
      }
      function mr(t) {
        return { baseLanes: t, cachePool: is() };
      }
      function fr(t, e, a) {
        return t = t !== null ? t.childLanes & ~a : 0, e && (t |= _e), t;
      }
      function dc(t, e, a) {
        var l = e.pendingProps, r = !1, u = (e.flags & 128) !== 0, f;
        if ((f = u) || (f = t !== null && t.memoizedState === null ? !1 : (Bt.current & 2) !== 0), f && (r = !0, e.flags &= -129), f = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
          if (yt) {
            if (r ? pa(e) : ha(), (t = At) ? (t = fp(
              t,
              Ne
            ), t !== null && (e.memoizedState = {
              dehydrated: t,
              treeContext: xa !== null ? { id: Ve, overflow: Xe } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a = lu(t), a.return = e, e.child = a, te = e, At = null)) : t = null, t === null) throw ut(e);
            return Lr(t) ? e.lanes = 32 : e.lanes = 536870912, null;
          }
          var y = l.children;
          return l = l.fallback, r ? (ha(), r = e.mode, y = Hl(
            { mode: "hidden", children: y },
            r
          ), l = Ga(
            l,
            r,
            a,
            null
          ), y.return = e, l.return = e, y.sibling = l, e.child = y, l = e.child, l.memoizedState = mr(a), l.childLanes = fr(
            t,
            f,
            a
          ), e.memoizedState = mo, Qn(null, l)) : (pa(e), pr(e, y));
        }
        var R = t.memoizedState;
        if (R !== null && (y = R.dehydrated, y !== null)) {
          if (u)
            e.flags & 256 ? (pa(e), e.flags &= -257, e = hr(
              t,
              e,
              a
            )) : e.memoizedState !== null ? (ha(), e.child = t.child, e.flags |= 128, e = null) : (ha(), y = l.fallback, r = e.mode, l = Hl(
              { mode: "visible", children: l.children },
              r
            ), y = Ga(
              y,
              r,
              a,
              null
            ), y.flags |= 2, l.return = e, y.return = e, l.sibling = y, e.child = l, La(
              e,
              t.child,
              null,
              a
            ), l = e.child, l.memoizedState = mr(a), l.childLanes = fr(
              t,
              f,
              a
            ), e.memoizedState = mo, e = Qn(null, l));
          else if (pa(e), Lr(y))
            f = tp(y).digest, l = Error(s(419)), l.stack = "", l.digest = f, Rn({ value: l, source: null, stack: null }), e = hr(
              t,
              e,
              a
            );
          else if (Yt || nn(
            t,
            e,
            a,
            !1
          ), f = (a & t.childLanes) !== 0, Yt || f) {
            if (f = Tt, f !== null && (l = J(
              f,
              a
            ), l !== 0 && l !== R.retryLane))
              throw R.retryLane = l, Ua(t, l), ce(f, t, l), uo;
            Jr(y) || Gl(), e = hr(
              t,
              e,
              a
            );
          } else
            Jr(y) ? (e.flags |= 192, e.child = t.child, e = null) : (t = R.treeContext, le && (At = sp(
              y
            ), te = e, yt = !0, _a = null, Ne = !1, t !== null && $(e, t)), e = pr(
              e,
              l.children
            ), e.flags |= 4096);
          return e;
        }
        return r ? (ha(), y = l.fallback, r = e.mode, R = t.child, u = R.sibling, l = Pe(R, {
          mode: "hidden",
          children: l.children
        }), l.subtreeFlags = R.subtreeFlags & 65011712, u !== null ? y = Pe(
          u,
          y
        ) : (y = Ga(
          y,
          r,
          a,
          null
        ), y.flags |= 2), y.return = e, l.return = e, l.sibling = y, e.child = l, Qn(null, l), l = e.child, y = t.child.memoizedState, y === null ? y = mr(a) : (r = y.cachePool, r !== null ? (R = ta ? Ot._currentValue : Ot._currentValue2, r = r.parent !== R ? { parent: R, pool: R } : r) : r = is(), y = {
          baseLanes: y.baseLanes | a,
          cachePool: r
        }), l.memoizedState = y, l.childLanes = fr(
          t,
          f,
          a
        ), e.memoizedState = mo, Qn(t.child, l)) : (pa(e), a = t.child, t = a.sibling, a = Pe(a, {
          mode: "visible",
          children: l.children
        }), a.return = e, a.sibling = null, t !== null && (f = e.deletions, f === null ? (e.deletions = [t], e.flags |= 16) : f.push(t)), e.child = a, e.memoizedState = null, a);
      }
      function pr(t, e) {
        return e = Hl(
          { mode: "visible", children: e },
          t.mode
        ), e.return = t, t.child = e;
      }
      function Hl(t, e) {
        return t = o(22, t, null, e), t.lanes = 0, t;
      }
      function hr(t, e, a) {
        return La(e, t.child, null, a), t = pr(
          e,
          e.pendingProps.children
        ), t.flags |= 2, e.memoizedState = null, t;
      }
      function mc(t, e, a) {
        t.lanes |= e;
        var l = t.alternate;
        l !== null && (l.lanes |= e), Di(t.return, e, a);
      }
      function gr(t, e, a, l, r, u) {
        var f = t.memoizedState;
        f === null ? t.memoizedState = {
          isBackwards: e,
          rendering: null,
          renderingStartTime: 0,
          last: l,
          tail: a,
          tailMode: r,
          treeForkCount: u
        } : (f.isBackwards = e, f.rendering = null, f.renderingStartTime = 0, f.last = l, f.tail = a, f.tailMode = r, f.treeForkCount = u);
      }
      function fc(t, e, a) {
        var l = e.pendingProps, r = l.revealOrder, u = l.tail;
        l = l.children;
        var f = Bt.current, y = (f & 2) !== 0;
        if (y ? (f = f & 1 | 2, e.flags |= 128) : f &= 1, S(Bt, f), $t(t, e, l, a), l = yt ? Pn : 0, !y && t !== null && (t.flags & 128) !== 0)
          t: for (t = e.child; t !== null; ) {
            if (t.tag === 13)
              t.memoizedState !== null && mc(t, a, e);
            else if (t.tag === 19)
              mc(t, a, e);
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
        switch (r) {
          case "forwards":
            for (a = e.child, r = null; a !== null; )
              t = a.alternate, t !== null && kl(t) === null && (r = a), a = a.sibling;
            a = r, a === null ? (r = e.child, e.child = null) : (r = a.sibling, a.sibling = null), gr(
              e,
              !1,
              r,
              a,
              u,
              l
            );
            break;
          case "backwards":
          case "unstable_legacy-backwards":
            for (a = null, r = e.child, e.child = null; r !== null; ) {
              if (t = r.alternate, t !== null && kl(t) === null) {
                e.child = r;
                break;
              }
              t = r.sibling, r.sibling = a, a = r, r = t;
            }
            gr(
              e,
              !0,
              a,
              null,
              u,
              l
            );
            break;
          case "together":
            gr(
              e,
              !1,
              null,
              null,
              void 0,
              l
            );
            break;
          default:
            e.memoizedState = null;
        }
        return e.child;
      }
      function Fe(t, e, a) {
        if (t !== null && (e.dependencies = t.dependencies), ka |= e.lanes, (a & e.childLanes) === 0)
          if (t !== null) {
            if (nn(
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
          for (t = e.child, a = Pe(t, t.pendingProps), e.child = a, a.return = e; t.sibling !== null; )
            t = t.sibling, a = a.sibling = Pe(t, t.pendingProps), a.return = e;
          a.sibling = null;
        }
        return e.child;
      }
      function br(t, e) {
        return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && hl(t)));
      }
      function Xm(t, e, a) {
        switch (e.tag) {
          case 3:
            P(
              e,
              e.stateNode.containerInfo
            ), da(e, Ot, t.memoizedState.cache), Oe();
            break;
          case 27:
          case 5:
            xt(e);
            break;
          case 4:
            P(
              e,
              e.stateNode.containerInfo
            );
            break;
          case 10:
            da(
              e,
              e.type,
              e.memoizedProps.value
            );
            break;
          case 31:
            if (e.memoizedState !== null)
              return e.flags |= 128, Ji(e), null;
            break;
          case 13:
            var l = e.memoizedState;
            if (l !== null)
              return l.dehydrated !== null ? (pa(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? dc(
                t,
                e,
                a
              ) : (pa(e), t = Fe(
                t,
                e,
                a
              ), t !== null ? t.sibling : null);
            pa(e);
            break;
          case 19:
            var r = (t.flags & 128) !== 0;
            if (l = (a & e.childLanes) !== 0, l || (nn(
              t,
              e,
              a,
              !1
            ), l = (a & e.childLanes) !== 0), r) {
              if (l)
                return fc(
                  t,
                  e,
                  a
                );
              e.flags |= 128;
            }
            if (r = e.memoizedState, r !== null && (r.rendering = null, r.tail = null, r.lastEffect = null), S(Bt, Bt.current), l) break;
            return null;
          case 22:
            return e.lanes = 0, ic(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            da(e, Ot, t.memoizedState.cache);
        }
        return Fe(t, e, a);
      }
      function pc(t, e, a) {
        if (t !== null)
          if (t.memoizedProps !== e.pendingProps)
            Yt = !0;
          else {
            if (!br(t, a) && (e.flags & 128) === 0)
              return Yt = !1, Xm(
                t,
                e,
                a
              );
            Yt = (t.flags & 131072) !== 0;
          }
        else
          Yt = !1, yt && (e.flags & 1048576) !== 0 && v(e, Pn, e.index);
        switch (e.lanes = 0, e.tag) {
          case 16:
            t: {
              var l = e.pendingProps;
              if (t = Da(e.elementType), e.type = t, typeof t == "function")
                Rr(t) ? (l = Ba(t, l), e.tag = 1, e = cc(
                  null,
                  e,
                  t,
                  l,
                  a
                )) : (e.tag = 0, e = dr(
                  null,
                  e,
                  t,
                  l,
                  a
                ));
              else {
                if (t != null) {
                  var r = t.$$typeof;
                  if (r === Yr) {
                    e.tag = 11, e = ac(
                      null,
                      e,
                      t,
                      l,
                      a
                    );
                    break t;
                  } else if (r === Kr) {
                    e.tag = 14, e = nc(
                      null,
                      e,
                      t,
                      l,
                      a
                    );
                    break t;
                  }
                }
                throw e = D(t) || t, Error(s(306, e, ""));
              }
            }
            return e;
          case 0:
            return dr(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 1:
            return l = e.type, r = Ba(
              l,
              e.pendingProps
            ), cc(
              t,
              e,
              l,
              r,
              a
            );
          case 3:
            t: {
              if (P(
                e,
                e.stateNode.containerInfo
              ), t === null) throw Error(s(387));
              var u = e.pendingProps;
              r = e.memoizedState, l = r.element, Ki(t, e), qn(e, u, null, a);
              var f = e.memoizedState;
              if (u = f.cache, da(e, Ot, u), u !== r.cache && Ui(
                e,
                [Ot],
                a,
                !0
              ), Bn(), u = f.element, le && r.isDehydrated)
                if (r = {
                  element: u,
                  isDehydrated: !1,
                  cache: f.cache
                }, e.updateQueue.baseState = r, e.memoizedState = r, e.flags & 256) {
                  e = uc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else if (u !== l) {
                  l = U(
                    Error(s(424)),
                    e
                  ), Rn(l), e = uc(
                    t,
                    e,
                    u,
                    a
                  );
                  break t;
                } else
                  for (le && (At = rp(
                    e.stateNode.containerInfo
                  ), te = e, yt = !0, _a = null, Ne = !0), a = Gu(
                    e,
                    null,
                    u,
                    a
                  ), e.child = a; a; )
                    a.flags = a.flags & -3 | 4096, a = a.sibling;
              else {
                if (Oe(), u === l) {
                  e = Fe(
                    t,
                    e,
                    a
                  );
                  break t;
                }
                $t(t, e, u, a);
              }
              e = e.child;
            }
            return e;
          case 26:
            if (Ue)
              return Rl(t, e), t === null ? (a = Nu(
                e.type,
                null,
                e.pendingProps,
                null
              )) ? e.memoizedState = a : yt || (e.stateNode = Op(
                e.type,
                e.pendingProps,
                wa.current,
                e
              )) : e.memoizedState = Nu(
                e.type,
                t.memoizedProps,
                e.pendingProps,
                t.memoizedState
              ), null;
          case 27:
            if (Vt)
              return xt(e), t === null && Vt && yt && (l = e.stateNode = Ou(
                e.type,
                e.pendingProps,
                wa.current,
                Pt.current,
                !1
              ), te = e, Ne = !0, At = cp(
                e.type,
                l,
                At
              )), $t(
                t,
                e,
                e.pendingProps.children,
                a
              ), Rl(t, e), t === null && (e.flags |= 4194304), e.child;
          case 5:
            return t === null && yt && (jp(
              e.type,
              e.pendingProps,
              Pt.current
            ), (r = l = At) && (l = up(
              l,
              e.type,
              e.pendingProps,
              Ne
            ), l !== null ? (e.stateNode = l, te = e, At = ip(l), Ne = !1, r = !0) : r = !1), r || ut(e)), xt(e), r = e.type, u = e.pendingProps, f = t !== null ? t.memoizedProps : null, l = u.children, Zl(r, u) ? l = null : f !== null && Zl(r, f) && (e.flags |= 32), e.memoizedState !== null && (r = Wi(
              t,
              e,
              Um,
              null,
              null,
              a
            ), ta ? Ka._currentValue = r : Ka._currentValue2 = r), Rl(t, e), $t(t, e, l, a), e.child;
          case 6:
            return t === null && yt && (Mp(
              e.pendingProps,
              Pt.current
            ), (t = a = At) && (a = dp(
              a,
              e.pendingProps,
              Ne
            ), a !== null ? (e.stateNode = a, te = e, At = null, t = !0) : t = !1), t || ut(e)), null;
          case 13:
            return dc(t, e, a);
          case 4:
            return P(
              e,
              e.stateNode.containerInfo
            ), l = e.pendingProps, t === null ? e.child = La(
              e,
              null,
              l,
              a
            ) : $t(t, e, l, a), e.child;
          case 11:
            return ac(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 7:
            return $t(
              t,
              e,
              e.pendingProps,
              a
            ), e.child;
          case 8:
            return $t(
              t,
              e,
              e.pendingProps.children,
              a
            ), e.child;
          case 12:
            return $t(
              t,
              e,
              e.pendingProps.children,
              a
            ), e.child;
          case 10:
            return l = e.pendingProps, da(e, e.type, l.value), $t(
              t,
              e,
              l.children,
              a
            ), e.child;
          case 9:
            return r = e.type._context, l = e.pendingProps.children, Ha(e), r = It(r), l = l(r), e.flags |= 1, $t(t, e, l, a), e.child;
          case 14:
            return nc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 15:
            return lc(
              t,
              e,
              e.type,
              e.pendingProps,
              a
            );
          case 19:
            return fc(
              t,
              e,
              a
            );
          case 31:
            return Vm(t, e, a);
          case 22:
            return ic(
              t,
              e,
              a,
              e.pendingProps
            );
          case 24:
            return Ha(e), l = It(Ot), t === null ? (r = Yi(), r === null && (r = Tt, u = Bi(), r.pooledCache = u, u.refCount++, u !== null && (r.pooledCacheLanes |= a), r = u), e.memoizedState = {
              parent: l,
              cache: r
            }, Qi(e), da(e, Ot, r)) : ((t.lanes & a) !== 0 && (Ki(t, e), qn(e, null, null, a), Bn()), r = t.memoizedState, u = e.memoizedState, r.parent !== l ? (r = { parent: l, cache: l }, e.memoizedState = r, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = r), da(e, Ot, l)) : (l = u.cache, da(e, Ot, l), l !== r.cache && Ui(
              e,
              [Ot],
              a,
              !0
            ))), $t(
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
      function Re(t) {
        t.flags |= 4;
      }
      function Dl(t) {
        Ke && (t.flags |= 8);
      }
      function hc(t, e) {
        if (t !== null && t.child === e.child) return !1;
        if ((e.flags & 16) !== 0) return !0;
        for (t = e.child; t !== null; ) {
          if ((t.flags & 8218) !== 0 || (t.subtreeFlags & 8218) !== 0)
            return !0;
          t = t.sibling;
        }
        return !1;
      }
      function vr(t, e, a, l) {
        if (ne)
          for (a = e.child; a !== null; ) {
            if (a.tag === 5 || a.tag === 6)
              Xr(t, a.stateNode);
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
        else if (Ke)
          for (var r = e.child; r !== null; ) {
            if (r.tag === 5) {
              var u = r.stateNode;
              a && l && (u = _u(
                u,
                r.type,
                r.memoizedProps
              )), Xr(t, u);
            } else if (r.tag === 6)
              u = r.stateNode, a && l && (u = Su(
                u,
                r.memoizedProps
              )), Xr(t, u);
            else if (r.tag !== 4) {
              if (r.tag === 22 && r.memoizedState !== null)
                u = r.child, u !== null && (u.return = r), vr(t, r, !0, !0);
              else if (r.child !== null) {
                r.child.return = r, r = r.child;
                continue;
              }
            }
            if (r === e) break;
            for (; r.sibling === null; ) {
              if (r.return === null || r.return === e)
                return;
              r = r.return;
            }
            r.sibling.return = r.return, r = r.sibling;
          }
      }
      function gc(t, e, a, l) {
        var r = !1;
        if (Ke)
          for (var u = e.child; u !== null; ) {
            if (u.tag === 5) {
              var f = u.stateNode;
              a && l && (f = _u(
                f,
                u.type,
                u.memoizedProps
              )), xu(t, f);
            } else if (u.tag === 6)
              f = u.stateNode, a && l && (f = Su(
                f,
                u.memoizedProps
              )), xu(t, f);
            else if (u.tag !== 4) {
              if (u.tag === 22 && u.memoizedState !== null)
                r = u.child, r !== null && (r.return = u), gc(t, u, !0, !0), r = !0;
              else if (u.child !== null) {
                u.child.return = u, u = u.child;
                continue;
              }
            }
            if (u === e) break;
            for (; u.sibling === null; ) {
              if (u.return === null || u.return === e)
                return r;
              u = u.return;
            }
            u.sibling.return = u.return, u = u.sibling;
          }
        return r;
      }
      function bc(t, e) {
        if (Ke && hc(t, e)) {
          t = e.stateNode;
          var a = t.containerInfo, l = yu();
          gc(l, e, !1, !1), t.pendingChildren = l, Re(e), Pf(a, l);
        }
      }
      function yr(t, e, a, l) {
        if (ne)
          t.memoizedProps !== l && Re(e);
        else if (Ke) {
          var r = t.stateNode, u = t.memoizedProps;
          if ((t = hc(t, e)) || u !== l) {
            var f = Pt.current;
            u = $f(
              r,
              a,
              u,
              l,
              !t,
              null
            ), u === r ? e.stateNode = r : (Dl(e), pu(
              u,
              a,
              l,
              f
            ) && Re(e), e.stateNode = u, t && vr(u, e, !1, !1));
          } else e.stateNode = r;
        }
      }
      function xr(t, e, a, l, r) {
        if ((t.mode & 32) !== 0 && (a === null ? kf(e, l) : Ef(e, a, l))) {
          if (t.flags |= 16777216, (r & 335544128) === r || Zr(e, l))
            if (gu(t.stateNode, e, l))
              t.flags |= 8192;
            else if (Kc()) t.flags |= 8192;
            else
              throw Ja = ni, io;
        } else t.flags &= -16777217;
      }
      function vc(t, e) {
        if (Hp(e)) {
          if (t.flags |= 16777216, !Au(e))
            if (Kc()) t.flags |= 8192;
            else
              throw Ja = ni, io;
        } else t.flags &= -16777217;
      }
      function Ul(t, e) {
        e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? A() : 536870912, t.lanes |= e, Cn |= e);
      }
      function Kn(t, e) {
        if (!yt)
          switch (t.tailMode) {
            case "hidden":
              e = t.tail;
              for (var a = null; e !== null; )
                e.alternate !== null && (a = e), e = e.sibling;
              a === null ? t.tail = null : a.sibling = null;
              break;
            case "collapsed":
              a = t.tail;
              for (var l = null; a !== null; )
                a.alternate !== null && (l = a), a = a.sibling;
              l === null ? e || t.tail === null ? t.tail = null : t.tail.sibling = null : l.sibling = null;
          }
      }
      function jt(t) {
        var e = t.alternate !== null && t.alternate.child === t.child, a = 0, l = 0;
        if (e)
          for (var r = t.child; r !== null; )
            a |= r.lanes | r.childLanes, l |= r.subtreeFlags & 65011712, l |= r.flags & 65011712, r.return = t, r = r.sibling;
        else
          for (r = t.child; r !== null; )
            a |= r.lanes | r.childLanes, l |= r.subtreeFlags, l |= r.flags, r.return = t, r = r.sibling;
        return t.subtreeFlags |= l, t.childLanes = a, e;
      }
      function Zm(t, e, a) {
        var l = e.pendingProps;
        switch (tt(e), e.tag) {
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
            return a = e.stateNode, l = null, t !== null && (l = t.memoizedState.cache), e.memoizedState.cache !== l && (e.flags |= 2048), Le(Ot), lt(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (Ae(e) ? Re(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, ua())), bc(t, e), jt(e), null;
          case 26:
            if (Ue) {
              var r = e.type, u = e.memoizedState;
              return t === null ? (Re(e), u !== null ? (jt(e), vc(
                e,
                u
              )) : (jt(e), xr(
                e,
                r,
                null,
                l,
                a
              ))) : u ? u !== t.memoizedState ? (Re(e), jt(e), vc(
                e,
                u
              )) : (jt(e), e.flags &= -16777217) : (u = t.memoizedProps, ne ? u !== l && Re(e) : yr(
                t,
                e,
                r,
                l
              ), jt(e), xr(
                e,
                r,
                u,
                l,
                a
              )), null;
            }
          case 27:
            if (Vt) {
              if (Jt(e), a = wa.current, r = e.type, t !== null && e.stateNode != null)
                ne ? t.memoizedProps !== l && Re(e) : yr(t, e, r, l);
              else {
                if (!l) {
                  if (e.stateNode === null)
                    throw Error(s(166));
                  return jt(e), null;
                }
                t = Pt.current, Ae(e) ? Oa(e, t) : (t = Ou(
                  r,
                  l,
                  a,
                  t,
                  !0
                ), e.stateNode = t, Re(e));
              }
              return jt(e), null;
            }
          case 5:
            if (Jt(e), r = e.type, t !== null && e.stateNode != null)
              yr(t, e, r, l);
            else {
              if (!l) {
                if (e.stateNode === null)
                  throw Error(s(166));
                return jt(e), null;
              }
              if (u = Pt.current, Ae(e))
                Oa(e, u), zp(
                  e.stateNode,
                  r,
                  l,
                  u
                ) && (e.flags |= 64);
              else {
                var f = bf(
                  r,
                  l,
                  wa.current,
                  u,
                  e
                );
                Dl(e), vr(f, e, !1, !1), e.stateNode = f, pu(
                  f,
                  r,
                  l,
                  u
                ) && Re(e);
              }
            }
            return jt(e), xr(
              e,
              e.type,
              t === null ? null : t.memoizedProps,
              e.pendingProps,
              a
            ), null;
          case 6:
            if (t && e.stateNode != null)
              a = t.memoizedProps, ne ? a !== l && Re(e) : Ke && (a !== l ? (t = wa.current, a = Pt.current, Dl(e), e.stateNode = hu(
                l,
                t,
                a,
                e
              )) : e.stateNode = t.stateNode);
            else {
              if (typeof l != "string" && e.stateNode === null)
                throw Error(s(166));
              if (t = wa.current, a = Pt.current, Ae(e)) {
                if (!le) throw Error(s(176));
                if (t = e.stateNode, a = e.memoizedProps, l = null, r = te, r !== null)
                  switch (r.tag) {
                    case 27:
                    case 5:
                      l = r.memoizedProps;
                  }
                hp(
                  t,
                  a,
                  e,
                  l
                ) || ut(e, !0);
              } else
                Dl(e), e.stateNode = hu(
                  l,
                  t,
                  a,
                  e
                );
            }
            return jt(e), null;
          case 31:
            if (a = e.memoizedState, t === null || t.memoizedState !== null) {
              if (l = Ae(e), a !== null) {
                if (t === null) {
                  if (!l) throw Error(s(318));
                  if (!le) throw Error(s(556));
                  if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(557));
                  gp(t, e);
                } else
                  Oe(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), t = !1;
              } else
                a = ua(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = !0;
              if (!t)
                return e.flags & 256 ? (pe(e), e) : (pe(e), null);
              if ((e.flags & 128) !== 0)
                throw Error(s(558));
            }
            return jt(e), null;
          case 13:
            if (l = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
              if (r = Ae(e), l !== null && l.dehydrated !== null) {
                if (t === null) {
                  if (!r) throw Error(s(318));
                  if (!le) throw Error(s(344));
                  if (r = e.memoizedState, r = r !== null ? r.dehydrated : null, !r) throw Error(s(317));
                  bp(r, e);
                } else
                  Oe(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
                jt(e), r = !1;
              } else
                r = ua(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = r), r = !0;
              if (!r)
                return e.flags & 256 ? (pe(e), e) : (pe(e), null);
            }
            return pe(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = l !== null, t = t !== null && t.memoizedState !== null, a && (l = e.child, r = null, l.alternate !== null && l.alternate.memoizedState !== null && l.alternate.memoizedState.cachePool !== null && (r = l.alternate.memoizedState.cachePool.pool), u = null, l.memoizedState !== null && l.memoizedState.cachePool !== null && (u = l.memoizedState.cachePool.pool), u !== r && (l.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), Ul(e, e.updateQueue), jt(e), null);
          case 4:
            return lt(), bc(t, e), t === null && wf(e.stateNode.containerInfo), jt(e), null;
          case 10:
            return Le(e.type), jt(e), null;
          case 19:
            if (g(Bt), l = e.memoizedState, l === null) return jt(e), null;
            if (r = (e.flags & 128) !== 0, u = l.rendering, u === null)
              if (r) Kn(l, !1);
              else {
                if (Dt !== 0 || t !== null && (t.flags & 128) !== 0)
                  for (t = e.child; t !== null; ) {
                    if (u = kl(t), u !== null) {
                      for (e.flags |= 128, Kn(l, !1), t = u.updateQueue, e.updateQueue = t, Ul(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                        nu(a, t), a = a.sibling;
                      return S(
                        Bt,
                        Bt.current & 1 | 2
                      ), yt && B(e, l.treeForkCount), e.child;
                    }
                    t = t.sibling;
                  }
                l.tail !== null && ue() > ol && (e.flags |= 128, r = !0, Kn(l, !1), e.lanes = 4194304);
              }
            else {
              if (!r)
                if (t = kl(u), t !== null) {
                  if (e.flags |= 128, r = !0, t = t.updateQueue, e.updateQueue = t, Ul(e, t), Kn(l, !0), l.tail === null && l.tailMode === "hidden" && !u.alternate && !yt)
                    return jt(e), null;
                } else
                  2 * ue() - l.renderingStartTime > ol && a !== 536870912 && (e.flags |= 128, r = !0, Kn(l, !1), e.lanes = 4194304);
              l.isBackwards ? (u.sibling = e.child, e.child = u) : (t = l.last, t !== null ? t.sibling = u : e.child = u, l.last = u);
            }
            return l.tail !== null ? (t = l.tail, l.rendering = t, l.tail = t.sibling, l.renderingStartTime = ue(), t.sibling = null, a = Bt.current, S(
              Bt,
              r ? a & 1 | 2 : a & 1
            ), yt && B(e, l.treeForkCount), t) : (jt(e), null);
          case 22:
          case 23:
            return pe(e), Zi(), l = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== l && (e.flags |= 8192) : l && (e.flags |= 8192), l ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (jt(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : jt(e), a = e.updateQueue, a !== null && Ul(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), l = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (l = e.memoizedState.cachePool.pool), l !== a && (e.flags |= 2048), t !== null && g(Za), null;
          case 24:
            return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Le(Ot), jt(e), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(s(156, e.tag));
      }
      function Jm(t, e) {
        switch (tt(e), e.tag) {
          case 1:
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 3:
            return Le(Ot), lt(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
          case 26:
          case 27:
          case 5:
            return Jt(e), null;
          case 31:
            if (e.memoizedState !== null) {
              if (pe(e), e.alternate === null)
                throw Error(s(340));
              Oe();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 13:
            if (pe(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
              if (e.alternate === null)
                throw Error(s(340));
              Oe();
            }
            return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 19:
            return g(Bt), null;
          case 4:
            return lt(), null;
          case 10:
            return Le(e.type), null;
          case 22:
          case 23:
            return pe(e), Zi(), t !== null && g(Za), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
          case 24:
            return Le(Ot), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function yc(t, e) {
        switch (tt(e), e.tag) {
          case 3:
            Le(Ot), lt();
            break;
          case 26:
          case 27:
          case 5:
            Jt(e);
            break;
          case 4:
            lt();
            break;
          case 31:
            e.memoizedState !== null && pe(e);
            break;
          case 13:
            pe(e);
            break;
          case 19:
            g(Bt);
            break;
          case 10:
            Le(e.type);
            break;
          case 22:
          case 23:
            pe(e), Zi(), t !== null && g(Za);
            break;
          case 24:
            Le(Ot);
        }
      }
      function Vn(t, e) {
        try {
          var a = e.updateQueue, l = a !== null ? a.lastEffect : null;
          if (l !== null) {
            var r = l.next;
            a = r;
            do {
              if ((a.tag & t) === t) {
                l = void 0;
                var u = a.create, f = a.inst;
                l = u(), f.destroy = l;
              }
              a = a.next;
            } while (a !== r);
          }
        } catch (y) {
          wt(e, e.return, y);
        }
      }
      function ga(t, e, a) {
        try {
          var l = e.updateQueue, r = l !== null ? l.lastEffect : null;
          if (r !== null) {
            var u = r.next;
            l = u;
            do {
              if ((l.tag & t) === t) {
                var f = l.inst, y = f.destroy;
                if (y !== void 0) {
                  f.destroy = void 0, r = e;
                  var R = a, Q = y;
                  try {
                    Q();
                  } catch (Z) {
                    wt(
                      r,
                      R,
                      Z
                    );
                  }
                }
              }
              l = l.next;
            } while (l !== u);
          }
        } catch (Z) {
          wt(e, e.return, Z);
        }
      }
      function xc(t) {
        var e = t.updateQueue;
        if (e !== null) {
          var a = t.stateNode;
          try {
            fs(e, a);
          } catch (l) {
            wt(t, t.return, l);
          }
        }
      }
      function wc(t, e, a) {
        a.props = Ba(
          t.type,
          t.memoizedProps
        ), a.state = t.memoizedState;
        try {
          a.componentWillUnmount();
        } catch (l) {
          wt(t, e, l);
        }
      }
      function Xn(t, e) {
        try {
          var a = t.ref;
          if (a !== null) {
            switch (t.tag) {
              case 26:
              case 27:
              case 5:
                var l = Wn(t.stateNode);
                break;
              case 30:
                l = t.stateNode;
                break;
              default:
                l = t.stateNode;
            }
            typeof a == "function" ? t.refCleanup = a(l) : a.current = l;
          }
        } catch (r) {
          wt(t, e, r);
        }
      }
      function Qe(t, e) {
        var a = t.ref, l = t.refCleanup;
        if (a !== null)
          if (typeof l == "function")
            try {
              l();
            } catch (r) {
              wt(t, e, r);
            } finally {
              t.refCleanup = null, t = t.alternate, t != null && (t.refCleanup = null);
            }
          else if (typeof a == "function")
            try {
              a(null);
            } catch (r) {
              wt(t, e, r);
            }
          else a.current = null;
      }
      function _c(t) {
        var e = t.type, a = t.memoizedProps, l = t.stateNode;
        try {
          Gf(l, e, a, t);
        } catch (r) {
          wt(t, t.return, r);
        }
      }
      function wr(t, e, a) {
        try {
          Qf(
            t.stateNode,
            t.type,
            a,
            e,
            t
          );
        } catch (l) {
          wt(t, t.return, l);
        }
      }
      function Sc(t) {
        return t.tag === 5 || t.tag === 3 || (Ue ? t.tag === 26 : !1) || (Vt ? t.tag === 27 && fn(t.type) : !1) || t.tag === 4;
      }
      function _r(t) {
        t: for (; ; ) {
          for (; t.sibling === null; ) {
            if (t.return === null || Sc(t.return)) return null;
            t = t.return;
          }
          for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
            if (Vt && t.tag === 27 && fn(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
            t.child.return = t, t = t.child;
          }
          if (!(t.flags & 2)) return t.stateNode;
        }
      }
      function Sr(t, e, a) {
        var l = t.tag;
        if (l === 5 || l === 6)
          t = t.stateNode, e ? Vf(a, t, e) : qf(a, t);
        else if (l !== 4 && (Vt && l === 27 && fn(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
          for (Sr(t, e, a), t = t.sibling; t !== null; )
            Sr(t, e, a), t = t.sibling;
      }
      function Bl(t, e, a) {
        var l = t.tag;
        if (l === 5 || l === 6)
          t = t.stateNode, e ? Kf(a, t, e) : Bf(a, t);
        else if (l !== 4 && (Vt && l === 27 && fn(t.type) && (a = t.stateNode), t = t.child, t !== null))
          for (Bl(t, e, a), t = t.sibling; t !== null; )
            Bl(t, e, a), t = t.sibling;
      }
      function zc(t, e, a) {
        t = t.containerInfo;
        try {
          wu(t, a);
        } catch (l) {
          wt(e, e.return, l);
        }
      }
      function kc(t) {
        var e = t.stateNode, a = t.memoizedProps;
        try {
          Up(
            t.type,
            a,
            e,
            t
          );
        } catch (l) {
          wt(t, t.return, l);
        }
      }
      function Lm(t, e) {
        for (hf(t.containerInfo), Wt = e; Wt !== null; )
          if (t = Wt, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null)
            e.return = t, Wt = e;
          else
            for (; Wt !== null; ) {
              t = Wt;
              var a = t.alternate;
              switch (e = t.flags, t.tag) {
                case 0:
                  if ((e & 4) !== 0 && (e = t.updateQueue, e = e !== null ? e.events : null, e !== null))
                    for (var l = 0; l < e.length; l++) {
                      var r = e[l];
                      r.ref.impl = r.nextImpl;
                    }
                  break;
                case 11:
                case 15:
                  break;
                case 1:
                  if ((e & 1024) !== 0 && a !== null) {
                    e = void 0, l = t, r = a.memoizedProps, a = a.memoizedState;
                    var u = l.stateNode;
                    try {
                      var f = Ba(
                        l.type,
                        r
                      );
                      e = u.getSnapshotBeforeUpdate(
                        f,
                        a
                      ), u.__reactInternalSnapshotBeforeUpdate = e;
                    } catch (y) {
                      wt(l, l.return, y);
                    }
                  }
                  break;
                case 3:
                  (e & 1024) !== 0 && ne && If(t.stateNode.containerInfo);
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
                e.return = t.return, Wt = e;
                break;
              }
              Wt = t.return;
            }
      }
      function Ec(t, e, a) {
        var l = a.flags;
        switch (a.tag) {
          case 0:
          case 11:
          case 15:
            Ie(t, a), l & 4 && Vn(5, a);
            break;
          case 1:
            if (Ie(t, a), l & 4)
              if (t = a.stateNode, e === null)
                try {
                  t.componentDidMount();
                } catch (f) {
                  wt(a, a.return, f);
                }
              else {
                var r = Ba(
                  a.type,
                  e.memoizedProps
                );
                e = e.memoizedState;
                try {
                  t.componentDidUpdate(
                    r,
                    e,
                    t.__reactInternalSnapshotBeforeUpdate
                  );
                } catch (f) {
                  wt(
                    a,
                    a.return,
                    f
                  );
                }
              }
            l & 64 && xc(a), l & 512 && Xn(a, a.return);
            break;
          case 3:
            if (Ie(t, a), l & 64 && (l = a.updateQueue, l !== null)) {
              if (t = null, a.child !== null)
                switch (a.child.tag) {
                  case 27:
                  case 5:
                    t = Wn(a.child.stateNode);
                    break;
                  case 1:
                    t = a.child.stateNode;
                }
              try {
                fs(l, t);
              } catch (f) {
                wt(a, a.return, f);
              }
            }
            break;
          case 27:
            Vt && e === null && l & 4 && kc(a);
          case 26:
          case 5:
            if (Ie(t, a), e === null) {
              if (l & 4) _c(a);
              else if (l & 64) {
                t = a.type, e = a.memoizedProps, r = a.stateNode;
                try {
                  xp(
                    r,
                    t,
                    e,
                    a
                  );
                } catch (f) {
                  wt(a, a.return, f);
                }
              }
            }
            l & 512 && Xn(a, a.return);
            break;
          case 12:
            Ie(t, a);
            break;
          case 31:
            Ie(t, a), l & 4 && Tc(t, a);
            break;
          case 13:
            Ie(t, a), l & 4 && Cc(t, a), l & 64 && (l = a.memoizedState, l !== null && (l = l.dehydrated, l !== null && (a = ef.bind(
              null,
              a
            ), ep(l, a))));
            break;
          case 22:
            if (l = a.memoizedState !== null || la, !l) {
              e = e !== null && e.memoizedState !== null || Gt, r = la;
              var u = Gt;
              la = l, (Gt = e) && !u ? $e(
                t,
                a,
                (a.subtreeFlags & 8772) !== 0
              ) : Ie(t, a), la = r, Gt = u;
            }
            break;
          case 30:
            break;
          default:
            Ie(t, a);
        }
      }
      function Nc(t) {
        var e = t.alternate;
        e !== null && (t.alternate = null, Nc(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && zf(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
      }
      function He(t, e, a) {
        for (a = a.child; a !== null; )
          zr(
            t,
            e,
            a
          ), a = a.sibling;
      }
      function zr(t, e, a) {
        if (ve && typeof ve.onCommitFiberUnmount == "function")
          try {
            ve.onCommitFiberUnmount($n, a);
          } catch {
          }
        switch (a.tag) {
          case 26:
            if (Ue) {
              Gt || Qe(a, e), He(
                t,
                e,
                a
              ), a.memoizedState ? Cu(a.memoizedState) : a.stateNode && Mu(a.stateNode);
              break;
            }
          case 27:
            if (Vt) {
              Gt || Qe(a, e);
              var l = Qt, r = de;
              fn(a.type) && (Qt = a.stateNode, de = !1), He(
                t,
                e,
                a
              ), Ru(a.stateNode), Qt = l, de = r;
              break;
            }
          case 5:
            Gt || Qe(a, e);
          case 6:
            if (ne) {
              if (l = Qt, r = de, Qt = null, He(
                t,
                e,
                a
              ), Qt = l, de = r, Qt !== null)
                if (de)
                  try {
                    Zf(Qt, a.stateNode);
                  } catch (u) {
                    wt(
                      a,
                      e,
                      u
                    );
                  }
                else
                  try {
                    Xf(Qt, a.stateNode);
                  } catch (u) {
                    wt(
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
            ne && Qt !== null && (de ? Np(
              Qt,
              a.stateNode
            ) : Ep(Qt, a.stateNode));
            break;
          case 4:
            ne ? (l = Qt, r = de, Qt = a.stateNode.containerInfo, de = !0, He(
              t,
              e,
              a
            ), Qt = l, de = r) : (Ke && zc(
              a.stateNode,
              a,
              yu()
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
            ga(2, a, e), Gt || ga(4, a, e), He(
              t,
              e,
              a
            );
            break;
          case 1:
            Gt || (Qe(a, e), l = a.stateNode, typeof l.componentWillUnmount == "function" && wc(
              a,
              e,
              l
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
            Gt = (l = Gt) || a.memoizedState !== null, He(
              t,
              e,
              a
            ), Gt = l;
            break;
          default:
            He(
              t,
              e,
              a
            );
        }
      }
      function Tc(t, e) {
        if (le && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
          t = t.dehydrated;
          try {
            _p(t);
          } catch (a) {
            wt(e, e.return, a);
          }
        }
      }
      function Cc(t, e) {
        if (le && e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
          try {
            Sp(t);
          } catch (a) {
            wt(e, e.return, a);
          }
      }
      function Wm(t) {
        switch (t.tag) {
          case 31:
          case 13:
          case 19:
            var e = t.stateNode;
            return e === null && (e = t.stateNode = new Vu()), e;
          case 22:
            return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Vu()), e;
          default:
            throw Error(s(435, t.tag));
        }
      }
      function ql(t, e) {
        var a = Wm(t);
        e.forEach(function(l) {
          if (!a.has(l)) {
            a.add(l);
            var r = af.bind(null, t, l);
            l.then(r, r);
          }
        });
      }
      function ae(t, e) {
        var a = e.deletions;
        if (a !== null)
          for (var l = 0; l < a.length; l++) {
            var r = a[l], u = t, f = e;
            if (ne) {
              var y = f;
              t: for (; y !== null; ) {
                switch (y.tag) {
                  case 27:
                    if (Vt) {
                      if (fn(y.type)) {
                        Qt = y.stateNode, de = !1;
                        break t;
                      }
                      break;
                    }
                  case 5:
                    Qt = y.stateNode, de = !1;
                    break t;
                  case 3:
                  case 4:
                    Qt = y.stateNode.containerInfo, de = !0;
                    break t;
                }
                y = y.return;
              }
              if (Qt === null) throw Error(s(160));
              zr(u, f, r), Qt = null, de = !1;
            } else zr(u, f, r);
            u = r.alternate, u !== null && (u.return = null), r.return = null;
          }
        if (e.subtreeFlags & 13886)
          for (e = e.child; e !== null; )
            jc(e, t), e = e.sibling;
      }
      function jc(t, e) {
        var a = t.alternate, l = t.flags;
        switch (t.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            ae(e, t), se(t), l & 4 && (ga(3, t, t.return), Vn(3, t), ga(5, t, t.return));
            break;
          case 1:
            ae(e, t), se(t), l & 512 && (Gt || a === null || Qe(a, a.return)), l & 64 && la && (t = t.updateQueue, t !== null && (l = t.callbacks, l !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? l : a.concat(l))));
            break;
          case 26:
            if (Ue) {
              var r = Be;
              if (ae(e, t), se(t), l & 512 && (Gt || a === null || Qe(a, a.return)), l & 4) {
                l = a !== null ? a.memoizedState : null;
                var u = t.memoizedState;
                a === null ? u === null ? t.stateNode === null ? t.stateNode = Ap(
                  r,
                  t.type,
                  t.memoizedProps,
                  t
                ) : ju(
                  r,
                  t.type,
                  t.stateNode
                ) : t.stateNode = Tu(
                  r,
                  u,
                  t.memoizedProps
                ) : l !== u ? (l === null ? a.stateNode !== null && Mu(a.stateNode) : Cu(l), u === null ? ju(
                  r,
                  t.type,
                  t.stateNode
                ) : Tu(
                  r,
                  u,
                  t.memoizedProps
                )) : u === null && t.stateNode !== null && wr(
                  t,
                  t.memoizedProps,
                  a.memoizedProps
                );
              }
              break;
            }
          case 27:
            if (Vt) {
              ae(e, t), se(t), l & 512 && (Gt || a === null || Qe(a, a.return)), a !== null && l & 4 && wr(
                t,
                t.memoizedProps,
                a.memoizedProps
              );
              break;
            }
          case 5:
            if (ae(e, t), se(t), l & 512 && (Gt || a === null || Qe(a, a.return)), ne) {
              if (t.flags & 32) {
                r = t.stateNode;
                try {
                  vu(r);
                } catch (V) {
                  wt(t, t.return, V);
                }
              }
              l & 4 && t.stateNode != null && (r = t.memoizedProps, wr(
                t,
                r,
                a !== null ? a.memoizedProps : r
              )), l & 1024 && (fo = !0);
            } else
              Ke && t.alternate !== null && (t.alternate.stateNode = t.stateNode);
            break;
          case 6:
            if (ae(e, t), se(t), l & 4 && ne) {
              if (t.stateNode === null)
                throw Error(s(162));
              l = t.memoizedProps, a = a !== null ? a.memoizedProps : l, r = t.stateNode;
              try {
                Yf(r, a, l);
              } catch (V) {
                wt(t, t.return, V);
              }
            }
            break;
          case 3:
            if (Ue ? (Rp(), r = Be, Be = Wr(e.containerInfo), ae(e, t), Be = r) : ae(e, t), se(t), l & 4) {
              if (ne && le && a !== null && a.memoizedState.isDehydrated)
                try {
                  wp(e.containerInfo);
                } catch (V) {
                  wt(t, t.return, V);
                }
              if (Ke) {
                l = e.containerInfo, a = e.pendingChildren;
                try {
                  wu(l, a);
                } catch (V) {
                  wt(t, t.return, V);
                }
              }
            }
            fo && (fo = !1, Mc(t));
            break;
          case 4:
            Ue ? (a = Be, Be = Wr(
              t.stateNode.containerInfo
            ), ae(e, t), se(t), Be = a) : (ae(e, t), se(t)), l & 4 && Ke && zc(
              t.stateNode,
              t,
              t.stateNode.pendingChildren
            );
            break;
          case 12:
            ae(e, t), se(t);
            break;
          case 31:
            ae(e, t), se(t), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, ql(t, l)));
            break;
          case 13:
            ae(e, t), se(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (mi = ue()), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, ql(t, l)));
            break;
          case 22:
            r = t.memoizedState !== null;
            var f = a !== null && a.memoizedState !== null, y = la, R = Gt;
            if (la = y || r, Gt = R || f, ae(e, t), Gt = R, la = y, se(t), l & 8192 && (e = t.stateNode, e._visibility = r ? e._visibility & -2 : e._visibility | 1, r && (a === null || f || la || Gt || qa(t)), ne)) {
              t: if (a = null, ne)
                for (e = t; ; ) {
                  if (e.tag === 5 || Ue && e.tag === 26) {
                    if (a === null) {
                      f = a = e;
                      try {
                        u = f.stateNode, r ? Jf(u) : Wf(
                          f.stateNode,
                          f.memoizedProps
                        );
                      } catch (V) {
                        wt(f, f.return, V);
                      }
                    }
                  } else if (e.tag === 6) {
                    if (a === null) {
                      f = e;
                      try {
                        var Q = f.stateNode;
                        r ? Lf(Q) : Ff(Q, f.memoizedProps);
                      } catch (V) {
                        wt(f, f.return, V);
                      }
                    }
                  } else if (e.tag === 18) {
                    if (a === null) {
                      f = e;
                      try {
                        var Z = f.stateNode;
                        r ? Tp(Z) : Cp(f.stateNode);
                      } catch (V) {
                        wt(f, f.return, V);
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
            l & 4 && (l = t.updateQueue, l !== null && (a = l.retryQueue, a !== null && (l.retryQueue = null, ql(t, a))));
            break;
          case 19:
            ae(e, t), se(t), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, ql(t, l)));
            break;
          case 30:
            break;
          case 21:
            break;
          default:
            ae(e, t), se(t);
        }
      }
      function se(t) {
        var e = t.flags;
        if (e & 2) {
          try {
            for (var a, l = t.return; l !== null; ) {
              if (Sc(l)) {
                a = l;
                break;
              }
              l = l.return;
            }
            if (ne) {
              if (a == null) throw Error(s(160));
              switch (a.tag) {
                case 27:
                  if (Vt) {
                    var r = a.stateNode, u = _r(t);
                    Bl(t, u, r);
                    break;
                  }
                case 5:
                  var f = a.stateNode;
                  a.flags & 32 && (vu(f), a.flags &= -33);
                  var y = _r(t);
                  Bl(t, y, f);
                  break;
                case 3:
                case 4:
                  var R = a.stateNode.containerInfo, Q = _r(t);
                  Sr(
                    t,
                    Q,
                    R
                  );
                  break;
                default:
                  throw Error(s(161));
              }
            }
          } catch (Z) {
            wt(t, t.return, Z);
          }
          t.flags &= -3;
        }
        e & 4096 && (t.flags &= -4097);
      }
      function Mc(t) {
        if (t.subtreeFlags & 1024)
          for (t = t.child; t !== null; ) {
            var e = t;
            Mc(e), e.tag === 5 && e.flags & 1024 && Cf(e.stateNode), t = t.sibling;
          }
      }
      function Ie(t, e) {
        if (e.subtreeFlags & 8772)
          for (e = e.child; e !== null; )
            Ec(t, e.alternate, e), e = e.sibling;
      }
      function qa(t) {
        for (t = t.child; t !== null; ) {
          var e = t;
          switch (e.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              ga(4, e, e.return), qa(e);
              break;
            case 1:
              Qe(e, e.return);
              var a = e.stateNode;
              typeof a.componentWillUnmount == "function" && wc(
                e,
                e.return,
                a
              ), qa(e);
              break;
            case 27:
              Vt && Ru(e.stateNode);
            case 26:
            case 5:
              Qe(e, e.return), qa(e);
              break;
            case 22:
              e.memoizedState === null && qa(e);
              break;
            case 30:
              qa(e);
              break;
            default:
              qa(e);
          }
          t = t.sibling;
        }
      }
      function $e(t, e, a) {
        for (a = a && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
          var l = e.alternate, r = t, u = e, f = u.flags;
          switch (u.tag) {
            case 0:
            case 11:
            case 15:
              $e(
                r,
                u,
                a
              ), Vn(4, u);
              break;
            case 1:
              if ($e(
                r,
                u,
                a
              ), l = u, r = l.stateNode, typeof r.componentDidMount == "function")
                try {
                  r.componentDidMount();
                } catch (Q) {
                  wt(l, l.return, Q);
                }
              if (l = u, r = l.updateQueue, r !== null) {
                var y = l.stateNode;
                try {
                  var R = r.shared.hiddenCallbacks;
                  if (R !== null)
                    for (r.shared.hiddenCallbacks = null, r = 0; r < R.length; r++)
                      ms(R[r], y);
                } catch (Q) {
                  wt(l, l.return, Q);
                }
              }
              a && f & 64 && xc(u), Xn(u, u.return);
              break;
            case 27:
              Vt && kc(u);
            case 26:
            case 5:
              $e(
                r,
                u,
                a
              ), a && l === null && f & 4 && _c(u), Xn(u, u.return);
              break;
            case 12:
              $e(
                r,
                u,
                a
              );
              break;
            case 31:
              $e(
                r,
                u,
                a
              ), a && f & 4 && Tc(r, u);
              break;
            case 13:
              $e(
                r,
                u,
                a
              ), a && f & 4 && Cc(r, u);
              break;
            case 22:
              u.memoizedState === null && $e(
                r,
                u,
                a
              ), Xn(u, u.return);
              break;
            case 30:
              break;
            default:
              $e(
                r,
                u,
                a
              );
          }
          e = e.sibling;
        }
      }
      function kr(t, e) {
        var a = null;
        t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && Hn(a));
      }
      function Er(t, e) {
        t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Hn(t));
      }
      function De(t, e, a, l) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; )
            Ac(
              t,
              e,
              a,
              l
            ), e = e.sibling;
      }
      function Ac(t, e, a, l) {
        var r = e.flags;
        switch (e.tag) {
          case 0:
          case 11:
          case 15:
            De(
              t,
              e,
              a,
              l
            ), r & 2048 && Vn(9, e);
            break;
          case 1:
            De(
              t,
              e,
              a,
              l
            );
            break;
          case 3:
            De(
              t,
              e,
              a,
              l
            ), r & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Hn(t)));
            break;
          case 12:
            if (r & 2048) {
              De(
                t,
                e,
                a,
                l
              ), t = e.stateNode;
              try {
                var u = e.memoizedProps, f = u.id, y = u.onPostCommit;
                typeof y == "function" && y(
                  f,
                  e.alternate === null ? "mount" : "update",
                  t.passiveEffectDuration,
                  -0
                );
              } catch (R) {
                wt(e, e.return, R);
              }
            } else
              De(
                t,
                e,
                a,
                l
              );
            break;
          case 31:
            De(
              t,
              e,
              a,
              l
            );
            break;
          case 13:
            De(
              t,
              e,
              a,
              l
            );
            break;
          case 23:
            break;
          case 22:
            u = e.stateNode, f = e.alternate, e.memoizedState !== null ? u._visibility & 2 ? De(
              t,
              e,
              a,
              l
            ) : Zn(
              t,
              e
            ) : u._visibility & 2 ? De(
              t,
              e,
              a,
              l
            ) : (u._visibility |= 2, on(
              t,
              e,
              a,
              l,
              (e.subtreeFlags & 10256) !== 0 || !1
            )), r & 2048 && kr(f, e);
            break;
          case 24:
            De(
              t,
              e,
              a,
              l
            ), r & 2048 && Er(e.alternate, e);
            break;
          default:
            De(
              t,
              e,
              a,
              l
            );
        }
      }
      function on(t, e, a, l, r) {
        for (r = r && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
          var u = t, f = e, y = a, R = l, Q = f.flags;
          switch (f.tag) {
            case 0:
            case 11:
            case 15:
              on(
                u,
                f,
                y,
                R,
                r
              ), Vn(8, f);
              break;
            case 23:
              break;
            case 22:
              var Z = f.stateNode;
              f.memoizedState !== null ? Z._visibility & 2 ? on(
                u,
                f,
                y,
                R,
                r
              ) : Zn(
                u,
                f
              ) : (Z._visibility |= 2, on(
                u,
                f,
                y,
                R,
                r
              )), r && Q & 2048 && kr(
                f.alternate,
                f
              );
              break;
            case 24:
              on(
                u,
                f,
                y,
                R,
                r
              ), r && Q & 2048 && Er(f.alternate, f);
              break;
            default:
              on(
                u,
                f,
                y,
                R,
                r
              );
          }
          e = e.sibling;
        }
      }
      function Zn(t, e) {
        if (e.subtreeFlags & 10256)
          for (e = e.child; e !== null; ) {
            var a = t, l = e, r = l.flags;
            switch (l.tag) {
              case 22:
                Zn(a, l), r & 2048 && kr(
                  l.alternate,
                  l
                );
                break;
              case 24:
                Zn(a, l), r & 2048 && Er(
                  l.alternate,
                  l
                );
                break;
              default:
                Zn(a, l);
            }
            e = e.sibling;
          }
      }
      function Ya(t, e, a) {
        if (t.subtreeFlags & Nn)
          for (t = t.child; t !== null; )
            Oc(
              t,
              e,
              a
            ), t = t.sibling;
      }
      function Oc(t, e, a) {
        switch (t.tag) {
          case 26:
            if (Ya(
              t,
              e,
              a
            ), t.flags & Nn)
              if (t.memoizedState !== null)
                Dp(
                  a,
                  Be,
                  t.memoizedState,
                  t.memoizedProps
                );
              else {
                var l = t.stateNode, r = t.type;
                t = t.memoizedProps, ((e & 335544128) === e || Zr(r, t)) && bu(a, l, r, t);
              }
            break;
          case 5:
            Ya(
              t,
              e,
              a
            ), t.flags & Nn && (l = t.stateNode, r = t.type, t = t.memoizedProps, ((e & 335544128) === e || Zr(r, t)) && bu(a, l, r, t));
            break;
          case 3:
          case 4:
            Ue ? (l = Be, Be = Wr(
              t.stateNode.containerInfo
            ), Ya(
              t,
              e,
              a
            ), Be = l) : Ya(
              t,
              e,
              a
            );
            break;
          case 22:
            t.memoizedState === null && (l = t.alternate, l !== null && l.memoizedState !== null ? (l = Nn, Nn = 16777216, Ya(
              t,
              e,
              a
            ), Nn = l) : Ya(
              t,
              e,
              a
            ));
            break;
          default:
            Ya(
              t,
              e,
              a
            );
        }
      }
      function Rc(t) {
        var e = t.alternate;
        if (e !== null && (t = e.child, t !== null)) {
          e.child = null;
          do
            e = t.sibling, t.sibling = null, t = e;
          while (t !== null);
        }
      }
      function Jn(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var l = e[a];
              Wt = l, Dc(
                l,
                t
              );
            }
          Rc(t);
        }
        if (t.subtreeFlags & 10256)
          for (t = t.child; t !== null; )
            Hc(t), t = t.sibling;
      }
      function Hc(t) {
        switch (t.tag) {
          case 0:
          case 11:
          case 15:
            Jn(t), t.flags & 2048 && ga(9, t, t.return);
            break;
          case 3:
            Jn(t);
            break;
          case 12:
            Jn(t);
            break;
          case 22:
            var e = t.stateNode;
            t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, Yl(t)) : Jn(t);
            break;
          default:
            Jn(t);
        }
      }
      function Yl(t) {
        var e = t.deletions;
        if ((t.flags & 16) !== 0) {
          if (e !== null)
            for (var a = 0; a < e.length; a++) {
              var l = e[a];
              Wt = l, Dc(
                l,
                t
              );
            }
          Rc(t);
        }
        for (t = t.child; t !== null; ) {
          switch (e = t, e.tag) {
            case 0:
            case 11:
            case 15:
              ga(8, e, e.return), Yl(e);
              break;
            case 22:
              a = e.stateNode, a._visibility & 2 && (a._visibility &= -3, Yl(e));
              break;
            default:
              Yl(e);
          }
          t = t.sibling;
        }
      }
      function Dc(t, e) {
        for (; Wt !== null; ) {
          var a = Wt;
          switch (a.tag) {
            case 0:
            case 11:
            case 15:
              ga(8, a, e);
              break;
            case 23:
            case 22:
              if (a.memoizedState !== null && a.memoizedState.cachePool !== null) {
                var l = a.memoizedState.cachePool.pool;
                l != null && l.refCount++;
              }
              break;
            case 24:
              Hn(a.memoizedState.cache);
          }
          if (l = a.child, l !== null) l.return = a, Wt = l;
          else
            t: for (a = t; Wt !== null; ) {
              l = Wt;
              var r = l.sibling, u = l.return;
              if (Nc(l), l === a) {
                Wt = null;
                break t;
              }
              if (r !== null) {
                r.return = u, Wt = r;
                break t;
              }
              Wt = u;
            }
        }
      }
      function Nr(t) {
        var e = xf(t);
        if (e != null) {
          if (typeof e.memoizedProps["data-testname"] != "string")
            throw Error(s(364));
          return e;
        }
        if (t = Af(t), t === null) throw Error(s(362));
        return t.stateNode.current;
      }
      function Tr(t, e) {
        var a = t.tag;
        switch (e.$$typeof) {
          case oi:
            if (t.type === e.value) return !0;
            break;
          case si:
            t: {
              for (e = e.value, t = [t, 0], a = 0; a < t.length; ) {
                var l = t[a++], r = l.tag, u = t[a++], f = e[u];
                if (r !== 5 && r !== 26 && r !== 27 || !In(l)) {
                  for (; f != null && Tr(l, f); )
                    u++, f = e[u];
                  if (u === e.length) {
                    e = !0;
                    break t;
                  } else
                    for (l = l.child; l !== null; )
                      t.push(l, u), l = l.sibling;
                }
              }
              e = !1;
            }
            return e;
          case ci:
            if ((a === 5 || a === 26 || a === 27) && Hf(t.stateNode, e.value))
              return !0;
            break;
          case di:
            if ((a === 5 || a === 6 || a === 26 || a === 27) && (t = Rf(t), t !== null && 0 <= t.indexOf(e.value)))
              return !0;
            break;
          case ui:
            if ((a === 5 || a === 26 || a === 27) && (t = t.memoizedProps["data-testname"], typeof t == "string" && t.toLowerCase() === e.value.toLowerCase()))
              return !0;
            break;
          default:
            throw Error(s(365));
        }
        return !1;
      }
      function Cr(t) {
        switch (t.$$typeof) {
          case oi:
            return "<" + (D(t.value) || "Unknown") + ">";
          case si:
            return ":has(" + (Cr(t) || "") + ")";
          case ci:
            return '[role="' + t.value + '"]';
          case di:
            return '"' + t.value + '"';
          case ui:
            return '[data-testname="' + t.value + '"]';
          default:
            throw Error(s(365));
        }
      }
      function Uc(t, e) {
        var a = [];
        t = [t, 0];
        for (var l = 0; l < t.length; ) {
          var r = t[l++], u = r.tag, f = t[l++], y = e[f];
          if (u !== 5 && u !== 26 && u !== 27 || !In(r)) {
            for (; y != null && Tr(r, y); )
              f++, y = e[f];
            if (f === e.length) a.push(r);
            else
              for (r = r.child; r !== null; )
                t.push(r, f), r = r.sibling;
          }
        }
        return a;
      }
      function jr(t, e) {
        if (!Fn) throw Error(s(363));
        t = Nr(t), t = Uc(t, e), e = [], t = Array.from(t);
        for (var a = 0; a < t.length; ) {
          var l = t[a++], r = l.tag;
          if (r === 5 || r === 26 || r === 27)
            In(l) || e.push(l.stateNode);
          else
            for (l = l.child; l !== null; )
              t.push(l), l = l.sibling;
        }
        return e;
      }
      function he() {
        return (gt & 2) !== 0 && vt !== 0 ? vt & -vt : it.T !== null ? qi() : _f();
      }
      function Bc() {
        if (_e === 0)
          if ((vt & 536870912) === 0 || yt) {
            var t = Ll;
            Ll <<= 1, (Ll & 3932160) === 0 && (Ll = 262144), _e = t;
          } else _e = 536870912;
        return t = xe.current, t !== null && (t.flags |= 32), _e;
      }
      function ce(t, e, a) {
        (t === Tt && (kt === 2 || kt === 9) || t.cancelPendingCommit !== null) && (sn(t, 0), ba(
          t,
          vt,
          _e,
          !1
        )), C(t, a), ((gt & 2) === 0 || t !== Tt) && (t === Tt && ((gt & 2) === 0 && (Fa |= a), Dt === 4 && ba(
          t,
          vt,
          _e,
          !1
        )), Ge(t));
      }
      function qc(t, e, a) {
        if ((gt & 6) !== 0) throw Error(s(327));
        var l = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || E(t, e), r = l ? $m(t, e) : Ar(t, e, !0), u = l;
        do {
          if (r === 0) {
            Tn && !l && ba(t, e, 0, !1);
            break;
          } else {
            if (a = t.current.alternate, u && !Fm(a)) {
              r = Ar(t, e, !1), u = !1;
              continue;
            }
            if (r === 2) {
              if (u = e, t.errorRecoveryDisabledLanes & u)
                var f = 0;
              else
                f = t.pendingLanes & -536870913, f = f !== 0 ? f : f & 536870912 ? 536870912 : 0;
              if (f !== 0) {
                e = f;
                t: {
                  var y = t;
                  r = rl;
                  var R = le && y.current.memoizedState.isDehydrated;
                  if (R && (sn(y, f).flags |= 256), f = Ar(
                    y,
                    f,
                    !1
                  ), f !== 2) {
                    if (po && !R) {
                      y.errorRecoveryDisabledLanes |= u, Fa |= u, r = 4;
                      break t;
                    }
                    u = me, me = r, u !== null && (me === null ? me = u : me.push.apply(
                      me,
                      u
                    ));
                  }
                  r = f;
                }
                if (u = !1, r !== 2) continue;
              }
            }
            if (r === 1) {
              sn(t, 0), ba(t, e, 0, !0);
              break;
            }
            t: {
              switch (l = t, u = r, u) {
                case 0:
                case 1:
                  throw Error(s(345));
                case 4:
                  if ((e & 4194048) !== e) break;
                case 6:
                  ba(
                    l,
                    e,
                    _e,
                    !za
                  );
                  break t;
                case 2:
                  me = null;
                  break;
                case 3:
                case 5:
                  break;
                default:
                  throw Error(s(329));
              }
              if ((e & 62914560) === e && (r = mi + 300 - ue(), 10 < r)) {
                if (ba(
                  l,
                  e,
                  _e,
                  !za
                ), Y(l, 0, !0) !== 0) break t;
                ra = e, l.timeoutHandle = vf(
                  Yc.bind(
                    null,
                    l,
                    a,
                    me,
                    fi,
                    go,
                    e,
                    _e,
                    Fa,
                    Cn,
                    za,
                    u,
                    "Throttled",
                    -0,
                    0
                  ),
                  r
                );
                break t;
              }
              Yc(
                l,
                a,
                me,
                fi,
                go,
                e,
                _e,
                Fa,
                Cn,
                za,
                u,
                null,
                -0,
                0
              );
            }
          }
          break;
        } while (!0);
        Ge(t);
      }
      function Yc(t, e, a, l, r, u, f, y, R, Q, Z, V, L, dt) {
        if (t.timeoutHandle = Qa, V = e.subtreeFlags, V & 8192 || (V & 16785408) === 16785408) {
          V = Nf(), Oc(
            e,
            u,
            V
          );
          var ee = (u & 62914560) === u ? mi - ue() : (u & 4194048) === u ? Xu - ue() : 0;
          if (ee = Tf(
            V,
            ee
          ), ee !== null) {
            ra = u, t.cancelPendingCommit = ee(
              Wc.bind(
                null,
                t,
                e,
                u,
                a,
                l,
                r,
                f,
                y,
                R,
                Z,
                V,
                null,
                L,
                dt
              )
            ), ba(t, u, f, !Q);
            return;
          }
        }
        Wc(
          t,
          e,
          u,
          a,
          l,
          r,
          f,
          y,
          R
        );
      }
      function Fm(t) {
        for (var e = t; ; ) {
          var a = e.tag;
          if ((a === 0 || a === 11 || a === 15) && e.flags & 16384 && (a = e.updateQueue, a !== null && (a = a.stores, a !== null)))
            for (var l = 0; l < a.length; l++) {
              var r = a[l], u = r.getSnapshot;
              r = r.value;
              try {
                if (!ye(u(), r)) return !1;
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
      function ba(t, e, a, l) {
        e &= ~ho, e &= ~Fa, t.suspendedLanes |= e, t.pingedLanes &= ~e, l && (t.warmLanes |= e), l = t.expirationTimes;
        for (var r = e; 0 < r; ) {
          var u = 31 - be(r), f = 1 << u;
          l[u] = -1, r &= ~f;
        }
        a !== 0 && h(t, a, e);
      }
      function Gc() {
        return (gt & 6) === 0 ? (ln(0), !1) : !0;
      }
      function Mr() {
        if (bt !== null) {
          if (kt === 0)
            var t = bt.return;
          else
            t = bt, aa = Va = null, $i(t), _n = null, al = 0, t = bt;
          for (; t !== null; )
            yc(t.alternate, t), t = t.return;
          bt = null;
        }
      }
      function sn(t, e) {
        var a = t.timeoutHandle;
        a !== Qa && (t.timeoutHandle = Qa, yf(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), ra = 0, Mr(), Tt = t, bt = a = Pe(t.current, null), vt = e, kt = 0, we = null, za = !1, Tn = E(t, e), po = !1, Cn = _e = ho = Fa = ka = Dt = 0, me = rl = null, go = !1, (e & 8) !== 0 && (e |= e & 32);
        var l = t.entangledLanes;
        if (l !== 0)
          for (t = t.entanglements, l &= e; 0 < l; ) {
            var r = 31 - be(l), u = 1 << r;
            e |= t[r], l &= ~u;
          }
        return ia = e, _l(), a;
      }
      function Qc(t, e) {
        mt = null, it.H = ll, e === wn || e === ai ? (e = ss(), kt = 3) : e === io ? (e = ss(), kt = 4) : kt = e === uo ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, we = e, bt === null && (Dt = 1, Al(
          t,
          U(e, t.current)
        ));
      }
      function Kc() {
        var t = xe.current;
        return t === null ? !0 : (vt & 4194048) === vt ? Ce === null : (vt & 62914560) === vt || (vt & 536870912) !== 0 ? t === Ce : !1;
      }
      function Vc() {
        var t = it.H;
        return it.H = ll, t === null ? ll : t;
      }
      function Xc() {
        var t = it.A;
        return it.A = Ip, t;
      }
      function Gl() {
        Dt = 4, za || (vt & 4194048) !== vt && xe.current !== null || (Tn = !0), (ka & 134217727) === 0 && (Fa & 134217727) === 0 || Tt === null || ba(
          Tt,
          vt,
          _e,
          !1
        );
      }
      function Ar(t, e, a) {
        var l = gt;
        gt |= 2;
        var r = Vc(), u = Xc();
        (Tt !== t || vt !== e) && (fi = null, sn(t, e)), e = !1;
        var f = Dt;
        t: do
          try {
            if (kt !== 0 && bt !== null) {
              var y = bt, R = we;
              switch (kt) {
                case 8:
                  Mr(), f = 6;
                  break t;
                case 3:
                case 2:
                case 9:
                case 6:
                  xe.current === null && (e = !0);
                  var Q = kt;
                  if (kt = 0, we = null, cn(t, y, R, Q), a && Tn) {
                    f = 0;
                    break t;
                  }
                  break;
                default:
                  Q = kt, kt = 0, we = null, cn(t, y, R, Q);
              }
            }
            Im(), f = Dt;
            break;
          } catch (Z) {
            Qc(t, Z);
          }
        while (!0);
        return e && t.shellSuspendCounter++, aa = Va = null, gt = l, it.H = r, it.A = u, bt === null && (Tt = null, vt = 0, _l()), f;
      }
      function Im() {
        for (; bt !== null; ) Zc(bt);
      }
      function $m(t, e) {
        var a = gt;
        gt |= 2;
        var l = Vc(), r = Xc();
        Tt !== t || vt !== e ? (fi = null, ol = ue() + 500, sn(t, e)) : Tn = E(
          t,
          e
        );
        t: do
          try {
            if (kt !== 0 && bt !== null) {
              e = bt;
              var u = we;
              e: switch (kt) {
                case 1:
                  kt = 0, we = null, cn(t, e, u, 1);
                  break;
                case 2:
                case 9:
                  if (rs(u)) {
                    kt = 0, we = null, Jc(e);
                    break;
                  }
                  e = function() {
                    kt !== 2 && kt !== 9 || Tt !== t || (kt = 7), Ge(t);
                  }, u.then(e, e);
                  break t;
                case 3:
                  kt = 7;
                  break t;
                case 4:
                  kt = 5;
                  break t;
                case 7:
                  rs(u) ? (kt = 0, we = null, Jc(e)) : (kt = 0, we = null, cn(t, e, u, 7));
                  break;
                case 5:
                  var f = null;
                  switch (bt.tag) {
                    case 26:
                      f = bt.memoizedState;
                    case 5:
                    case 27:
                      var y = bt, R = y.type, Q = y.pendingProps;
                      if (f ? Au(f) : gu(y.stateNode, R, Q)) {
                        kt = 0, we = null;
                        var Z = y.sibling;
                        if (Z !== null) bt = Z;
                        else {
                          var V = y.return;
                          V !== null ? (bt = V, Ql(V)) : bt = null;
                        }
                        break e;
                      }
                  }
                  kt = 0, we = null, cn(t, e, u, 5);
                  break;
                case 6:
                  kt = 0, we = null, cn(t, e, u, 6);
                  break;
                case 8:
                  Mr(), Dt = 6;
                  break t;
                default:
                  throw Error(s(462));
              }
            }
            Pm();
            break;
          } catch (L) {
            Qc(t, L);
          }
        while (!0);
        return aa = Va = null, it.H = l, it.A = r, gt = a, bt !== null ? 0 : (Tt = null, vt = 0, _l(), Dt);
      }
      function Pm() {
        for (; bt !== null && !Yp(); )
          Zc(bt);
      }
      function Zc(t) {
        var e = pc(
          t.alternate,
          t,
          ia
        );
        t.memoizedProps = t.pendingProps, e === null ? Ql(t) : bt = e;
      }
      function Jc(t) {
        var e = t, a = e.alternate;
        switch (e.tag) {
          case 15:
          case 0:
            e = sc(
              a,
              e,
              e.pendingProps,
              e.type,
              void 0,
              vt
            );
            break;
          case 11:
            e = sc(
              a,
              e,
              e.pendingProps,
              e.type.render,
              e.ref,
              vt
            );
            break;
          case 5:
            $i(e);
          default:
            yc(a, e), e = bt = nu(e, ia), e = pc(a, e, ia);
        }
        t.memoizedProps = t.pendingProps, e === null ? Ql(t) : bt = e;
      }
      function cn(t, e, a, l) {
        aa = Va = null, $i(e), _n = null, al = 0;
        var r = e.return;
        try {
          if (Km(
            t,
            r,
            e,
            a,
            vt
          )) {
            Dt = 1, Al(
              t,
              U(a, t.current)
            ), bt = null;
            return;
          }
        } catch (u) {
          if (r !== null) throw bt = r, u;
          Dt = 1, Al(
            t,
            U(a, t.current)
          ), bt = null;
          return;
        }
        e.flags & 32768 ? (yt || l === 1 ? t = !0 : Tn || (vt & 536870912) !== 0 ? t = !1 : (za = t = !0, (l === 2 || l === 9 || l === 3 || l === 6) && (l = xe.current, l !== null && l.tag === 13 && (l.flags |= 16384))), Lc(e, t)) : Ql(e);
      }
      function Ql(t) {
        var e = t;
        do {
          if ((e.flags & 32768) !== 0) {
            Lc(
              e,
              za
            );
            return;
          }
          t = e.return;
          var a = Zm(
            e.alternate,
            e,
            ia
          );
          if (a !== null) {
            bt = a;
            return;
          }
          if (e = e.sibling, e !== null) {
            bt = e;
            return;
          }
          bt = e = t;
        } while (e !== null);
        Dt === 0 && (Dt = 5);
      }
      function Lc(t, e) {
        do {
          var a = Jm(t.alternate, t);
          if (a !== null) {
            a.flags &= 32767, bt = a;
            return;
          }
          if (a = t.return, a !== null && (a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null), !e && (t = t.sibling, t !== null)) {
            bt = t;
            return;
          }
          bt = t = a;
        } while (t !== null);
        Dt = 6, bt = null;
      }
      function Wc(t, e, a, l, r, u, f, y, R) {
        t.cancelPendingCommit = null;
        do
          Ln();
        while (Xt !== 0);
        if ((gt & 6) !== 0) throw Error(s(327));
        if (e !== null) {
          if (e === t.current)
            throw Error(s(177));
          if (u = e.lanes | e.childLanes, u |= ro, b(
            t,
            a,
            u,
            f,
            y,
            R
          ), t === Tt && (bt = Tt = null, vt = 0), jn = e, Na = t, ra = a, bo = u, vo = r, Zu = l, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, nf($r, function() {
            return tu(), null;
          })) : (t.callbackNode = null, t.callbackPriority = 0), l = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || l) {
            l = it.T, it.T = null, r = ea(), Lt(2), f = gt, gt |= 4;
            try {
              Lm(t, e, a);
            } finally {
              gt = f, Lt(r), it.T = l;
            }
          }
          Xt = 1, Fc(), Ic(), $c();
        }
      }
      function Fc() {
        if (Xt === 1) {
          Xt = 0;
          var t = Na, e = jn, a = (e.flags & 13878) !== 0;
          if ((e.subtreeFlags & 13878) !== 0 || a) {
            a = it.T, it.T = null;
            var l = ea();
            Lt(2);
            var r = gt;
            gt |= 4;
            try {
              jc(e, t), gf(t.containerInfo);
            } finally {
              gt = r, Lt(l), it.T = a;
            }
          }
          t.current = e, Xt = 2;
        }
      }
      function Ic() {
        if (Xt === 2) {
          Xt = 0;
          var t = Na, e = jn, a = (e.flags & 8772) !== 0;
          if ((e.subtreeFlags & 8772) !== 0 || a) {
            a = it.T, it.T = null;
            var l = ea();
            Lt(2);
            var r = gt;
            gt |= 4;
            try {
              Ec(t, e.alternate, e);
            } finally {
              gt = r, Lt(l), it.T = a;
            }
          }
          Xt = 3;
        }
      }
      function $c() {
        if (Xt === 4 || Xt === 3) {
          Xt = 0, Gp();
          var t = Na, e = jn, a = ra, l = Zu;
          (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Xt = 5 : (Xt = 0, jn = Na = null, Pc(t, t.pendingLanes));
          var r = t.pendingLanes;
          if (r === 0 && (Ea = null), ot(a), e = e.stateNode, ve && typeof ve.onCommitFiberRoot == "function")
            try {
              ve.onCommitFiberRoot(
                $n,
                e,
                void 0,
                (e.current.flags & 128) === 128
              );
            } catch {
            }
          if (l !== null) {
            e = it.T, r = ea(), Lt(2), it.T = null;
            try {
              for (var u = t.onRecoverableError, f = 0; f < l.length; f++) {
                var y = l[f];
                u(y.value, {
                  componentStack: y.stack
                });
              }
            } finally {
              it.T = e, Lt(r);
            }
          }
          (ra & 3) !== 0 && Ln(), Ge(t), r = t.pendingLanes, (a & 261930) !== 0 && (r & 42) !== 0 ? t === yo ? sl++ : (sl = 0, yo = t) : sl = 0, le && kp(), ln(0);
        }
      }
      function Pc(t, e) {
        (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Hn(e)));
      }
      function Ln() {
        return Fc(), Ic(), $c(), tu();
      }
      function tu() {
        if (Xt !== 5) return !1;
        var t = Na, e = bo;
        bo = 0;
        var a = ot(ra), l = 32 > a ? 32 : a;
        a = it.T;
        var r = ea();
        try {
          Lt(l), it.T = null, l = vo, vo = null;
          var u = Na, f = ra;
          if (Xt = 0, jn = Na = null, ra = 0, (gt & 6) !== 0)
            throw Error(s(331));
          var y = gt;
          if (gt |= 4, Hc(u.current), Ac(
            u,
            u.current,
            f,
            l
          ), gt = y, ln(0, !1), ve && typeof ve.onPostCommitFiberRoot == "function")
            try {
              ve.onPostCommitFiberRoot($n, u);
            } catch {
            }
          return !0;
        } finally {
          Lt(r), it.T = a, Pc(t, e);
        }
      }
      function eu(t, e, a) {
        e = U(a, e), e = ur(t.stateNode, e, 2), t = fa(t, e, 2), t !== null && (C(t, 2), Ge(t));
      }
      function wt(t, e, a) {
        if (t.tag === 3)
          eu(t, t, a);
        else
          for (; e !== null; ) {
            if (e.tag === 3) {
              eu(
                e,
                t,
                a
              );
              break;
            } else if (e.tag === 1) {
              var l = e.stateNode;
              if (typeof e.type.getDerivedStateFromError == "function" || typeof l.componentDidCatch == "function" && (Ea === null || !Ea.has(l))) {
                t = U(a, t), a = tc(2), l = fa(e, a, 2), l !== null && (ec(
                  a,
                  l,
                  e,
                  t
                ), C(l, 2), Ge(l));
                break;
              }
            }
            e = e.return;
          }
      }
      function Or(t, e, a) {
        var l = t.pingCache;
        if (l === null) {
          l = t.pingCache = new $p();
          var r = /* @__PURE__ */ new Set();
          l.set(e, r);
        } else
          r = l.get(e), r === void 0 && (r = /* @__PURE__ */ new Set(), l.set(e, r));
        r.has(a) || (po = !0, r.add(a), t = tf.bind(null, t, e, a), e.then(t, t));
      }
      function tf(t, e, a) {
        var l = t.pingCache;
        l !== null && l.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, Tt === t && (vt & a) === a && (Dt === 4 || Dt === 3 && (vt & 62914560) === vt && 300 > ue() - mi ? (gt & 2) === 0 && sn(t, 0) : ho |= a, Cn === vt && (Cn = 0)), Ge(t);
      }
      function au(t, e) {
        e === 0 && (e = A()), t = Ua(t, e), t !== null && (C(t, e), Ge(t));
      }
      function ef(t) {
        var e = t.memoizedState, a = 0;
        e !== null && (a = e.retryLane), au(t, a);
      }
      function af(t, e) {
        var a = 0;
        switch (t.tag) {
          case 31:
          case 13:
            var l = t.stateNode, r = t.memoizedState;
            r !== null && (a = r.retryLane);
            break;
          case 19:
            l = t.stateNode;
            break;
          case 22:
            l = t.stateNode._retryCache;
            break;
          default:
            throw Error(s(314));
        }
        l !== null && l.delete(e), au(t, a);
      }
      function nf(t, e) {
        return Fl(t, e);
      }
      function lf(t, e, a, l) {
        this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = l, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function Rr(t) {
        return t = t.prototype, !(!t || !t.isReactComponent);
      }
      function Pe(t, e) {
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
      function nu(t, e) {
        t.flags &= 65011714;
        var a = t.alternate;
        return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
          lanes: e.lanes,
          firstContext: e.firstContext
        }), t;
      }
      function Kl(t, e, a, l, r, u) {
        var f = 0;
        if (l = t, typeof t == "function") Rr(t) && (f = 1);
        else if (typeof t == "string")
          f = Ue && Vt ? Eu(t, a, Pt.current) ? 26 : Hu(t) ? 27 : 5 : Ue ? Eu(
            t,
            a,
            Pt.current
          ) ? 26 : 5 : Vt && Hu(t) ? 27 : 5;
        else
          t: switch (t) {
            case Vr:
              return t = o(31, a, e, r), t.elementType = Vr, t.lanes = u, t;
            case dn:
              return Ga(
                a.children,
                r,
                u,
                e
              );
            case uu:
              f = 8, r |= 24;
              break;
            case qr:
              return t = o(12, a, e, r | 2), t.elementType = qr, t.lanes = u, t;
            case Gr:
              return t = o(13, a, e, r), t.elementType = Gr, t.lanes = u, t;
            case Qr:
              return t = o(19, a, e, r), t.elementType = Qr, t.lanes = u, t;
            default:
              if (typeof t == "object" && t !== null)
                switch (t.$$typeof) {
                  case va:
                    f = 10;
                    break t;
                  case du:
                    f = 9;
                    break t;
                  case Yr:
                    f = 11;
                    break t;
                  case Kr:
                    f = 14;
                    break t;
                  case ya:
                    f = 16, l = null;
                    break t;
                }
              f = 29, a = Error(
                s(
                  130,
                  t === null ? "null" : typeof t,
                  ""
                )
              ), l = null;
          }
        return e = o(f, a, e, r), e.elementType = t, e.type = l, e.lanes = u, e;
      }
      function Ga(t, e, a, l) {
        return t = o(7, t, l, e), t.lanes = a, t;
      }
      function Hr(t, e, a) {
        return t = o(6, t, null, e), t.lanes = a, t;
      }
      function lu(t) {
        var e = o(18, null, null, 0);
        return e.stateNode = t, e;
      }
      function Dr(t, e, a) {
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
      function rf(t, e, a, l, r, u, f, y, R) {
        this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Qa, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = H(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = H(0), this.hiddenUpdates = H(null), this.identifierPrefix = l, this.onUncaughtError = r, this.onCaughtError = u, this.onRecoverableError = f, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = R, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function iu(t, e, a, l, r, u, f, y, R, Q, Z, V) {
        return t = new rf(
          t,
          e,
          a,
          f,
          R,
          Q,
          Z,
          V,
          y
        ), e = 1, u === !0 && (e |= 24), u = o(3, null, null, e), t.current = u, u.stateNode = t, e = Bi(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
          element: l,
          isDehydrated: a,
          cache: e
        }, Qi(u), t;
      }
      function ru(t) {
        return t ? (t = hn, t) : hn;
      }
      function ou(t) {
        var e = t._reactInternals;
        if (e === void 0)
          throw typeof t.render == "function" ? Error(s(188)) : (t = Object.keys(t).join(","), Error(s(268, t)));
        return t = m(e), t = t !== null ? x(t) : null, t === null ? null : Wn(t.stateNode);
      }
      function su(t, e, a, l, r, u) {
        r = ru(r), l.context === null ? l.context = r : l.pendingContext = r, l = ma(e), l.payload = { element: a }, u = u === void 0 ? null : u, u !== null && (l.callback = u), a = fa(t, l, e), a !== null && (ce(a, t, e), Un(a, t, e));
      }
      function cu(t, e) {
        if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
          var a = t.retryLane;
          t.retryLane = a !== 0 && a < e ? a : e;
        }
      }
      function Ur(t, e) {
        cu(t, e), (t = t.alternate) && cu(t, e);
      }
      var ht = {}, of = Vd(), ge = Sh(), Br = Object.assign, sf = Symbol.for("react.element"), Vl = Symbol.for("react.transitional.element"), un = Symbol.for("react.portal"), dn = Symbol.for("react.fragment"), uu = Symbol.for("react.strict_mode"), qr = Symbol.for("react.profiler"), du = Symbol.for("react.consumer"), va = Symbol.for("react.context"), Yr = Symbol.for("react.forward_ref"), Gr = Symbol.for("react.suspense"), Qr = Symbol.for("react.suspense_list"), Kr = Symbol.for("react.memo"), ya = Symbol.for("react.lazy"), Vr = Symbol.for("react.activity"), cf = Symbol.for("react.memo_cache_sentinel"), mu = Symbol.iterator, uf = Symbol.for("react.client.reference"), Xl = Array.isArray, it = of.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, df = i.rendererVersion, mf = i.rendererPackageName, fu = i.extraDevToolsConfig, Wn = i.getPublicInstance, ff = i.getRootHostContext, pf = i.getChildHostContext, hf = i.prepareForCommit, gf = i.resetAfterCommit, bf = i.createInstance;
      i.cloneMutableInstance;
      var Xr = i.appendInitialChild, pu = i.finalizeInitialChildren, Zl = i.shouldSetTextContent, hu = i.createTextInstance;
      i.cloneMutableTextInstance;
      var vf = i.scheduleTimeout, yf = i.cancelTimeout, Qa = i.noTimeout, ta = i.isPrimaryRenderer;
      i.warnsIfNotActing;
      var ne = i.supportsMutation, Ke = i.supportsPersistence, le = i.supportsHydration, xf = i.getInstanceFromNode;
      i.beforeActiveInstanceBlur;
      var wf = i.preparePortalMount;
      i.prepareScopeUpdate, i.getInstanceFromScope;
      var Lt = i.setCurrentUpdatePriority, ea = i.getCurrentUpdatePriority, _f = i.resolveUpdatePriority;
      i.trackSchedulerEvent, i.resolveEventType, i.resolveEventTimeStamp;
      var Sf = i.shouldAttemptEagerTransition, zf = i.detachDeletedInstance;
      i.requestPostPaintCallback;
      var kf = i.maySuspendCommit, Ef = i.maySuspendCommitOnUpdate, Zr = i.maySuspendCommitInSyncRender, gu = i.preloadInstance, Nf = i.startSuspendingCommit, bu = i.suspendInstance;
      i.suspendOnActiveViewTransition;
      var Tf = i.waitForCommitToBeReady;
      i.getSuspendedCommitReason;
      var mn = i.NotPendingTransition, Ka = i.HostTransitionContext, Cf = i.resetFormInstance;
      i.bindToConsole;
      var jf = i.supportsMicrotasks, Mf = i.scheduleMicrotask, Fn = i.supportsTestSelectors, Af = i.findFiberRoot, Of = i.getBoundingRect, Rf = i.getTextContent, In = i.isHiddenSubtree, Hf = i.matchAccessibilityRole, Df = i.setFocusIfFocusable, Uf = i.setupIntersectionObserver, Bf = i.appendChild, qf = i.appendChildToContainer, Yf = i.commitTextUpdate, Gf = i.commitMount, Qf = i.commitUpdate, Kf = i.insertBefore, Vf = i.insertInContainerBefore, Xf = i.removeChild, Zf = i.removeChildFromContainer, vu = i.resetTextContent, Jf = i.hideInstance, Lf = i.hideTextInstance, Wf = i.unhideInstance, Ff = i.unhideTextInstance;
      i.cancelViewTransitionName, i.cancelRootViewTransitionName, i.restoreRootViewTransitionName, i.cloneRootViewTransitionContainer, i.removeRootViewTransitionClone, i.measureClonedInstance, i.hasInstanceChanged, i.hasInstanceAffectedParent, i.startViewTransition, i.startGestureTransition, i.stopViewTransition, i.getCurrentGestureOffset, i.createViewTransitionInstance;
      var If = i.clearContainer;
      i.createFragmentInstance, i.updateFragmentInstanceFiber, i.commitNewChildToFragmentInstance, i.deleteChildFromFragmentInstance;
      var $f = i.cloneInstance, yu = i.createContainerChildSet, xu = i.appendChildToContainerChildSet, Pf = i.finalizeContainerChildren, wu = i.replaceContainerChildren, _u = i.cloneHiddenInstance, Su = i.cloneHiddenTextInstance, Jr = i.isSuspenseInstancePending, Lr = i.isSuspenseInstanceFallback, tp = i.getSuspenseInstanceFallbackErrorDetails, ep = i.registerSuspenseInstanceRetry, ap = i.canHydrateFormStateMarker, np = i.isFormStateMarkerMatching, zu = i.getNextHydratableSibling, lp = i.getNextHydratableSiblingAfterSingleton, ip = i.getFirstHydratableChild, rp = i.getFirstHydratableChildWithinContainer, op = i.getFirstHydratableChildWithinActivityInstance, sp = i.getFirstHydratableChildWithinSuspenseInstance, cp = i.getFirstHydratableChildWithinSingleton, up = i.canHydrateInstance, dp = i.canHydrateTextInstance, mp = i.canHydrateActivityInstance, fp = i.canHydrateSuspenseInstance, pp = i.hydrateInstance, hp = i.hydrateTextInstance, gp = i.hydrateActivityInstance, bp = i.hydrateSuspenseInstance, vp = i.getNextHydratableInstanceAfterActivityInstance, yp = i.getNextHydratableInstanceAfterSuspenseInstance, xp = i.commitHydratedInstance, wp = i.commitHydratedContainer, _p = i.commitHydratedActivityInstance, Sp = i.commitHydratedSuspenseInstance, zp = i.finalizeHydratedChildren, kp = i.flushHydrationEvents;
      i.clearActivityBoundary;
      var Ep = i.clearSuspenseBoundary;
      i.clearActivityBoundaryFromContainer;
      var Np = i.clearSuspenseBoundaryFromContainer, Tp = i.hideDehydratedBoundary, Cp = i.unhideDehydratedBoundary, ku = i.shouldDeleteUnhydratedTailInstances;
      i.diffHydratedPropsForDevWarnings, i.diffHydratedTextForDevWarnings, i.describeHydratableInstanceForDevWarnings;
      var jp = i.validateHydratableInstance, Mp = i.validateHydratableTextInstance, Ue = i.supportsResources, Eu = i.isHostHoistableType, Wr = i.getHoistableRoot, Nu = i.getResource, Tu = i.acquireResource, Cu = i.releaseResource, Ap = i.hydrateHoistable, ju = i.mountHoistable, Mu = i.unmountHoistable, Op = i.createHoistableInstance, Rp = i.prepareToCommitHoistables, Hp = i.mayResourceSuspendCommit, Au = i.preloadResource, Dp = i.suspendResource, Vt = i.supportsSingletons, Ou = i.resolveSingletonInstance, Up = i.acquireSingletonInstance, Ru = i.releaseSingletonInstance, Hu = i.isHostSingletonType, fn = i.isSingletonScope, Fr = [], pn = -1, hn = {}, be = Math.clz32 ? Math.clz32 : _, Bp = Math.log, qp = Math.LN2, Jl = 256, Ll = 262144, Wl = 4194304, Fl = ge.unstable_scheduleCallback, Ir = ge.unstable_cancelCallback, Yp = ge.unstable_shouldYield, Gp = ge.unstable_requestPaint, ue = ge.unstable_now, Du = ge.unstable_ImmediatePriority, Qp = ge.unstable_UserBlockingPriority, $r = ge.unstable_NormalPriority, Kp = ge.unstable_IdlePriority, Vp = ge.log, Xp = ge.unstable_setDisableYieldValue, $n = null, ve = null, ye = typeof Object.is == "function" ? Object.is : Kt, Uu = typeof reportError == "function" ? reportError : function(t) {
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
      }, Zp = Object.prototype.hasOwnProperty, Pr, Bu, to = !1, qu = /* @__PURE__ */ new WeakMap(), gn = [], bn = 0, Il = null, Pn = 0, ke = [], Ee = 0, xa = null, Ve = 1, Xe = "", Pt = k(null), tl = k(null), wa = k(null), $l = k(null), te = null, At = null, yt = !1, _a = null, Ne = !1, eo = Error(s(519)), Pl = k(null), Va = null, aa = null, Jp = typeof AbortController < "u" ? AbortController : function() {
        var t = [], e = this.signal = {
          aborted: !1,
          addEventListener: function(a, l) {
            t.push(l);
          }
        };
        this.abort = function() {
          e.aborted = !0, t.forEach(function(a) {
            return a();
          });
        };
      }, Lp = ge.unstable_scheduleCallback, Wp = ge.unstable_NormalPriority, Ot = {
        $$typeof: va,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, ti = null, vn = null, ao = !1, ei = !1, no = !1, Xa = 0, el = null, lo = 0, yn = 0, xn = null, Yu = it.S;
      it.S = function(t, e) {
        Xu = ue(), typeof e == "object" && e !== null && typeof e.then == "function" && Hm(t, e), Yu !== null && Yu(t, e);
      };
      var Za = k(null), wn = Error(s(460)), io = Error(s(474)), ai = Error(s(542)), ni = { then: function() {
      } }, Ja = null, _n = null, al = 0, La = us(!0), Gu = us(!1), Te = [], Sn = 0, ro = 0, Sa = !1, oo = !1, zn = k(null), li = k(0), xe = k(null), Ce = null, Bt = k(0), na = 0, mt = null, Et = null, qt = null, ii = !1, kn = !1, Wa = !1, ri = 0, nl = 0, En = null, Fp = 0, ll = {
        readContext: It,
        use: Nl,
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
      ll.useEffectEvent = Ht;
      var Qu = {
        readContext: It,
        use: Nl,
        useCallback: function(t, e) {
          return oe().memoizedState = [
            t,
            e === void 0 ? null : e
          ], t;
        },
        useContext: It,
        useEffect: Hs,
        useImperativeHandle: function(t, e, a) {
          a = a != null ? a.concat([t]) : null, Cl(
            4194308,
            4,
            qs.bind(null, e, t),
            a
          );
        },
        useLayoutEffect: function(t, e) {
          return Cl(4194308, 4, t, e);
        },
        useInsertionEffect: function(t, e) {
          Cl(4, 2, t, e);
        },
        useMemo: function(t, e) {
          var a = oe();
          e = e === void 0 ? null : e;
          var l = t();
          if (Wa) {
            Mt(!0);
            try {
              t();
            } finally {
              Mt(!1);
            }
          }
          return a.memoizedState = [l, e], l;
        },
        useReducer: function(t, e, a) {
          var l = oe();
          if (a !== void 0) {
            var r = a(e);
            if (Wa) {
              Mt(!0);
              try {
                a(e);
              } finally {
                Mt(!1);
              }
            }
          } else r = e;
          return l.memoizedState = l.baseState = r, t = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t,
            lastRenderedState: r
          }, l.queue = t, t = t.dispatch = Qm.bind(
            null,
            mt,
            t
          ), [l.memoizedState, t];
        },
        useRef: function(t) {
          var e = oe();
          return t = { current: t }, e.memoizedState = t;
        },
        useState: function(t) {
          t = ar(t);
          var e = t.queue, a = Ls.bind(
            null,
            mt,
            e
          );
          return e.dispatch = a, [t.memoizedState, a];
        },
        useDebugValue: ir,
        useDeferredValue: function(t, e) {
          var a = oe();
          return rr(a, t, e);
        },
        useTransition: function() {
          var t = ar(!1);
          return t = Vs.bind(
            null,
            mt,
            t.queue,
            !0,
            !1
          ), oe().memoizedState = t, [!1, t];
        },
        useSyncExternalStore: function(t, e, a) {
          var l = mt, r = oe();
          if (yt) {
            if (a === void 0)
              throw Error(s(407));
            a = a();
          } else {
            if (a = e(), Tt === null)
              throw Error(s(349));
            (vt & 127) !== 0 || ys(l, e, a);
          }
          r.memoizedState = a;
          var u = { value: a, getSnapshot: e };
          return r.queue = u, Hs(ws.bind(null, l, u, t), [
            t
          ]), l.flags |= 2048, rn(
            9,
            { destroy: void 0 },
            xs.bind(
              null,
              l,
              u,
              a,
              e
            ),
            null
          ), a;
        },
        useId: function() {
          var t = oe(), e = Tt.identifierPrefix;
          if (yt) {
            var a = Xe, l = Ve;
            a = (l & ~(1 << 32 - be(l) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = ri++, 0 < a && (e += "H" + a.toString(32)), e += "_";
          } else
            a = Fp++, e = "_" + e + "r_" + a.toString(32) + "_";
          return t.memoizedState = e;
        },
        useHostTransitionStatus: or,
        useFormState: js,
        useActionState: js,
        useOptimistic: function(t) {
          var e = oe();
          e.memoizedState = e.baseState = t;
          var a = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: null,
            lastRenderedState: null
          };
          return e.queue = a, e = sr.bind(
            null,
            mt,
            !0,
            a
          ), a.dispatch = e, [t, e];
        },
        useMemoCache: Pi,
        useCacheRefresh: function() {
          return oe().memoizedState = Gm.bind(
            null,
            mt
          );
        },
        useEffectEvent: function(t) {
          var e = oe(), a = { impl: t };
          return e.memoizedState = a, function() {
            if ((gt & 2) !== 0)
              throw Error(s(440));
            return a.impl.apply(void 0, arguments);
          };
        }
      }, so = {
        readContext: It,
        use: Nl,
        useCallback: Gs,
        useContext: It,
        useEffect: lr,
        useImperativeHandle: Ys,
        useInsertionEffect: Us,
        useLayoutEffect: Bs,
        useMemo: Qs,
        useReducer: Tl,
        useRef: Rs,
        useState: function() {
          return Tl(We);
        },
        useDebugValue: ir,
        useDeferredValue: function(t, e) {
          var a = Ut();
          return Ks(
            a,
            Et.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = Tl(We)[0], e = Ut().memoizedState;
          return [
            typeof t == "boolean" ? t : Yn(t),
            e
          ];
        },
        useSyncExternalStore: vs,
        useId: Zs,
        useHostTransitionStatus: or,
        useFormState: Ms,
        useActionState: Ms,
        useOptimistic: function(t, e) {
          var a = Ut();
          return zs(a, Et, t, e);
        },
        useMemoCache: Pi,
        useCacheRefresh: Js
      };
      so.useEffectEvent = Ds;
      var Ku = {
        readContext: It,
        use: Nl,
        useCallback: Gs,
        useContext: It,
        useEffect: lr,
        useImperativeHandle: Ys,
        useInsertionEffect: Us,
        useLayoutEffect: Bs,
        useMemo: Qs,
        useReducer: er,
        useRef: Rs,
        useState: function() {
          return er(We);
        },
        useDebugValue: ir,
        useDeferredValue: function(t, e) {
          var a = Ut();
          return Et === null ? rr(a, t, e) : Ks(
            a,
            Et.memoizedState,
            t,
            e
          );
        },
        useTransition: function() {
          var t = er(We)[0], e = Ut().memoizedState;
          return [
            typeof t == "boolean" ? t : Yn(t),
            e
          ];
        },
        useSyncExternalStore: vs,
        useId: Zs,
        useHostTransitionStatus: or,
        useFormState: Os,
        useActionState: Os,
        useOptimistic: function(t, e) {
          var a = Ut();
          return Et !== null ? zs(a, Et, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
        },
        useMemoCache: Pi,
        useCacheRefresh: Js
      };
      Ku.useEffectEvent = Ds;
      var co = {
        enqueueSetState: function(t, e, a) {
          t = t._reactInternals;
          var l = he(), r = ma(l);
          r.payload = e, a != null && (r.callback = a), e = fa(t, r, l), e !== null && (ce(e, t, l), Un(e, t, l));
        },
        enqueueReplaceState: function(t, e, a) {
          t = t._reactInternals;
          var l = he(), r = ma(l);
          r.tag = 1, r.payload = e, a != null && (r.callback = a), e = fa(t, r, l), e !== null && (ce(e, t, l), Un(e, t, l));
        },
        enqueueForceUpdate: function(t, e) {
          t = t._reactInternals;
          var a = he(), l = ma(a);
          l.tag = 2, e != null && (l.callback = e), e = fa(t, l, a), e !== null && (ce(e, t, a), Un(e, t, a));
        }
      }, uo = Error(s(461)), Yt = !1, mo = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, la = !1, Gt = !1, fo = !1, Vu = typeof WeakSet == "function" ? WeakSet : Set, Wt = null, Qt = null, de = !1, Be = null, Nn = 8192, Ip = {
        getCacheForType: function(t) {
          var e = It(Ot), a = e.data.get(t);
          return a === void 0 && (a = t(), e.data.set(t, a)), a;
        },
        cacheSignal: function() {
          return It(Ot).controller.signal;
        }
      }, oi = 0, si = 1, ci = 2, ui = 3, di = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var il = Symbol.for;
        oi = il("selector.component"), si = il("selector.has_pseudo_class"), ci = il("selector.role"), ui = il("selector.test_id"), di = il("selector.text");
      }
      var $p = typeof WeakMap == "function" ? WeakMap : Map, gt = 0, Tt = null, bt = null, vt = 0, kt = 0, we = null, za = !1, Tn = !1, po = !1, ia = 0, Dt = 0, ka = 0, Fa = 0, ho = 0, _e = 0, Cn = 0, rl = null, me = null, go = !1, mi = 0, Xu = 0, ol = 1 / 0, fi = null, Ea = null, Xt = 0, Na = null, jn = null, ra = 0, bo = 0, vo = null, Zu = null, sl = 0, yo = null;
      return ht.attemptContinuousHydration = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = Ua(t, 67108864);
          e !== null && ce(e, t, 67108864), Ur(t, 67108864);
        }
      }, ht.attemptHydrationAtCurrentPriority = function(t) {
        if (t.tag === 13 || t.tag === 31) {
          var e = he();
          e = at(e);
          var a = Ua(t, e);
          a !== null && ce(a, t, e), Ur(t, e);
        }
      }, ht.attemptSynchronousHydration = function(t) {
        switch (t.tag) {
          case 3:
            if (t = t.stateNode, t.current.memoizedState.isDehydrated) {
              var e = z(t.pendingLanes);
              if (e !== 0) {
                for (t.pendingLanes |= 2, t.entangledLanes |= 2; e; ) {
                  var a = 1 << 31 - be(e);
                  t.entanglements[1] |= a, e &= ~a;
                }
                Ge(t), (gt & 6) === 0 && (ol = ue() + 500, ln(0));
              }
            }
            break;
          case 31:
          case 13:
            e = Ua(t, 2), e !== null && ce(e, t, 2), Gc(), Ur(t, 2);
        }
      }, ht.batchedUpdates = function(t, e) {
        return t(e);
      }, ht.createComponentSelector = function(t) {
        return { $$typeof: oi, value: t };
      }, ht.createContainer = function(t, e, a, l, r, u, f, y, R, Q) {
        return iu(
          t,
          e,
          !1,
          null,
          a,
          l,
          u,
          null,
          f,
          y,
          R,
          Q
        );
      }, ht.createHasPseudoClassSelector = function(t) {
        return { $$typeof: si, value: t };
      }, ht.createHydrationContainer = function(t, e, a, l, r, u, f, y, R, Q, Z, V, L, dt) {
        return t = iu(
          a,
          l,
          !0,
          t,
          r,
          u,
          y,
          dt,
          R,
          Q,
          Z,
          V
        ), t.context = ru(null), a = t.current, l = he(), l = at(l), r = ma(l), r.callback = e ?? null, fa(a, r, l), e = l, t.current.lanes = e, C(t, e), Ge(t), t;
      }, ht.createPortal = function(t, e, a) {
        var l = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: un,
          key: l == null ? null : "" + l,
          children: t,
          containerInfo: e,
          implementation: a
        };
      }, ht.createRoleSelector = function(t) {
        return { $$typeof: ci, value: t };
      }, ht.createTestNameSelector = function(t) {
        return { $$typeof: ui, value: t };
      }, ht.createTextSelector = function(t) {
        return { $$typeof: di, value: t };
      }, ht.defaultOnCaughtError = function(t) {
        console.error(t);
      }, ht.defaultOnRecoverableError = function(t) {
        Uu(t);
      }, ht.defaultOnUncaughtError = function(t) {
        Uu(t);
      }, ht.deferredUpdates = function(t) {
        var e = it.T, a = ea();
        try {
          return Lt(32), it.T = null, t();
        } finally {
          Lt(a), it.T = e;
        }
      }, ht.discreteUpdates = function(t, e, a, l, r) {
        var u = it.T, f = ea();
        try {
          return Lt(2), it.T = null, t(e, a, l, r);
        } finally {
          Lt(f), it.T = u, gt === 0 && (ol = ue() + 500);
        }
      }, ht.findAllNodes = jr, ht.findBoundingRects = function(t, e) {
        if (!Fn) throw Error(s(363));
        e = jr(t, e), t = [];
        for (var a = 0; a < e.length; a++)
          t.push(Of(e[a]));
        for (e = t.length - 1; 0 < e; e--) {
          a = t[e];
          for (var l = a.x, r = l + a.width, u = a.y, f = u + a.height, y = e - 1; 0 <= y; y--)
            if (e !== y) {
              var R = t[y], Q = R.x, Z = Q + R.width, V = R.y, L = V + R.height;
              if (l >= Q && u >= V && r <= Z && f <= L) {
                t.splice(e, 1);
                break;
              } else if (l !== Q || a.width !== R.width || L < u || V > f) {
                if (!(u !== V || a.height !== R.height || Z < l || Q > r)) {
                  Q > l && (R.width += Q - l, R.x = l), Z < r && (R.width = r - Q), t.splice(e, 1);
                  break;
                }
              } else {
                V > u && (R.height += V - u, R.y = u), L < f && (R.height = f - V), t.splice(e, 1);
                break;
              }
            }
        }
        return t;
      }, ht.findHostInstance = ou, ht.findHostInstanceWithNoPortals = function(t) {
        return t = m(t), t = t !== null ? w(t) : null, t === null ? null : Wn(t.stateNode);
      }, ht.findHostInstanceWithWarning = function(t) {
        return ou(t);
      }, ht.flushPassiveEffects = Ln, ht.flushSyncFromReconciler = function(t) {
        var e = gt;
        gt |= 1;
        var a = it.T, l = ea();
        try {
          if (Lt(2), it.T = null, t)
            return t();
        } finally {
          Lt(l), it.T = a, gt = e, (gt & 6) === 0 && ln(0);
        }
      }, ht.flushSyncWork = Gc, ht.focusWithin = function(t, e) {
        if (!Fn) throw Error(s(363));
        for (t = Nr(t), e = Uc(t, e), e = Array.from(e), t = 0; t < e.length; ) {
          var a = e[t++], l = a.tag;
          if (!In(a)) {
            if ((l === 5 || l === 26 || l === 27) && Df(a.stateNode))
              return !0;
            for (a = a.child; a !== null; )
              e.push(a), a = a.sibling;
          }
        }
        return !1;
      }, ht.getFindAllNodesFailureDescription = function(t, e) {
        if (!Fn) throw Error(s(363));
        var a = 0, l = [];
        t = [Nr(t), 0];
        for (var r = 0; r < t.length; ) {
          var u = t[r++], f = u.tag, y = t[r++], R = e[y];
          if ((f !== 5 && f !== 26 && f !== 27 || !In(u)) && (Tr(u, R) && (l.push(Cr(R)), y++, y > a && (a = y)), y < e.length))
            for (u = u.child; u !== null; )
              t.push(u, y), u = u.sibling;
        }
        if (a < e.length) {
          for (t = []; a < e.length; a++)
            t.push(Cr(e[a]));
          return `findAllNodes was able to match part of the selector:
  ` + (l.join(" > ") + `

No matching component was found for:
  `) + t.join(" > ");
        }
        return null;
      }, ht.getPublicRootInstance = function(t) {
        if (t = t.current, !t.child) return null;
        switch (t.child.tag) {
          case 27:
          case 5:
            return Wn(t.child.stateNode);
          default:
            return t.child.stateNode;
        }
      }, ht.injectIntoDevTools = function() {
        var t = {
          bundleType: 0,
          version: df,
          rendererPackageName: mf,
          currentDispatcherRef: it,
          reconcilerVersion: "19.2.0"
        };
        if (fu !== null && (t.rendererConfig = fu), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t = !1;
        else {
          var e = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (e.isDisabled || !e.supportsFiber) t = !0;
          else {
            try {
              $n = e.inject(t), ve = e;
            } catch {
            }
            t = !!e.checkDCE;
          }
        }
        return t;
      }, ht.isAlreadyRendering = function() {
        return (gt & 6) !== 0;
      }, ht.observeVisibleRects = function(t, e, a, l) {
        if (!Fn) throw Error(s(363));
        t = jr(t, e);
        var r = Uf(
          t,
          a,
          l
        ).disconnect;
        return {
          disconnect: function() {
            r();
          }
        };
      }, ht.shouldError = function() {
        return null;
      }, ht.shouldSuspend = function() {
        return !1;
      }, ht.startHostTransition = function(t, e, a, l) {
        if (t.tag !== 5) throw Error(s(476));
        var r = Xs(t).queue;
        Vs(
          t,
          r,
          e,
          mn,
          a === null ? c : function() {
            var u = Xs(t);
            return u.next === null && (u = t.alternate.memoizedState), Gn(
              t,
              u.next.queue,
              {},
              he()
            ), a(l);
          }
        );
      }, ht.updateContainer = function(t, e, a, l) {
        var r = e.current, u = he();
        return su(
          r,
          u,
          t,
          e,
          a,
          l
        ), u;
      }, ht.updateContainerSync = function(t, e, a, l) {
        return su(
          e.current,
          2,
          t,
          e,
          a,
          l
        ), 2;
      }, ht;
    }, n.exports.default = n.exports, Object.defineProperty(n.exports, "__esModule", { value: !0 });
  })(So)), So.exports;
}
var id;
function kh() {
  return id || (id = 1, _o.exports = zh()), _o.exports;
}
var Eh = kh();
const Nh = /* @__PURE__ */ Zo(Eh);
var Eo = { exports: {} }, oa = {};
/**
 * @license React
 * react-reconciler-constants.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var rd;
function Th() {
  return rd || (rd = 1, oa.ConcurrentRoot = 1, oa.ContinuousEventPriority = 8, oa.DefaultEventPriority = 32, oa.DiscreteEventPriority = 2, oa.IdleEventPriority = 268435456, oa.LegacyRoot = 0, oa.NoEventPriority = 0), oa;
}
var od;
function Ch() {
  return od || (od = 1, Eo.exports = Th()), Eo.exports;
}
var pl = Ch();
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
const Xd = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"], Ao = 16, Zd = /* @__PURE__ */ new Set(["hover", "focus", "focus-visible", "focus-within", "active"]), jh = [
  ["html", { display: "block", "font-size": "16px", "font-family": "Times", color: "#000000", "line-height": "normal" }],
  ["body", { display: "block", margin: "8px" }],
  ["div, section, aside, p, nav, header, footer, main, ul, ol, li, form, label[hidden]", { display: "block" }],
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
  ["input", { padding: "1px 2px", "border-width": "2px", "border-style": "inset", "border-color": "buttonborder", "background-color": "field", color: "fieldtext" }],
  ["svg", { overflow: "hidden" }],
  ["[hidden]", { display: "none" }]
], sd = {
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
}, Mh = /* @__PURE__ */ new Set([
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
]), Jd = {
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
}, Ld = {
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
}, Oo = ["font-size", "color", ...new Set([...Object.keys(Jd), ...Object.keys(Ld)].filter((n) => n !== "font-size" && n !== "color"))], Ah = new Set(Oo);
function ie(n, i = " ") {
  const o = [];
  let c = 0, s = "";
  for (let d = 0; d < n.length; d++) {
    const p = n[d];
    if (p === "(" ? c++ : p === ")" && c--, c === 0 && (i === " " ? /\s/.test(p) : p === i)) {
      (s.trim() || i !== " ") && o.push(s.trim()), s = "";
      continue;
    }
    s += p;
  }
  return (s.trim() || i !== " " && o.length) && o.push(s.trim()), o;
}
function Ro(n, i, o = 0) {
  if (o > 32) return null;
  let c = "", s = 0;
  for (; ; ) {
    const d = n.indexOf("var(", s);
    if (d < 0)
      return c += n.slice(s), c;
    c += n.slice(s, d);
    let p = 1, m = d + 4;
    for (; m < n.length && p; m++)
      n[m] === "(" ? p++ : n[m] === ")" && p--;
    const x = n.slice(d + 4, m - 1), w = ie(x, ","), M = w[0].trim(), D = w.length > 1 ? x.slice(x.indexOf(",") + 1).trim() : null;
    let k = i(M);
    if ((k == null || k === "initial") && (k = D), k == null) return null;
    const g = Ro(k, i, o + 1);
    if (g === null) return null;
    c += g, s = m;
  }
}
function Oh(n) {
  const i = [], o = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let c, s = 0;
  for (; s < n.length; ) {
    if (o.lastIndex = s, c = o.exec(n), !c || c.index !== s) {
      if (/^\s+$/.test(n.slice(s))) break;
      return null;
    }
    s = o.lastIndex, c[1] !== void 0 ? i.push({ num: parseFloat(c[1]), unit: (c[2] ?? "").toLowerCase() }) : c[3] ? i.push({ fn: c[3].toLowerCase() }) : c[4] ? i.push({ num: 1 / 0, unit: "" }) : i.push({ op: c[5] ?? c[6] });
  }
  return i;
}
function On(n, i) {
  const o = Oh(n.trim().replace(/env\(\s*safe-area-inset-(?:top|right|bottom|left)\s*(?:,[^()]*)?\)/gi, "0px"));
  if (!o) return null;
  let c = 0;
  const s = ({ num: k, unit: g }) => {
    switch (g) {
      case "":
        return { px: 0, pct: 0, num: k, unitless: !0 };
      case "px":
        return { px: k, pct: 0, num: 0 };
      case "rem":
        return { px: k * Ao, pct: 0, num: 0 };
      case "em":
        return { px: k * (i.fontSize ?? Ao), pct: 0, num: 0 };
      case "%":
        return { px: 0, pct: k, num: 0 };
      case "vh":
      case "dvh":
      case "svh":
      case "lvh":
        return { px: k / 100 * (i.viewport?.height ?? 800), pct: 0, num: 0 };
      case "vw":
      case "dvw":
      case "svw":
      case "lvw":
        return { px: k / 100 * (i.viewport?.width ?? 1e3), pct: 0, num: 0 };
      case "pt":
        return { px: k * (4 / 3), pct: 0, num: 0 };
      default:
        return null;
    }
  }, d = (k, g, S) => k && g ? { px: k.px + S * g.px, pct: k.pct + S * g.pct, num: k.num + S * g.num, unitless: k.unitless && g.unitless } : null, p = (k, g) => k ? { px: k.px * g, pct: k.pct * g, num: k.num * g, unitless: k.unitless } : null, m = (k) => k && k.unitless;
  function x() {
    const k = o[c++];
    if (!k) return null;
    if (k.num !== void 0) return s(k);
    if (k.op === "(") {
      const g = M();
      return o[c]?.op !== ")" ? null : (c++, g);
    }
    if (k.op === "-" || k.op === "+") {
      const g = x();
      return k.op === "-" ? p(g, -1) : g;
    }
    if (k.fn) {
      const g = [];
      for (; ; ) {
        g.push(M());
        const z = o[c++];
        if (!z) return null;
        if (z.op === ")") break;
        if (z.op !== ",") return null;
      }
      if (g.some((z) => !z)) return null;
      if (k.fn === "calc") return g[0];
      if (!(g.every((z) => !z.pct) || g.every((z) => !z.px && !z.num))) return null;
      const _ = (z) => z.px + z.pct + z.num;
      return k.fn === "min" ? g.reduce((z, Y) => _(Y) < _(z) ? Y : z) : k.fn === "max" ? g.reduce((z, Y) => _(Y) > _(z) ? Y : z) : k.fn === "clamp" && g.length === 3 ? _(g[1]) < _(g[0]) ? g[0] : _(g[1]) > _(g[2]) ? g[2] : g[1] : null;
    }
    return null;
  }
  function w() {
    let k = x();
    for (; o[c] && (o[c].op === "*" || o[c].op === "/"); ) {
      const g = o[c++].op, S = x();
      if (!k || !S) return null;
      g === "*" ? k = m(S) ? p(k, S.num) : m(k) ? p(S, k.num) : null : k = m(S) && S.num !== 0 ? p(k, 1 / S.num) : null;
    }
    return k;
  }
  function M() {
    let k = w();
    for (; o[c] && (o[c].op === "+" || o[c].op === "-"); ) {
      const g = o[c++].op;
      k = d(k, w(), g === "-" ? -1 : 1);
    }
    return k;
  }
  const D = M();
  return c !== o.length || !D ? null : D;
}
function Ho(n, i) {
  const o = n.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(o))
    return o === "thin" ? { px: 1 } : o === "medium" ? { px: 3 } : o === "thick" ? { px: 5 } : o;
  const c = On(o, i);
  return c ? c.unitless ? c.num === 0 ? { px: 0 } : { expr: n.trim() } : c.pct && (c.px || c.num) ? { expr: n.trim() } : c.pct ? { pct: c.pct } : { px: Rh(c.px) } : { expr: n.trim() };
}
const Rh = (n) => Number.isFinite(n) ? n : n > 0 ? 34e37 : -34e37, gi = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"), Hh = ([n, i, o, c]) => `#${gi(n)}${gi(i)}${gi(o)}${gi(c * 255)}`;
function cd(n) {
  const i = n.slice(1), o = i.length <= 4 ? i.split("").map((s) => s + s).join("") : i;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(o)) return null;
  const c = (s) => parseInt(o.slice(s, s + 2), 16);
  return [c(0), c(2), c(4), o.length === 8 ? c(6) / 255 : 1];
}
function zi(n, i) {
  const o = n.trim().toLowerCase();
  if (o === "currentcolor") return "currentcolor";
  const c = /^perchtoken\(([a-z0-9-]+)\)$/.exec(o);
  if (c) {
    const w = i(c[1]), M = w && cd(w);
    return M ? { rgba: M, token: c[1] } : null;
  }
  if (o.startsWith("#")) {
    const w = cd(o);
    return w ? { rgba: w, token: null } : null;
  }
  if (sd[o]) return { rgba: [...sd[o]], token: null };
  const s = /^(rgba?|color-mix)\((.*)\)$/s.exec(o);
  if (!s) return null;
  if (s[1] === "color-mix") {
    const w = ie(s[2], ",");
    if (w.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(w[0])) return null;
    const M = (Mt) => {
      const Kt = ie(Mt), Nt = Kt.findIndex((nt) => /%$/.test(nt)), K = Nt >= 0 ? parseFloat(Kt[Nt]) / 100 : null;
      return { color: zi(Kt.filter((nt, U) => U !== Nt).join(" "), i), pct: K };
    }, D = M(w[1]), k = M(w[2]);
    if (!D.color || !k.color || D.color === "currentcolor" || k.color === "currentcolor") return null;
    let g = D.pct, S = k.pct;
    g === null && S === null ? (g = 0.5, S = 0.5) : g === null ? g = 1 - S : S === null && (S = 1 - g);
    const _ = g + S, z = _ < 1 ? _ : 1;
    g /= _, S /= _;
    const [Y, E, N, A] = D.color.rgba, [H, C, b, h] = k.color.rgba, G = A * g + h * S, J = (Mt, Kt) => G === 0 ? 0 : (Mt * A * g + Kt * h * S) / G, at = [J(Y, H), J(E, C), J(N, b), G * z], ot = h === 0 ? D.color.token : A === 0 ? k.color.token : null;
    return { rgba: at, token: ot };
  }
  const d = s[2].includes(",") ? ie(s[2], ",") : ie(s[2].replace("/", " / ")).filter((w) => w !== "/");
  if (d.length < 3) return null;
  const p = (w) => w.endsWith("%") ? parseFloat(w) / 100 * 255 : parseFloat(w), m = d[3] === void 0 ? 1 : d[3].endsWith("%") ? parseFloat(d[3]) / 100 : parseFloat(d[3]), x = [p(d[0]), p(d[1]), p(d[2]), m];
  return x.some((w) => Number.isNaN(w)) ? null : { rgba: x, token: null };
}
const ml = ["top", "right", "bottom", "left"], Dh = ["top-left", "top-right", "bottom-right", "bottom-left"], bi = (n) => [n[0], n[1] ?? n[0], n[2] ?? n[0], n[3] ?? n[1] ?? n[0]], ud = /* @__PURE__ */ new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);
function Do(n, i) {
  const o = i.trim(), c = () => ie(o);
  switch (n) {
    case "padding":
    case "margin": {
      const s = bi(c());
      return ml.map((d, p) => [`${n}-${d}`, s[p]]);
    }
    case "padding-inline":
    case "margin-inline": {
      const s = c(), d = n.split("-")[0];
      return [[`${d}-left`, s[0]], [`${d}-right`, s[1] ?? s[0]]];
    }
    case "padding-block":
    case "margin-block": {
      const s = c(), d = n.split("-")[0];
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
      const s = bi(c());
      return ml.map((d, p) => [d, s[p]]);
    }
    case "inset-inline": {
      const s = c();
      return [["left", s[0]], ["right", s[1] ?? s[0]]];
    }
    case "inset-block": {
      const s = c();
      return [["top", s[0]], ["bottom", s[1] ?? s[0]]];
    }
    case "inset-inline-start":
      return [["left", o]];
    case "inset-inline-end":
      return [["right", o]];
    case "border-width":
    case "border-style":
    case "border-color": {
      const s = n.split("-")[1], d = bi(c());
      return ml.map((p, m) => [`border-${p}-${s}`, d[m]]);
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
      const s = n === "border" ? ml : n === "border-inline" ? ["left", "right"] : n === "border-block" ? ["top", "bottom"] : n === "border-inline-start" ? ["left"] : n === "border-inline-end" ? ["right"] : [n.slice(7)];
      let d = "medium", p = "none", m = "currentcolor";
      if (o !== "none" && o !== "0")
        for (const x of c())
          ud.has(x) ? p = x : /^(thin|medium|thick|-?[\d.]|calc\()/.test(x) ? d = x : m = x;
      else o === "0" && (d = "0");
      return s.flatMap((x) => [[`border-${x}-width`, d], [`border-${x}-style`, p], [`border-${x}-color`, m]]);
    }
    case "border-inline-width": {
      const s = c();
      return [["border-left-width", s[0]], ["border-right-width", s[1] ?? s[0]]];
    }
    case "border-block-width": {
      const s = c();
      return [["border-top-width", s[0]], ["border-bottom-width", s[1] ?? s[0]]];
    }
    case "border-inline-style": {
      const s = c();
      return [["border-left-style", s[0]], ["border-right-style", s[1] ?? s[0]]];
    }
    case "border-inline-color": {
      const s = c();
      return [["border-left-color", s[0]], ["border-right-color", s[1] ?? s[0]]];
    }
    case "border-radius": {
      const s = bi(ie(o.split("/")[0]));
      return Dh.map((d, p) => [`border-${d}-radius`, s[p]]);
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
      return o === "none" ? [["background-color", "transparent"], ["background-image", "none"]] : zi(o, () => "#000000") ? [["background-color", o], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", o]];
    // ponytail: only the CSS-wide keywords (`[font:inherit]` on a button); a full `font` value is kept unexpanded.
    case "font":
      return /^(inherit|initial|unset|revert|revert-layer)$/.test(o) ? ["font-family", "font-size", "font-weight", "font-style", "line-height"].map((s) => [s, o]) : [[n, o]];
    case "overflow": {
      const s = c();
      return [["overflow-x", s[0]], ["overflow-y", s[1] ?? s[0]]];
    }
    case "gap": {
      const s = c();
      return [["row-gap", s[0]], ["column-gap", s[1] ?? s[0]]];
    }
    case "grid-gap":
      return Do("gap", o);
    case "place-items": {
      const s = c();
      return [["align-items", s[0]], ["justify-items", s[1] ?? s[0]]];
    }
    case "place-self": {
      const s = c();
      return [["align-self", s[0]], ["justify-self", s[1] ?? s[0]]];
    }
    case "place-content": {
      const s = c();
      return [["align-content", s[0]], ["justify-content", s[1] ?? s[0]]];
    }
    case "flex": {
      if (o === "none") return [["flex-grow", "0"], ["flex-shrink", "0"], ["flex-basis", "auto"]];
      if (o === "auto") return [["flex-grow", "1"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      if (o === "initial") return [["flex-grow", "0"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      const s = c(), d = s.filter((m) => /^[\d.]+$/.test(m)), p = s.find((m) => !/^[\d.]+$/.test(m));
      return [["flex-grow", d[0] ?? "1"], ["flex-shrink", d[1] ?? "1"], ["flex-basis", p ?? (d.length ? "0%" : "auto")]];
    }
    case "flex-flow": {
      const s = [];
      for (const d of c()) s.push(/wrap/.test(d) ? ["flex-wrap", d] : ["flex-direction", d]);
      return s;
    }
    case "outline": {
      if (o === "none" || o === "0") return [["outline-style", "none"], ["outline-width", "medium"], ["outline-color", "currentcolor"]];
      let s = "medium", d = "none", p = "currentcolor";
      for (const m of c())
        ud.has(m) || m === "auto" ? d = m : /^(thin|medium|thick|-?[\d.]|calc\()/.test(m) ? s = m : p = m;
      return [["outline-width", s], ["outline-style", d], ["outline-color", p]];
    }
    case "transition": {
      if (o === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const s = ie(o, ","), d = s.map((m) => ie(m).find((x) => !/^[\d.]+m?s$/.test(x) && !/^(ease|linear|step|cubic)/.test(x)) ?? "all"), p = s.map((m) => ie(m).find((x) => /^[\d.]+m?s$/.test(x)) ?? "0s");
      return [["transition-property", d.join(", ")], ["transition-duration", p.join(", ")]];
    }
    case "text-decoration":
      return [["text-decoration-line", c()[0] ?? "none"]];
    case "-webkit-user-select":
      return [["user-select", o]];
    case "word-wrap":
      return [["overflow-wrap", o]];
    default:
      return [[n, o]];
  }
}
function Uh(n, i) {
  return n ? ie(n, ",").some((o) => {
    let c = o.trim().toLowerCase(), s = !1;
    c.startsWith("not ") && (s = !0, c = c.slice(4)), c.startsWith("only ") && (c = c.slice(5));
    const d = c.split(/\s+and\s+/).every((p) => {
      if (p = p.trim(), p === "all" || p === "screen") return !0;
      if (p === "print") return !1;
      const m = /^\((.+)\)$/.exec(p);
      if (!m) return !1;
      const x = m[1].trim(), w = /^([a-z-]+)\s*:\s*(.+)$/.exec(x);
      if (w) {
        const [, D, k] = w, g = (S) => {
          const _ = Ho(S, { viewport: i });
          return typeof _ == "object" && "px" in _ ? _.px : NaN;
        };
        switch (D) {
          case "min-width":
            return i.width >= g(k);
          case "max-width":
            return i.width <= g(k);
          case "min-height":
            return i.height >= g(k);
          case "max-height":
            return i.height <= g(k);
          case "hover":
          case "any-hover":
            return k.trim() === "hover";
          case "pointer":
          case "any-pointer":
            return k.trim() === "fine";
          case "prefers-reduced-motion":
            return k.trim() === "no-preference";
          case "prefers-color-scheme":
            return k.trim() === (i.dark === !1 ? "light" : "dark");
          default:
            return !1;
        }
      }
      const M = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(x);
      if (M) {
        const D = M[1] === "width" ? i.width : i.height, k = Ho(M[3], { viewport: i }), g = typeof k == "object" && "px" in k ? k.px : NaN;
        switch (M[2]) {
          case ">=":
            return D >= g;
          case "<=":
            return D <= g;
          case ">":
            return D > g;
          case "<":
            return D < g;
          default:
            return D === g;
        }
      }
      return !1;
    });
    return s ? !d : d;
  }) : !0;
}
function Bh(n, i) {
  const o = i[i.length - 1].compound;
  return Jo(o)[0] ?? n;
}
function qh(n) {
  const i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), c = (s, d) => {
    s.forEach(({ compound: p }, m) => {
      const x = d && m === s.length - 1;
      for (const w of p.pseudos)
        if (Zd.has(w.name) && (x ? i : o).add(w.name), w.list && w.name !== "not") for (const M of w.list) c(M, x);
    });
  };
  return c(n, !0), { subject: i, ancestor: o };
}
function Jo(n) {
  const i = [...n.classes];
  for (const o of n.pseudos)
    if (!(o.name !== "is" && o.name !== "where"))
      for (const c of o.list) c.length === 1 && i.push(...Jo(c[0].compound));
  return i;
}
function Yh(n, i) {
  const o = (c, s) => {
    c.forEach(({ compound: d }, p) => {
      const m = s && p === c.length - 1, x = d.pseudos.filter((w) => Zd.has(w.name)).map((w) => w.name);
      if (!m) for (const w of x) for (const M of Jo(d)) i.add(`${w}:${M}`);
      for (const w of d.pseudos) if (w.list && w.name !== "not") for (const M of w.list) o(M, m);
    });
  };
  o(n, !0);
}
class Gh {
  constructor(i) {
    this.properties = i.properties ?? {}, this.rules = [], this.skipped = 0, this.index = /* @__PURE__ */ new Map(), this.trackedStates = /* @__PURE__ */ new Set();
    const o = (d, p) => {
      const m = p[p.length - 1].compound, x = m.classes.length ? `.${m.classes[0]}` : m.tag && m.tag !== "*" ? m.tag : "*";
      this.index.has(x) || this.index.set(x, []), this.index.get(x).push(d);
    };
    let c = 0;
    const s = (d, p) => {
      for (const [m, x, w, M] of d)
        for (const D of Ko(m)) {
          let k;
          try {
            k = Vo(D);
          } catch (_) {
            if (_ instanceof ze) {
              this.skipped++;
              continue;
            }
            throw _;
          }
          const g = qh(k);
          Yh(k, this.trackedStates);
          const S = { steps: k, media: x, layer: w, origin: p, order: c++, specificity: qd(k), decls: M, states: g, source: p === 0 ? `ua:${k[k.length - 1].compound.tag ?? "*"}` : Bh(D, k) };
          this.rules.push(S), o(S, k);
        }
    };
    s(jh.map(([d, p]) => [d, null, 0, Object.entries(p)]), 0), s(i.rules, 1);
  }
  /** Rules that may match `element` (by its classes, its tag, and the universal ones). */
  candidates(i) {
    const o = [], c = /* @__PURE__ */ new Set(), s = (d) => {
      if (d) for (const p of d) c.has(p) || (c.add(p), o.push(p));
    };
    for (const d of i.classList) s(this.index.get(`.${d}`));
    return s(this.index.get(i.tagName)), s(this.index.get("*")), o;
  }
  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(i, o) {
    for (const c of i.classList) if (this.trackedStates.has(`${o}:${c}`)) return !0;
    return !1;
  }
}
const Qh = /* @__PURE__ */ new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
function Kh(n) {
  if (!n || typeof n != "object") return [];
  const i = [];
  for (const [o, c] of Object.entries(n)) {
    if (c == null || c === "" || typeof c == "boolean") continue;
    const s = o.startsWith("--") ? o : o.replace(/[A-Z]/g, (p) => `-${p.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-"), d = typeof c == "number" && c !== 0 && !Qh.has(s) && !s.startsWith("--") ? `${c}px` : String(c);
    i.push([s, d]);
  }
  return i;
}
function Vh(n) {
  if (n.tagName !== "svg") return [];
  const i = [];
  for (const o of ["width", "height"]) {
    const c = n.getAttribute(o);
    c !== null && i.push([o, /^[\d.]+$/.test(c) ? `${c}px` : c]);
  }
  return i;
}
const Xh = (n, i) => n.important - i.important || n.origin - i.origin || n.layer - i.layer || n.specificity[0] - i.specificity[0] || n.specificity[1] - i.specificity[1] || n.specificity[2] - i.specificity[2] || n.order - i.order;
class Zh {
  constructor(i, { theme: o, viewport: c }) {
    this.sheet = i, this.theme = o, this.viewport = c, this.parsed = /* @__PURE__ */ new Map();
  }
  themeHex(i) {
    return this.theme?.[i] ?? null;
  }
  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(i, o) {
    const c = (s, d, p) => {
      if (d === "disabled") return !!s.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(s.tagName);
      if (d === "enabled") return !s.props?.disabled && ["button", "input", "select", "textarea"].includes(s.tagName);
      if (d === "checked") return !!s.props?.checked;
      if (o === "*") return !0;
      if (d === "focus-within") {
        const m = s.ownerDocument?.activeElement;
        return !!m && m !== s.ownerDocument.body && typeof s.contains == "function" && s.contains(m);
      }
      return p ? o.has(d) : d === "focus-visible" ? !!s.state?.focus && !s.state?.pointerFocus : !!s.state?.[d];
    };
    return this.sheet.candidates(i).filter((s) => (!s.media || s.media.every((d) => Uh(d, this.viewport))) && Yd(i, s.steps, { state: c }));
  }
  compute(i, o, c = /* @__PURE__ */ new Set()) {
    const s = this.matching(i, c), d = [];
    for (const b of s)
      for (const [h, G, J] of b.decls) d.push({ prop: h, value: G, important: J ? 1 : 0, origin: b.origin === 0 ? 0 : 2, layer: b.layer, specificity: b.specificity, order: b.order, source: b.source });
    for (const [b, h] of Vh(i)) d.push({ prop: b, value: h, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${b}` });
    for (const [b, h] of Kh(i.inlineStyle ?? i.props?.style)) d.push({ prop: b, value: h, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    d.sort(Xh);
    const p = this.sheet.properties, m = Object.create(o?.customs ?? null), x = /* @__PURE__ */ new Map(), w = /* @__PURE__ */ new Map();
    for (const b of d) b.prop.startsWith("--") && w.set(b.prop, b.value);
    if (!o && this.theme) for (const b of Xd) this.theme[b] && w.set(`--${b}`, `perchtoken(${b})`);
    const M = (b) => {
      if (x.has(b)) return x.get(b);
      const h = p[b];
      return h && !h.inherits ? h.initial ?? null : b in m ? m[b] : h?.initial ?? null;
    }, D = /* @__PURE__ */ new Set(), k = (b) => {
      if (!w.has(b)) return M(b);
      if (D.has(b)) return null;
      D.add(b);
      const h = Ro(w.get(b), k);
      return D.delete(b), w.delete(b), x.set(b, h), (!p[b] || p[b].inherits) && (m[b] = h), h;
    };
    for (const b of [...w.keys()]) k(b);
    const g = /* @__PURE__ */ new Map();
    for (const b of d) {
      if (b.prop.startsWith("--")) continue;
      const h = Ro(b.value, M);
      if (h === null) {
        for (const [G] of Do(b.prop, "unset")) g.set(G, { value: "unset", source: b.source, origin: b.origin });
        continue;
      }
      for (const [G, J] of Do(b.prop, h)) g.set(G, { value: J, source: b.source, origin: b.origin });
    }
    const S = {}, _ = {}, z = /* @__PURE__ */ new Set(), Y = /* @__PURE__ */ new Set(), E = o?.values, N = { fontSize: E?.["font-size"] ?? Ao, viewport: this.viewport }, A = (b, h) => {
      if (/currentcolor/i.test(h)) return this.parseValue(b, h, N, S, E);
      const G = `${b}\0${h}\0${N.fontSize}`;
      let J = this.parsed.get(G);
      return J === void 0 && this.parsed.set(G, J = this.parseValue(b, h, N, S, E)), J;
    }, H = g.size ? [...Oo, ...[...g.keys()].filter((b) => !Ah.has(b))] : Oo;
    for (const b of H) {
      const h = g.get(b);
      let G = h?.value;
      const J = Mh.has(b);
      if ((G === void 0 || G === "unset" || G === "revert" || G === "revert-layer") && (G = J ? "inherit" : "initial"), h && (_[b] = h.source, h.origin !== 0 && z.add(b)), G === "inherit" && E && b in E) {
        S[b] = E[b], Y.add(b);
        continue;
      }
      (G === "inherit" || G === "initial") && (G = J ? Ld[b] : Jd[b]), S[b] = A(b, G), b === "font-size" && (N.fontSize = S["font-size"]);
    }
    for (const b of ml) {
      const h = S[`border-${b}-style`];
      (h === "none" || h === "hidden") && (S[`border-${b}-width`] = { px: 0 });
    }
    S["outline-style"] === "none" && (S["outline-width"] = { px: 0 });
    const C = E?.display;
    return (C === "flex" || C === "inline-flex" || C === "grid" || C === "inline-grid") && S.position !== "absolute" && S.position !== "fixed" && (S.display = dd(S.display)), (S.position === "absolute" || S.position === "fixed") && (S.display = dd(S.display)), { values: S, sources: _, own: z, inherited: Y, customs: m, rules: s, element: i };
  }
  parseValue(i, o, c, s, d) {
    const p = String(o).trim();
    switch (i) {
      case "font-size": {
        const m = p.toLowerCase(), x = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (x[m]) return x[m];
        if (m === "smaller") return c.fontSize / 1.2;
        if (m === "larger") return c.fontSize * 1.2;
        const w = On(m, { fontSize: c.fontSize, viewport: c.viewport });
        return !w || w.num ? c.fontSize : w.px + w.pct / 100 * c.fontSize;
      }
      case "font-weight": {
        const m = p.toLowerCase();
        if (m === "normal") return 400;
        if (m === "bold") return 700;
        if (m === "bolder") return (d?.["font-weight"] ?? 400) >= 600 ? 900 : 700;
        if (m === "lighter") return (d?.["font-weight"] ?? 400) >= 600 ? 400 : 100;
        const x = parseFloat(m);
        return Number.isFinite(x) ? x : 400;
      }
      case "line-height": {
        const m = p.toLowerCase();
        if (m === "normal") return { normal: !0 };
        const x = On(m, { fontSize: c.fontSize, viewport: c.viewport });
        return x ? x.unitless ? { factor: x.num } : { px: x.px + x.pct / 100 * c.fontSize } : { normal: !0 };
      }
      case "font-family":
        return p;
      case "opacity":
      case "flex-grow":
      case "flex-shrink": {
        const m = p.endsWith("%") ? parseFloat(p) / 100 : parseFloat(p);
        return Number.isFinite(m) ? m : parseFloat(i === "flex-shrink" || i === "opacity" ? 1 : 0);
      }
      case "color": {
        const m = zi(p, (x) => this.themeHex(x));
        return m === "currentcolor" || !m ? d?.color ?? { rgba: [0, 0, 0, 1], token: null } : m;
      }
      case "background-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const m = zi(p, (x) => this.themeHex(x));
        return m === "currentcolor" ? s.color : m ?? { rgba: [0, 0, 0, 0], token: null, unreadable: p };
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
        return Ho(p, c);
      default:
        return p.toLowerCase().startsWith("var(") ? p : /^[a-z-]+$/i.test(p) ? p.toLowerCase() : p;
    }
  }
}
function dd(n) {
  return n === "inline" || n === "inline-block" || n === "contents" ? "block" : n === "inline-flex" ? "flex" : n === "inline-grid" ? "grid" : n;
}
const ki = (n) => n && n.rgba ? { value: Hh(n.rgba), token: n.token ?? null } : null, Jh = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
function Lh(n, i) {
  const o = i?.(n);
  if (Number.isFinite(o)) return o;
  const c = Math.round(n * 100) / 100;
  return Jh[c] ?? Math.round(n * 1.2);
}
function Lo(n, i) {
  const o = n["line-height"], c = n["font-size"];
  return o.normal ? Lh(c, i) : o.factor !== void 0 ? o.factor * c : o.px;
}
const Wh = (n) => ie(n, ",").map((i) => i.trim().replace(/^["']|["']$/g, "")).join(", ");
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
const Fh = "perch-native-description/1", Mn = Symbol("display"), Ei = {
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
}, Ih = ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"];
for (const n of Ih) Ei[n] = /^(w|h|min_|max_|top|right|bottom|left)/.test(n) ? "auto" : 0;
Ei.rounded = 0;
const $h = /* @__PURE__ */ new Set([
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
]), Ph = /(-apple-system|blinkmacsystemfont|system-ui|segoe ui|sans-serif|times)/i, t0 = /(ui-monospace|sfmono|sf mono|menlo|monospace)/i, e0 = (n) => t0.test(n) ? "Menlo" : Ph.test(n) ? ".SystemUIFont" : Wh(n).split(",")[0].trim(), a0 = {
  click: ["onClick", "onClickCapture"],
  double_click: ["onDoubleClick"],
  context_menu: ["onContextMenu"],
  mouse_down: ["onPointerDown", "onMouseDown", "onPointerDownCapture", "onMouseDownCapture"],
  mouse_up: ["onPointerUp", "onMouseUp", "onPointerCancel"],
  mouse_move: ["onPointerMove", "onMouseMove"],
  key_down: ["onKeyDown", "onKeyUp"],
  focus: ["onFocus", "onBlur"],
  input: ["onChange", "onInput"]
}, md = { pointerdown: "mouse_down", mousedown: "mouse_down", click: "click", keydown: "key_down", pointerup: "mouse_up", mouseup: "mouse_up" }, Wd = (n) => {
  const i = n.props["data-testid"];
  if (i) return `${n.tagName}[data-testid="${i}"]`;
  if (n.props.id) return `${n.tagName}#${n.props.id}`;
  const o = n.classList.find((s) => !s.includes(":") && !s.includes("[")) ?? n.classList[0];
  if (o) return `${n.tagName}.${o}`;
  const c = n.parentElement;
  return c && c.tagName !== "body" ? `${Wd(c)} > ${n.tagName}` : n.tagName;
};
class n0 {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  add(i, o, c, s, d, p = "") {
    const m = `${i}|${o}|${c}|${s}`, x = this.map.get(m);
    if (x) {
      !x.elements.includes(d) && x.elements.length < 4 && x.elements.push(d), x.count++;
      return;
    }
    this.map.set(m, { kind: i, property: o, value: String(c), class: s ?? null, elements: [d], count: 1, ...p ? { note: p } : {} });
  }
  list() {
    return [...this.map.values()].sort((i, o) => i.kind < o.kind ? -1 : i.kind > o.kind ? 1 : i.property < o.property ? -1 : i.property > o.property ? 1 : 0);
  }
}
const ca = (n) => {
  if (n != null) {
    if (typeof n == "string") return n === "auto" || n === "none" || n === "normal" ? "auto" : void 0;
    if ("px" in n) return Math.round(Math.min(Math.max(n.px, -9999), 9999) * 100) / 100;
    if ("pct" in n) return `${Math.round(n.pct * 1e3) / 1e3}%`;
  }
}, l0 = /^(text|search|url|email|tel|password|number)$/, i0 = 162.13 / 12.8;
function r0(n, i) {
  if (typeof n != "object" || !n?.expr) return !1;
  const o = On(n.expr, { fontSize: i["font-size"] }), c = (i["margin-left"]?.px ?? NaN) + (i["margin-right"]?.px ?? NaN);
  return !!o && !o.num && o.pct === 100 && Math.abs(o.px + c) < 0.01;
}
function Fd(n) {
  const i = n.transform;
  if (i && i !== "none") {
    const c = /^\s*translate(X|Y)?\(([^]*)\)\s*$/.exec(i), s = c && ie(c[2], ",").map((d) => d.trim());
    return !s || s.length > (c[1] ? 1 : 2) ? null : c[1] === "X" ? [s[0], "0"] : c[1] === "Y" ? ["0", s[0]] : [s[0], s[1] ?? "0"];
  }
  const o = n.translate;
  if (o && o !== "none") {
    const c = ie(String(o).trim(), " ").filter(Boolean);
    return c.length > 3 || c[2] !== void 0 && On(c[2], {})?.px ? null : [c[0], c[1] ?? "0"];
  }
  return [];
}
function fd(n, i, o, c = !1) {
  const s = n.values, d = Fd(s);
  if (d?.length === 0) return;
  const p = s.transform && s.transform !== "none" ? "transform" : "translate", m = { fontSize: s["font-size"] }, x = (D, k) => {
    const g = On(D, m);
    if (!(!g || g.unitless && g.num))
      return g.pct ? typeof k == "number" ? g.px + g.pct / 100 * k : void 0 : g.px;
  }, w = d ? x(d[0], i.w) : void 0, M = d ? x(d[1], i.h) : void 0;
  if (w === void 0 || M === void 0) {
    o("unsupported", p, s[p], n.sources[p]);
    return;
  }
  if (c) {
    w && (i.left = w), M && (i.top = M);
    return;
  }
  w && (i.ml = (i.ml ?? 0) + w), M && (i.mt = (i.mt ?? 0) + M);
}
function pd(n, i, o = null) {
  const c = n.values, s = {}, d = (E) => n.sources[E], p = (E) => n.sources[E] !== void 0, m = c.display;
  m === "none" ? s.display = "hidden" : m === "flex" || m === "inline-flex" ? s.display = "flex" : (m === "grid" || m === "inline-grid") && (s.display = "flex", s.flex_direction = "col", i("approximated", "display", m, d("display"), "one-column flex column"), c["grid-template-columns"] && c["grid-template-columns"] !== "none" && i("unsupported", "grid-template-columns", c["grid-template-columns"], d("grid-template-columns"))), n.element.hidden && (s.display = "hidden");
  const x = s.display === "flex";
  if (x && s.flex_direction !== "col") {
    const E = { row: "row", column: "col", "row-reverse": "row_reverse", "column-reverse": "col_reverse" }[c["flex-direction"]] ?? "row";
    s.flex_direction = E;
  }
  if (x) {
    (c["flex-wrap"] === "wrap" || c["flex-wrap"] === "wrap-reverse") && (s.flex_wrap = "wrap");
    const E = m === "grid" || m === "inline-grid", N = { "flex-start": "start", start: "start", "self-start": "start", "flex-end": "end", end: "end", "self-end": "end", center: "center", baseline: "baseline", "first baseline": "baseline" }[c["align-items"]];
    N && (s.items = N);
    let A = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", "space-between": "between", "space-around": "around", "space-evenly": "evenly" }[c["justify-content"]];
    if (E) {
      const b = { center: "center", end: "end", "flex-end": "end", start: "start", "flex-start": "start" }[c["justify-items"]];
      b && (s.items = b), c["align-items"] === "center" && (A = "center");
    }
    A && (s.justify = A);
    const H = ca(c["row-gap"]), C = ca(c["column-gap"]);
    typeof H == "number" && H && (s.gap_y = H), typeof C == "number" && C && !E && (s.gap_x = C);
  }
  c["flex-grow"] && (s.flex_grow = c["flex-grow"]), c["flex-shrink"] !== 1 && (s.flex_shrink = c["flex-shrink"]);
  const w = ca(c["flex-basis"]);
  w !== void 0 && w !== "auto" && (s.flex_basis = w);
  const M = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", baseline: "baseline", stretch: "stretch" }[c["align-self"]];
  M && (s.self = M);
  for (const [E, N] of [["w", "width"], ["h", "height"], ["min_w", "min-width"], ["min_h", "min-height"], ["max_w", "max-width"], ["max_h", "max-height"]]) {
    const A = c[N], H = ca(A);
    if (H === void 0 && N === "width" && r0(A, c)) {
      s.self = "stretch", i("approximated", N, A.expr, d(N), "stretched across its parent, inside its margins");
      continue;
    }
    if (H === void 0) {
      typeof A == "object" && A.expr ? i("unsupported", N, A.expr, d(N), "no calc() in the engine") : typeof A == "string" && !["auto", "none"].includes(A) && i("unsupported", N, A, d(N));
      continue;
    }
    H !== "auto" && (s[E] = H);
  }
  const D = ["top", "right", "bottom", "left"];
  for (const E of D) {
    const N = E[0];
    for (const [A, H] of [["p", "padding"], ["m", "margin"]]) {
      const C = c[`${H}-${E}`], b = ca(C);
      if (b === void 0) {
        C?.expr && i("unsupported", `${H}-${E}`, C.expr, d(`${H}-${E}`), "no calc() in the engine");
        continue;
      }
      b !== 0 && (s[`${A}${N}`] = b);
    }
  }
  const k = c.position;
  if (k === "absolute" || k === "fixed") {
    s.position = "absolute", k === "fixed" && i("approximated", "position", "fixed", d("position"), "absolute in the overlay layer");
    for (const E of D) {
      const N = ca(c[E]);
      N !== void 0 && N !== "auto" && (s[E] = N);
    }
    if (k === "fixed" && o && s.w === void 0 && s.right === void 0 && typeof s.left == "number") {
      const E = o.width - s.left - (typeof s.ml == "number" ? s.ml : 0) - (typeof s.mr == "number" ? s.mr : 0);
      s.max_w = typeof s.max_w == "number" ? Math.min(s.max_w, E) : E;
    }
    fd(n, s, i);
  } else k === "sticky" ? i("unsupported", "position", "sticky", d("position")) : Fd(c)?.length !== 0 && (s.position = "relative", fd(n, s, i, !0));
  c["z-index"] !== "auto" && p("z-index") && i("unsupported", "z-index", c["z-index"], d("z-index"), "paint order is tree order");
  for (const [E, N] of [["overflow_x", "overflow-x"], ["overflow_y", "overflow-y"]]) {
    const A = c[N];
    A === "hidden" || A === "clip" ? s[E] = "hidden" : (A === "auto" || A === "scroll") && (s[E] = "scroll");
  }
  (c.visibility === "hidden" || c.visibility === "collapse") && (s.visibility = "invisible");
  const g = c["background-color"];
  g?.unreadable ? i("unsupported", "background-color", g.unreadable, d("background-color")) : g?.rgba && g.rgba[3] > 0 && (s.bg = ki(g)), c["background-image"] && c["background-image"] !== "none" && i("unsupported", "background-image", c["background-image"], d("background-image"));
  const S = D.map((E) => ca(c[`border-${E}-width`]) || 0), _ = [];
  D.forEach((E, N) => {
    if (!S[N]) return;
    s[`border_${E[0]}`] = S[N];
    const A = c[`border-${E}-style`];
    A !== "solid" && i("approximated", `border-${E}-style`, A, d(`border-${E}-style`), "drawn solid");
    const H = ki(c[`border-${E}-color`]);
    H && _.push(H);
  }), _.length && (s.border_color = _[0], _.some((E) => E.value !== _[0].value) && i("approximated", "border-color", _.map((E) => E.value).join(" "), d("border-top-color"), "one border colour"));
  const z = ["top-left", "top-right", "bottom-right", "bottom-left"].map((E) => ca(c[`border-${E}-radius`]) || 0);
  z.every((E) => E === z[0]) ? z[0] && (s.rounded = z[0]) : ["tl", "tr", "br", "bl"].forEach((E, N) => {
    z[N] && (s[`rounded_${E}`] = z[N]);
  }), c.opacity !== 1 && (s.opacity = Math.round(c.opacity * 1e3) / 1e3);
  const Y = c["box-shadow"];
  if (Y && Y !== "none" && ie(Y, ",").some((E) => !/^0(px)?\s+0(px)?\s+(0(px)?\s+)?(0(px)?\s+)?(#0000|transparent|rgba?\(0,\s*0,\s*0,\s*0\))/.test(E.trim())) && (s.shadow = "lg", i("approximated", "box-shadow", Y, d("box-shadow"), "the engine's large shadow preset")), c.cursor && c.cursor !== "auto" && !n.inherited.has("cursor")) {
    const E = { pointer: "pointer", default: "default", text: "text", move: "move", "not-allowed": "not_allowed", grab: "move", grabbing: "move" }[c.cursor];
    E ? s.cursor = E : i("unsupported", "cursor", c.cursor, d("cursor"));
  }
  return c["text-overflow"] === "ellipsis" && (s.text_ellipsis = !0), c["text-decoration-line"] === "underline" ? s.underline = !0 : c["text-decoration-line"] && c["text-decoration-line"] !== "none" && i("unsupported", "text-decoration-line", c["text-decoration-line"], d("text-decoration-line")), s;
}
const o0 = { "tabular-nums": "tnum", "proportional-nums": "pnum", "lining-nums": "lnum", "oldstyle-nums": "onum", "slashed-zero": "zero", "diagonal-fractions": "frac", "stacked-fractions": "afrc", ordinal: "ordn" };
function Id(n) {
  if (!n || n === "normal") return "";
  const i = String(n).trim().split(/\s+/).map((o) => o0[o]);
  return i.every(Boolean) ? i.join(",") : null;
}
function hd(n, i) {
  const o = n.values, c = o["line-height"];
  return {
    text_color: ki(o.color),
    text_size: Math.round(o["font-size"] * 1e3) / 1e3,
    font_features: Id(o["font-variant-numeric"]) ?? "",
    font_weight: o["font-weight"],
    line_height: c.factor !== void 0 ? { factor: c.factor } : { px: Math.round(Lo(o, i) * 1e3) / 1e3 },
    font_family: e0(o["font-family"]),
    italic: o["font-style"] === "italic" || o["font-style"] === "oblique",
    whitespace: o["white-space"] === "nowrap" || o["white-space"] === "pre" ? "nowrap" : "normal",
    text_align: { center: "center", right: "right", end: "right" }[o["text-align"]] ?? "left"
  };
}
const gd = (n, i) => n.factor !== void 0 ? n.factor * i : n.px, $d = (n, i) => JSON.stringify(n) === JSON.stringify(i);
function bd(n, i, o) {
  const c = {}, s = (m, x) => x.some((w) => !n.inherited.has(w));
  for (const [m, x] of [["text_color", ["color"]], ["text_size", ["font-size"]], ["font_weight", ["font-weight"]], ["font_family", ["font-family"]], ["italic", ["font-style"]], ["whitespace", ["white-space"]], ["text_align", ["text-align"]], ["font_features", ["font-variant-numeric"]]])
    (s(m, x) || !$d(i[m], o[m])) && (c[m] = i[m]);
  const d = gd(i.line_height, i.text_size), p = o.line_height ? gd(o.line_height, i.text_size) : NaN;
  return (s("line_height", ["line-height"]) || !(Math.abs(d - p) <= 1e-3)) && (c.line_height = i.line_height), c;
}
const s0 = (n, i) => ({ ...n, ...i });
function vd(n, i) {
  const o = {};
  for (const [c, s] of Object.entries(n))
    s && typeof s == "object" && "value" in s ? (o[c] = s.value, s.token && (i[c] = s.token)) : c === "line_height" ? o[c] = s.factor !== void 0 ? Math.round(s.factor * 1e3) / 1e3 : `${s.px}px` : c === "italic" ? s && (o.italic = !0) : o[c] = s;
  return o.italic === !1 && delete o.italic, o;
}
function c0(n, i) {
  const o = {};
  for (const c of /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(i)])) {
    const s = n[c], d = i[c];
    $d(s, d) || (o[c] = d === void 0 ? c in Ei ? Ei[c] : null : d);
  }
  return o;
}
function yd(n, i) {
  const o = n.values;
  for (const [c, s] of Object.entries(n.sources)) {
    if (c.startsWith("--") || $h.has(c) || s.startsWith("ua:")) continue;
    const d = o[c];
    switch (c) {
      case "letter-spacing":
        d !== "normal" && d?.px !== 0 && i("approximated", c, d?.px !== void 0 ? `${Math.round(d.px * 1e3) / 1e3}px` : d, s, "the run is as wide as with the spacing (room after it), the letters are not spread");
        break;
      case "font-variant-numeric":
        d !== "normal" && Id(d) === null && i("unsupported", c, d, s);
        break;
      case "text-transform":
        d !== "none" && i("approximated", c, d, s, "applied to the text in JS");
        break;
      case "transition-property":
      case "transition-duration": {
        const p = o["transition-duration"];
        c === "transition-property" && p && ie(p, ",").some((m) => parseFloat(m) > 0) && o["transition-property"] !== "none" && i("unsupported", "transition", `${o["transition-property"]} ${p}`, s, "changes are instant (the engine animates only opacity and size)");
        break;
      }
      case "-webkit-line-clamp":
        d !== "none" && i("unsupported", c, d, s, "no line clamp in the engine");
        break;
      case "-webkit-box-orient":
      case "overflow-wrap":
        c === "overflow-wrap" && d !== "normal" && i("approximated", c, d, s, "lines broken by the translator where the box's width is known (`break_anywhere`)");
        break;
      case "outline-style":
      case "outline-width":
      case "outline-color":
        o["outline-style"] !== "none" && c === "outline-style" && i("unsupported", "outline", `${ca(o["outline-width"])}px ${o["outline-style"]} ${ki(o["outline-color"])?.value ?? ""}`.trim(), s, "no outline in the engine (no focus ring)");
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
        d && d !== "none" && d !== "auto" && d !== "normal" && d !== "initial" && i("unsupported", c, d, s);
        break;
    }
  }
}
function u0(n, i, o, c) {
  const s = Wd(n), d = [], p = (z, Y, E, N, A) => d.push([z, Y, E, N ?? "(user agent)", s, A]), m = c.cascade.compute(n, i), x = {}, w = pd(m, p, c.viewport);
  yd(m, p);
  const M = hd(m, c.measure), D = bd(m, M, o), k = vd({ ...w, ...D }, x), g = {}, S = c.cascade.matching(n, "*").filter((z) => z.states.subject.size);
  for (const [z, Y] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
    if (!S.some((C) => Y.some((b) => C.states.subject.has(b)))) continue;
    const E = c.cascade.compute(n, i, new Set(Y)), N = {}, A = vd({ ...pd(E, () => {
    }), ...bd(E, hd(E, c.measure), o) }, N);
    z === "focus" && yd(E, p);
    const H = c0(k, A);
    if (Object.keys(H).length) {
      g[z] = H;
      const C = Object.fromEntries(Object.entries(N).filter(([b]) => b in H));
      Object.keys(C).length && (g[`${z}_tokens`] = C);
    }
  }
  if (c.cascade.sheet.tracks(n, "hover") && (g.track_hover = !0), /tabular/.test(String(m.values["font-variant-numeric"] ?? "")) && (g.tabular = !0), /^(anywhere|break-word)$/.test(String(m.values["overflow-wrap"] ?? "")) && (g.break_anywhere = !0), w.overflow_y === "scroll") {
    const z = Number.parseFloat(m.customs?.["--scrollbar-size"] ?? "");
    z > 0 && (g.scrollbar = z);
  }
  m.values["pointer-events"] !== "none" && i?.values["pointer-events"] === "none" && (g.blocks_pointer = !0);
  const _ = Object.entries(a0).filter(([, z]) => z.some((Y) => typeof n.props[Y] == "function")).map(([z]) => z);
  return !_.includes("click") && Mo(n) && _.push("click"), _.length && (g.events = _), { computed: m, style: k, tokens: x, extra: g, meta: p0(n), reports: d, childText: s0(o, D), where: s };
}
function Pd(n, i, o, c, s = "") {
  const d = `${s}/${n.id}.${n.version}`;
  let p = c.cache.get(n);
  (!p || p.key !== d) && c.cache.set(n, p = { key: d, part: u0(n, i, o, c) });
  const { computed: m, tokens: x, extra: w, reports: M, childText: D, where: k } = p.part;
  for (const h of M) c.findings.add(...h);
  const g = (h, G, J, at, ot) => c.findings.add(h, G, J, at, k, ot), S = { ...p.part.style }, _ = { kind: "div", id: n.id, style: S, tokens: x, meta: p.part.meta, ...w };
  Object.defineProperty(_, Mn, { value: m.values.display });
  const z = n.tagName;
  if (z === "svg")
    return _.kind = n.props["data-perch-image"] ? "image" : "svg", _.markup = g0(n), _;
  if (z === "input" || z === "textarea" || z === "select") {
    _.kind = "input", _.input_type = z === "input" ? String(n.props.type ?? "text") : z;
    for (const h of ["placeholder", "checked", "disabled"]) n.props[h] !== void 0 && (_[h] = n.props[h]);
    return /^(checkbox|radio)$/.test(_.input_type) && (_.checked = n.checked), z !== "select" && (_.value = n.value), z === "input" && l0.test(_.input_type) && (_.field_w = i0 * m.values["font-size"]), _;
  }
  if (z === "img") {
    _.kind = "image", _.src = n.props.src ?? null;
    for (const [h, G] of [["width", "w"], ["height", "h"]]) {
      const J = Number(n.props[h]);
      S[G] === void 0 && n.props[h] != null && Number.isFinite(J) && (S[G] = J);
    }
    return _;
  }
  const Y = m.values["text-transform"], E = [];
  let N = !1, A = !1;
  for (const h of n.childNodes) {
    if (h instanceof Ai) {
      if (h.hidden || h.data === "") continue;
      N = !0;
      const at = E[E.length - 1];
      if (at?.kind === "text")
        at.source = (at.source ?? at.text) + h.data, at.text = xd(at.source, Y), at.text === at.source && delete at.source;
      else {
        const ot = xd(h.data, Y);
        E.push(ot === h.data ? { kind: "text", text: ot } : { kind: "text", text: ot, source: h.data });
      }
      continue;
    }
    if (!(h instanceof re)) continue;
    const G = Pd(h, m, D, c, d), J = G[Mn];
    J === "inline" || J === "inline-block" || J === "inline-flex" ? N = !0 : J !== "none" && (A = !0), E.push(G);
  }
  const H = E.some((h) => h.kind !== "text"), C = E.length === 1 && E[0].kind !== "text" && /^inline-(block|flex)$/.test(E[0][Mn]) ? E[0] : null;
  if (!S.display && C) {
    const h = c.cache.get(n.childNodes.find((J) => J.id === C.id))?.part.computed, G = h ? Uo(m.values, c.measure) - f0(h.values, c.measure) : 0;
    S.display = "flex", S.flex_direction = "col", S.items = "start", G > 0 && (C.style.mt = Math.round(((C.style.mt ?? 0) + G) * 100) / 100), g("approximated", "display", `${m.values.display} holding one ${C[Mn]} box`, "(inline formatting)", "a column, the box lowered to the line's baseline");
  } else if (!S.display && E.length === 1 && (E[0].kind === "svg" || E[0].kind === "image") && E[0][Mn] === "inline" && typeof E[0].style.h == "number") {
    const h = E[0], G = Uo(m.values, c.measure), J = Lo(m.values, c.measure) - G, at = (ot) => Math.round(ot * 100) / 100;
    S.display = "flex", S.flex_direction = "col", S.items = "start", G > h.style.h && (h.style.mt = at((h.style.mt ?? 0) + G - h.style.h)), J > 0 && (h.style.mb = at((h.style.mb ?? 0) + J)), g("approximated", "display", `${m.values.display} holding one inline image`, "(inline formatting)", "a column, the image on the line's baseline");
  } else if (!S.display && N && H) {
    if (S.display = "flex", S.flex_direction = A ? "col" : "row", !A) S.items = "baseline";
    else for (const h of E) h.kind !== "text" && /^inline-(block|flex)$/.test(h[Mn]) && !h.style.self && (h.style.self = "start");
    g("approximated", "display", `${m.values.display} with inline content`, "(inline formatting)", A ? "a column of its children" : "a row on the text baseline");
  }
  const b = m.values["letter-spacing"]?.px;
  if (b)
    for (let h = 0; h < E.length; h++) {
      const G = E[h];
      if (G.kind !== "text") continue;
      const J = Math.round(b * [...G.text].length * 1e3) / 1e3;
      E[h] = { kind: "div", style: { pr: J }, tokens: {}, children: [G] };
    }
  return _.children = E, _;
}
function d0(n, i) {
  if (!i) return null;
  let c = (i.self ? n : i.closest ? Gd(n, i.closest) : i.find ? fl(n, i.find)[0] : null)?.getAttribute(i.attr) ?? null;
  return c && i.strip && c.startsWith(i.strip) && (c = c.slice(i.strip.length)), c;
}
function m0(n, i, o) {
  const c = i.map((p) => [p, Mi(p.selector)]), s = /* @__PURE__ */ new Map(), d = (p) => {
    for (const m of p.children) {
      const x = o.get(m.id);
      if (x)
        for (const [w, M] of c) {
          const D = w.textRange ? "range_name" : "name";
          if (x[D] != null || !M.some((S) => Yd(m, S))) continue;
          const k = d0(m, w.key), g = k == null ? s.get(w.name) ?? 0 : 0;
          k == null && s.set(w.name, g + 1), x[D] = k != null ? `${w.name}:${k}` : g ? `${w.name}@${g}` : w.name;
        }
      d(m);
    }
  };
  d(n.documentElement);
}
const Ni = 0.9521, tm = 0.2256, Uo = (n, i) => (Lo(n, i) - (Ni + tm) * n["font-size"]) / 2 + Ni * n["font-size"];
function f0(n, i) {
  const o = (s) => s && typeof s == "object" && "px" in s ? s.px : 0, c = n["border-top-style"] === "none" ? 0 : o(n["border-top-width"]);
  return o(n["padding-top"]) + c + Uo(n, i);
}
const xd = (n, i) => i === "uppercase" ? n.toUpperCase() : i === "lowercase" ? n.toLowerCase() : i === "capitalize" ? n.replace(/\b\p{L}/gu, (o) => o.toUpperCase()) : n, em = /* @__PURE__ */ new Set(["children", "style", "className", "key", "ref", "dangerouslySetInnerHTML"]);
function p0(n) {
  const i = {};
  for (const [o, c] of Object.entries(n.props)) {
    if (em.has(o) || typeof c == "function" || c === void 0 || c === null || typeof c == "object") continue;
    const s = o.startsWith("aria-") || o.startsWith("data-");
    if (c === !1 && !s) continue;
    const d = o === "htmlFor" ? "for" : o === "tabIndex" ? "tabindex" : o;
    i[d] = typeof c == "boolean" ? s ? String(c) : "" : String(c);
  }
  return { tag: n.tagName, classes: n.classList, attrs: i };
}
const h0 = (n) => n === "className" ? "class" : /^(viewBox|preserveAspectRatio|gradientUnits|gradientTransform|patternUnits|xmlns)$/.test(n) ? n : n.replace(/[A-Z]/g, (i) => `-${i.toLowerCase()}`), wd = (n) => String(n).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function g0(n) {
  if (n.props["data-perch-markup"]) return String(n.props["data-perch-markup"]);
  const i = (o) => {
    const c = [];
    for (const [d, p] of Object.entries(o.props))
      em.has(d) || typeof p == "function" || p === void 0 || p === null || p === !1 || typeof p == "object" || d.startsWith("data-") || d.startsWith("aria-") || d === "focusable" || d === "role" || d === "title" || c.push(`${h0(d)}="${wd(p === !0 ? "" : p)}"`);
    o.tagName === "svg" && !o.props.xmlns && c.unshift('xmlns="http://www.w3.org/2000/svg"');
    const s = o.childNodes.map((d) => d instanceof Ai ? wd(d.data) : i(d)).join("");
    return `<${o.tagName}${c.length ? ` ${c.join(" ")}` : ""}>${s}</${o.tagName}>`;
  };
  return i(n);
}
function b0(n) {
  const i = n.theme?.() ?? {}, o = {};
  for (const c of Xd) i[c] && (o[c] = i[c]);
  return o;
}
const v0 = { font_features: "" };
function y0(n, i, o, c = {}, s = null) {
  const d = b0(i), p = i.viewport?.() ?? { width: 1e3, height: 800 }, m = JSON.stringify([d, p]);
  (c.look !== m || c.sheet !== o) && Object.assign(c, { look: m, sheet: o, cache: /* @__PURE__ */ new WeakMap(), cascade: new Zh(o, { theme: d, viewport: p }), top: null });
  const { cascade: x, cache: w } = c, M = { cascade: x, cache: w, viewport: p, findings: new n0(), measure: i.lineHeight ? (g) => i.lineHeight(g) : null };
  c.top ??= x.compute(n.body, x.compute(n.documentElement, null));
  const D = n.body.children.map((g) => Pd(g, c.top, v0, M));
  if (s?.length) {
    const g = /* @__PURE__ */ new Map(), S = (_) => {
      _.id && g.set(_.id, _);
      for (const z of _.children ?? []) S(z);
    };
    D.forEach(S), m0(n, s, g);
  }
  const k = /* @__PURE__ */ new Set();
  for (const g of [n, n.defaultView])
    for (const { type: S } of g?.listeners ?? []) md[S] && k.add(md[S]);
  return { schema: Fh, root: D[0] ?? null, overlays: D.slice(1), document_events: [...k].sort(), unsupported: M.findings.list() };
}
const x0 = { layers: ["properties", "theme", "base", "utilities"], properties: { "--tw-translate-x": { inherits: !1, initial: "0" }, "--tw-translate-y": { inherits: !1, initial: "0" }, "--tw-translate-z": { inherits: !1, initial: "0" }, "--tw-rotate-x": { inherits: !1, initial: null }, "--tw-rotate-y": { inherits: !1, initial: null }, "--tw-rotate-z": { inherits: !1, initial: null }, "--tw-skew-x": { inherits: !1, initial: null }, "--tw-skew-y": { inherits: !1, initial: null }, "--tw-space-y-reverse": { inherits: !1, initial: "0" }, "--tw-border-style": { inherits: !1, initial: "solid" }, "--tw-leading": { inherits: !1, initial: null }, "--tw-font-weight": { inherits: !1, initial: null }, "--tw-tracking": { inherits: !1, initial: null }, "--tw-ordinal": { inherits: !1, initial: null }, "--tw-slashed-zero": { inherits: !1, initial: null }, "--tw-numeric-figure": { inherits: !1, initial: null }, "--tw-numeric-spacing": { inherits: !1, initial: null }, "--tw-numeric-fraction": { inherits: !1, initial: null }, "--tw-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-shadow-color": { inherits: !1, initial: null }, "--tw-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-inset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-shadow-color": { inherits: !1, initial: null }, "--tw-inset-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-ring-color": { inherits: !1, initial: null }, "--tw-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-inset-ring-color": { inherits: !1, initial: null }, "--tw-inset-ring-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-ring-inset": { inherits: !1, initial: null }, "--tw-ring-offset-width": { inherits: !1, initial: "0" }, "--tw-ring-offset-color": { inherits: !1, initial: "#fff" }, "--tw-ring-offset-shadow": { inherits: !1, initial: "0 0 #0000" }, "--tw-outline-style": { inherits: !1, initial: "solid" }, "--tw-blur": { inherits: !1, initial: null }, "--tw-brightness": { inherits: !1, initial: null }, "--tw-contrast": { inherits: !1, initial: null }, "--tw-grayscale": { inherits: !1, initial: null }, "--tw-hue-rotate": { inherits: !1, initial: null }, "--tw-invert": { inherits: !1, initial: null }, "--tw-opacity": { inherits: !1, initial: null }, "--tw-saturate": { inherits: !1, initial: null }, "--tw-sepia": { inherits: !1, initial: null }, "--tw-drop-shadow": { inherits: !1, initial: null }, "--tw-drop-shadow-color": { inherits: !1, initial: null }, "--tw-drop-shadow-alpha": { inherits: !1, initial: "100%" }, "--tw-drop-shadow-size": { inherits: !1, initial: null }, "--tw-backdrop-blur": { inherits: !1, initial: null }, "--tw-backdrop-brightness": { inherits: !1, initial: null }, "--tw-backdrop-contrast": { inherits: !1, initial: null }, "--tw-backdrop-grayscale": { inherits: !1, initial: null }, "--tw-backdrop-hue-rotate": { inherits: !1, initial: null }, "--tw-backdrop-invert": { inherits: !1, initial: null }, "--tw-backdrop-opacity": { inherits: !1, initial: null }, "--tw-backdrop-saturate": { inherits: !1, initial: null }, "--tw-backdrop-sepia": { inherits: !1, initial: null }, "--tw-duration": { inherits: !1, initial: null }, "--tw-ease": { inherits: !1, initial: null }, "--tw-content": { inherits: !1, initial: '""' } }, rules: [[":root, :host", null, 2, [["--spacing", ".25rem"], ["--text-xs", ".75rem"], ["--text-xs--line-height", "calc(1 / .75)"], ["--text-sm", ".875rem"], ["--text-sm--line-height", "calc(1.25 / .875)"], ["--font-weight-normal", "400"], ["--font-weight-medium", "500"], ["--font-weight-semibold", "600"], ["--font-weight-bold", "700"], ["--tracking-normal", "0em"], ["--tracking-wide", ".025em"], ["--leading-tight", "1.25"], ["--leading-relaxed", "1.625"], ["--ease-out", "cubic-bezier(0, 0, .2, 1)"], ["--animate-pulse", "pulse 2s cubic-bezier(.4, 0, .6, 1) infinite"], ["--blur-xl", "24px"], ["--default-transition-duration", ".15s"], ["--default-transition-timing-function", "cubic-bezier(.4, 0, .2, 1)"], ["--animate-toast-in", "toast-in .2s cubic-bezier(.22, 1, .36, 1)"], ["--animate-host-pulse", "host-connecting-pulse 1.4s ease-in-out infinite"], ["--animate-drop-zone", "drop-zone-in .14s ease-out, drop-zone-pulse 1.2s ease-in-out .14s infinite"]]], ["::selection", null, 3, [["background", "var(--accent)"], ["color", "var(--panel-bg)"]]], [":where(input, textarea)::placeholder", null, 3, [["color", "var(--subtext-0)"], ["opacity", "1"]]], [":where(button, input, select, textarea)", null, 3, [["border", "0"]]], [':where(button, a[href], select, summary, [role="button"], [role="menuitem"]):focus-visible', null, 3, [["outline", "2px solid var(--accent)"], ["outline-offset", "-2px"]]], ["::-webkit-scrollbar", null, 3, [["width", "var(--scrollbar-size)"], ["height", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-track", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-corner", null, 3, [["background", "none"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["background", "color-mix(in srgb, var(--text) 20%, transparent)"]]], ["::-webkit-scrollbar-thumb", null, 3, [["border-radius", "var(--scrollbar-size)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "var(--text)"]]], ["::-webkit-scrollbar-thumb:hover", null, 3, [["background", "color-mix(in srgb, var(--text) 40%, transparent)"]]], [".xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-slider", null, 3, [["border-radius", "var(--scrollbar-size)"]]], [".\\@container, .\\[container-type\\:inline-size\\]", null, 4, [["container-type", "inline-size"]]], [".pointer-events-auto", null, 4, [["pointer-events", "auto"]]], [".pointer-events-none", null, 4, [["pointer-events", "none"]]], [".collapse", null, 4, [["visibility", "collapse"]]], [".invisible", null, 4, [["visibility", "hidden"]]], [".visible", null, 4, [["visibility", "visible"]]], [".sr-only", null, 4, [["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border-width", "0"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["position", "absolute"], ["overflow", "hidden"]]], [".absolute", null, 4, [["position", "absolute"]]], [".fixed", null, 4, [["position", "fixed"]]], [".relative", null, 4, [["position", "relative"]]], [".static", null, 4, [["position", "static"]]], [".sticky", null, 4, [["position", "sticky"]]], [".inset-0", null, 4, [["inset", "0"]]], [".inset-x-0", null, 4, [["inset-inline", "0"]]], [".inset-x-2", null, 4, [["inset-inline", "calc(var(--spacing) * 2)"]]], [".-top-1", null, 4, [["top", "calc(var(--spacing) * -1)"]]], [".-top-1\\.5", null, 4, [["top", "calc(var(--spacing) * -1.5)"]]], [".top-0", null, 4, [["top", "0"]]], [".top-1", null, 4, [["top", "var(--spacing)"]]], [".top-1\\.5", null, 4, [["top", "calc(var(--spacing) * 1.5)"]]], [".top-1\\/2", null, 4, [["top", "50%"]]], [".top-2", null, 4, [["top", "calc(var(--spacing) * 2)"]]], [".top-4", null, 4, [["top", "calc(var(--spacing) * 4)"]]], [".top-\\[0\\.1rem\\]", null, 4, [["top", ".1rem"]]], [".top-\\[7px\\]", null, 4, [["top", "7px"]]], [".top-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["top", "max(.75rem, env(safe-area-inset-top))"]]], [".top-full", null, 4, [["top", "100%"]]], [".top-px", null, 4, [["top", "1px"]]], [".-right-1", null, 4, [["right", "calc(var(--spacing) * -1)"]]], [".-right-1\\.5", null, 4, [["right", "calc(var(--spacing) * -1.5)"]]], [".right-0", null, 4, [["right", "0"]]], [".right-1", null, 4, [["right", "var(--spacing)"]]], [".right-3", null, 4, [["right", "calc(var(--spacing) * 3)"]]], [".right-4", null, 4, [["right", "calc(var(--spacing) * 4)"]]], [".right-\\[0\\.8rem\\]", null, 4, [["right", ".8rem"]]], [".right-\\[0\\.25rem\\]", null, 4, [["right", ".25rem"]]], [".right-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["right", "max(.75rem, env(safe-area-inset-right))"]]], [".bottom-0", null, 4, [["bottom", "0"]]], [".bottom-2", null, 4, [["bottom", "calc(var(--spacing) * 2)"]]], [".bottom-3", null, 4, [["bottom", "calc(var(--spacing) * 3)"]]], [".bottom-\\[0\\.8rem\\]", null, 4, [["bottom", ".8rem"]]], [".bottom-full", null, 4, [["bottom", "100%"]]], [".-left-8", null, 4, [["left", "calc(var(--spacing) * -8)"]]], [".-left-\\[2px\\]", null, 4, [["left", "-2px"]]], [".left-0", null, 4, [["left", "0"]]], [".left-2", null, 4, [["left", "calc(var(--spacing) * 2)"]]], [".left-\\[0\\.1rem\\]", null, 4, [["left", ".1rem"]]], [".left-\\[max\\(0\\.75rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["left", "max(.75rem, env(safe-area-inset-left))"]]], [".left-px", null, 4, [["left", "1px"]]], [".isolate", null, 4, [["isolation", "isolate"]]], [".z-4", null, 4, [["z-index", "4"]]], [".z-5", null, 4, [["z-index", "5"]]], [".z-10", null, 4, [["z-index", "10"]]], [".z-20", null, 4, [["z-index", "20"]]], [".z-30", null, 4, [["z-index", "30"]]], [".z-40", null, 4, [["z-index", "40"]]], [".z-50", null, 4, [["z-index", "50"]]], [".z-\\[2\\]", null, 4, [["z-index", "2"]]], [".z-\\[3\\]", null, 4, [["z-index", "3"]]], [".z-\\[5\\]", null, 4, [["z-index", "5"]]], [".z-\\[1000\\]", null, 4, [["z-index", "1000"]]], [".z-\\[2000\\]", null, 4, [["z-index", "2000"]]], [".z-\\[2100\\]", null, 4, [["z-index", "2100"]]], [".z-\\[2200\\]", null, 4, [["z-index", "2200"]]], [".z-\\[3000\\]", null, 4, [["z-index", "3000"]]], [".z-\\[3100\\]", null, 4, [["z-index", "3100"]]], [".z-\\[4000\\]", null, 4, [["z-index", "4000"]]], [".z-\\[9998\\]", null, 4, [["z-index", "9998"]]], [".z-\\[9999\\]", null, 4, [["z-index", "9999"]]], [".z-\\[10000\\]", null, 4, [["z-index", "10000"]]], [".z-auto", null, 4, [["z-index", "auto"]]], [".order-last", null, 4, [["order", "9999"]]], [".col-\\[1\\/-1\\]", null, 4, [["grid-column", "1 / -1"]]], [".container", null, 4, [["width", "100%"]]], [".container", ["(min-width: 40rem)"], 4, [["max-width", "40rem"]]], [".container", ["(min-width: 48rem)"], 4, [["max-width", "48rem"]]], [".container", ["(min-width: 64rem)"], 4, [["max-width", "64rem"]]], [".container", ["(min-width: 80rem)"], 4, [["max-width", "80rem"]]], [".container", ["(min-width: 96rem)"], 4, [["max-width", "96rem"]]], [".m-0", null, 4, [["margin", "0"]]], [".m-2", null, 4, [["margin", "calc(var(--spacing) * 2)"]]], [".m-\\[0\\.7rem\\]", null, 4, [["margin", ".7rem"]]], [".m-auto", null, 4, [["margin", "auto"]]], [".mx-0", null, 4, [["margin-inline", "0"]]], [".mx-0\\.5", null, 4, [["margin-inline", "calc(var(--spacing) * .5)"]]], [".mx-2", null, 4, [["margin-inline", "calc(var(--spacing) * 2)"]]], [".mx-3", null, 4, [["margin-inline", "calc(var(--spacing) * 3)"]]], [".mx-4", null, 4, [["margin-inline", "calc(var(--spacing) * 4)"]]], [".mx-\\[0\\.3rem\\]", null, 4, [["margin-inline", ".3rem"]]], [".mx-\\[0\\.7rem\\]", null, 4, [["margin-inline", ".7rem"]]], [".mx-\\[0\\.65rem\\]", null, 4, [["margin-inline", ".65rem"]]], [".mx-\\[3px\\]", null, 4, [["margin-inline", "3px"]]], [".mx-\\[11px\\]", null, 4, [["margin-inline", "11px"]]], [".mx-auto", null, 4, [["margin-inline", "auto"]]], [".my-0\\.5", null, 4, [["margin-block", "calc(var(--spacing) * .5)"]]], [".my-1", null, 4, [["margin-block", "var(--spacing)"]]], [".my-2", null, 4, [["margin-block", "calc(var(--spacing) * 2)"]]], [".my-\\[0\\.2rem\\]", null, 4, [["margin-block", ".2rem"]]], [".my-\\[0\\.3rem\\]", null, 4, [["margin-block", ".3rem"]]], [".my-\\[0\\.6rem\\]", null, 4, [["margin-block", ".6rem"]]], [".my-\\[0\\.28rem\\]", null, 4, [["margin-block", ".28rem"]]], [".my-\\[0\\.45rem\\]", null, 4, [["margin-block", ".45rem"]]], [".my-\\[0\\.55rem\\]", null, 4, [["margin-block", ".55rem"]]], [".my-\\[3px\\]", null, 4, [["margin-block", "3px"]]], [".mt-0", null, 4, [["margin-top", "0"]]], [".mt-0\\.5", null, 4, [["margin-top", "calc(var(--spacing) * .5)"]]], [".mt-1", null, 4, [["margin-top", "var(--spacing)"]]], [".mt-1\\.5", null, 4, [["margin-top", "calc(var(--spacing) * 1.5)"]]], [".mt-2", null, 4, [["margin-top", "calc(var(--spacing) * 2)"]]], [".mt-3", null, 4, [["margin-top", "calc(var(--spacing) * 3)"]]], [".mt-4", null, 4, [["margin-top", "calc(var(--spacing) * 4)"]]], [".mt-\\[0\\.1rem\\]", null, 4, [["margin-top", ".1rem"]]], [".mt-\\[0\\.2rem\\]", null, 4, [["margin-top", ".2rem"]]], [".mt-\\[0\\.3rem\\]", null, 4, [["margin-top", ".3rem"]]], [".mt-\\[0\\.4rem\\]", null, 4, [["margin-top", ".4rem"]]], [".mt-\\[0\\.5rem\\]", null, 4, [["margin-top", ".5rem"]]], [".mt-\\[0\\.15rem\\]", null, 4, [["margin-top", ".15rem"]]], [".mt-\\[0\\.18rem\\]", null, 4, [["margin-top", ".18rem"]]], [".mt-\\[0\\.35rem\\]", null, 4, [["margin-top", ".35rem"]]], [".mr-1", null, 4, [["margin-right", "var(--spacing)"]]], [".mr-1\\.5", null, 4, [["margin-right", "calc(var(--spacing) * 1.5)"]]], [".mr-\\[0\\.3rem\\]", null, 4, [["margin-right", ".3rem"]]], [".mr-\\[0\\.7rem\\]", null, 4, [["margin-right", ".7rem"]]], [".mr-auto", null, 4, [["margin-right", "auto"]]], [".mb-0", null, 4, [["margin-bottom", "0"]]], [".mb-0\\.5", null, 4, [["margin-bottom", "calc(var(--spacing) * .5)"]]], [".mb-1", null, 4, [["margin-bottom", "var(--spacing)"]]], [".mb-2", null, 4, [["margin-bottom", "calc(var(--spacing) * 2)"]]], [".mb-3", null, 4, [["margin-bottom", "calc(var(--spacing) * 3)"]]], [".mb-4", null, 4, [["margin-bottom", "calc(var(--spacing) * 4)"]]], [".mb-8", null, 4, [["margin-bottom", "calc(var(--spacing) * 8)"]]], [".mb-\\[0\\.2rem\\]", null, 4, [["margin-bottom", ".2rem"]]], [".mb-\\[0\\.3rem\\]", null, 4, [["margin-bottom", ".3rem"]]], [".mb-\\[0\\.4rem\\]", null, 4, [["margin-bottom", ".4rem"]]], [".mb-\\[0\\.6rem\\]", null, 4, [["margin-bottom", ".6rem"]]], [".mb-\\[0\\.7rem\\]", null, 4, [["margin-bottom", ".7rem"]]], [".mb-\\[0\\.9rem\\]", null, 4, [["margin-bottom", ".9rem"]]], [".mb-\\[0\\.35rem\\]", null, 4, [["margin-bottom", ".35rem"]]], [".mb-\\[0\\.55rem\\]", null, 4, [["margin-bottom", ".55rem"]]], [".mb-\\[1\\.1rem\\]", null, 4, [["margin-bottom", "1.1rem"]]], [".-ml-1", null, 4, [["margin-left", "calc(var(--spacing) * -1)"]]], [".-ml-2", null, 4, [["margin-left", "calc(var(--spacing) * -2)"]]], [".ml-1", null, 4, [["margin-left", "var(--spacing)"]]], [".ml-2", null, 4, [["margin-left", "calc(var(--spacing) * 2)"]]], [".ml-4", null, 4, [["margin-left", "calc(var(--spacing) * 4)"]]], [".ml-\\[0\\.4rem\\]", null, 4, [["margin-left", ".4rem"]]], [".ml-\\[0\\.5rem\\]", null, 4, [["margin-left", ".5rem"]]], [".ml-\\[0\\.9rem\\]", null, 4, [["margin-left", ".9rem"]]], [".ml-\\[0\\.35rem\\]", null, 4, [["margin-left", ".35rem"]]], [".ml-\\[0\\.55rem\\]", null, 4, [["margin-left", ".55rem"]]], [".ml-\\[1\\.45rem\\]", null, 4, [["margin-left", "1.45rem"]]], [".ml-\\[6\\.1rem\\]", null, 4, [["margin-left", "6.1rem"]]], [".ml-auto", null, 4, [["margin-left", "auto"]]], [".box-border", null, 4, [["box-sizing", "border-box"]]], [".\\!hidden", null, 4, [["display", "none", 1]]], [".\\[display\\:-webkit-box\\]", null, 4, [["display", "-webkit-box"]]], [".\\[display\\:var\\(--pane-grip\\,flex\\)\\]", null, 4, [["display", "var(--pane-grip, flex)"]]], [".block", null, 4, [["display", "block"]]], [".contents", null, 4, [["display", "contents"]]], [".flex", null, 4, [["display", "flex"]]], [".grid", null, 4, [["display", "grid"]]], [".hidden", null, 4, [["display", "none"]]], [".inline", null, 4, [["display", "inline"]]], [".inline-block", null, 4, [["display", "inline-block"]]], [".inline-flex", null, 4, [["display", "inline-flex"]]], [".table", null, 4, [["display", "table"]]], [".size-1", null, 4, [["width", "var(--spacing)"], ["height", "var(--spacing)"]]], [".size-1\\.5", null, 4, [["width", "calc(var(--spacing) * 1.5)"], ["height", "calc(var(--spacing) * 1.5)"]]], [".size-2", null, 4, [["width", "calc(var(--spacing) * 2)"], ["height", "calc(var(--spacing) * 2)"]]], [".size-3", null, 4, [["width", "calc(var(--spacing) * 3)"], ["height", "calc(var(--spacing) * 3)"]]], [".size-5", null, 4, [["width", "calc(var(--spacing) * 5)"], ["height", "calc(var(--spacing) * 5)"]]], [".size-6", null, 4, [["width", "calc(var(--spacing) * 6)"], ["height", "calc(var(--spacing) * 6)"]]], [".size-7", null, 4, [["width", "calc(var(--spacing) * 7)"], ["height", "calc(var(--spacing) * 7)"]]], [".size-8", null, 4, [["width", "calc(var(--spacing) * 8)"], ["height", "calc(var(--spacing) * 8)"]]], [".size-11", null, 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".size-14", null, 4, [["width", "calc(var(--spacing) * 14)"], ["height", "calc(var(--spacing) * 14)"]]], [".size-\\[0\\.6rem\\]", null, 4, [["width", ".6rem"], ["height", ".6rem"]]], [".size-\\[1\\.2rem\\]", null, 4, [["width", "1.2rem"], ["height", "1.2rem"]]], [".size-\\[5px\\]", null, 4, [["width", "5px"], ["height", "5px"]]], [".size-\\[14px\\]", null, 4, [["width", "14px"], ["height", "14px"]]], [".size-\\[calc\\(14px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["width", "calc(14px * var(--zoom, 1))"], ["height", "calc(14px * var(--zoom, 1))"]]], [".size-full", null, 4, [["width", "100%"], ["height", "100%"]]], [".h-1", null, 4, [["height", "var(--spacing)"]]], [".h-1\\.5", null, 4, [["height", "calc(var(--spacing) * 1.5)"]]], [".h-2", null, 4, [["height", "calc(var(--spacing) * 2)"]]], [".h-3", null, 4, [["height", "calc(var(--spacing) * 3)"]]], [".h-4", null, 4, [["height", "calc(var(--spacing) * 4)"]]], [".h-5", null, 4, [["height", "calc(var(--spacing) * 5)"]]], [".h-6", null, 4, [["height", "calc(var(--spacing) * 6)"]]], [".h-7", null, 4, [["height", "calc(var(--spacing) * 7)"]]], [".h-8", null, 4, [["height", "calc(var(--spacing) * 8)"]]], [".h-9", null, 4, [["height", "calc(var(--spacing) * 9)"]]], [".h-11", null, 4, [["height", "calc(var(--spacing) * 11)"]]], [".h-12", null, 4, [["height", "calc(var(--spacing) * 12)"]]], [".h-44", null, 4, [["height", "calc(var(--spacing) * 44)"]]], [".h-\\[1\\.1rem\\]", null, 4, [["height", "1.1rem"]]], [".h-\\[1\\.3rem\\]", null, 4, [["height", "1.3rem"]]], [".h-\\[1\\.4rem\\]", null, 4, [["height", "1.4rem"]]], [".h-\\[1\\.25rem\\]", null, 4, [["height", "1.25rem"]]], [".h-\\[2px\\]", null, 4, [["height", "2px"]]], [".h-\\[14px\\]", null, 4, [["height", "14px"]]], [".h-\\[18px\\]", null, 4, [["height", "18px"]]], [".h-\\[43px\\]", null, 4, [["height", "43px"]]], [".h-\\[calc\\(100\\%-max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\)\\]", null, 4, [["height", "calc(100% - max(.5rem, env(safe-area-inset-top)))"]]], [".h-full", null, 4, [["height", "100%"]]], [".h-px", null, 4, [["height", "1px"]]], [".max-h-40", null, 4, [["max-height", "calc(var(--spacing) * 40)"]]], [".max-h-56", null, 4, [["max-height", "calc(var(--spacing) * 56)"]]], [".max-h-72", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".max-h-\\[8rem\\]", null, 4, [["max-height", "8rem"]]], [".max-h-\\[13rem\\]", null, 4, [["max-height", "13rem"]]], [".max-h-\\[30\\%\\]", null, 4, [["max-height", "30%"]]], [".max-h-\\[30vh\\]", null, 4, [["max-height", "30vh"]]], [".max-h-\\[35vh\\]", null, 4, [["max-height", "35vh"]]], [".max-h-\\[40\\%\\]", null, 4, [["max-height", "40%"]]], [".max-h-\\[50dvh\\]", null, 4, [["max-height", "50dvh"]]], [".max-h-\\[60\\%\\]", null, 4, [["max-height", "60%"]]], [".max-h-\\[70\\%\\]", null, 4, [["max-height", "70%"]]], [".max-h-\\[85vh\\]", null, 4, [["max-height", "85vh"]]], [".max-h-\\[90\\%\\]", null, 4, [["max-height", "90%"]]], [".max-h-\\[190px\\]", null, 4, [["max-height", "190px"]]], [".max-h-\\[240px\\]", null, 4, [["max-height", "240px"]]], [".max-h-\\[260px\\]", null, 4, [["max-height", "260px"]]], [".max-h-\\[calc\\(85vh-4rem\\)\\]", null, 4, [["max-height", "calc(85vh - 4rem)"]]], [".max-h-\\[calc\\(100dvh_-_4rem\\)\\]", null, 4, [["max-height", "calc(100dvh - 4rem)"]]], [".max-h-\\[min\\(420px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(420px, 100dvh - 16vh - 2rem)"]]], [".max-h-\\[min\\(480px\\,calc\\(100dvh_-_16vh_-_2rem\\)\\)\\]", null, 4, [["max-height", "min(480px, 100dvh - 16vh - 2rem)"]]], [".max-h-full", null, 4, [["max-height", "100%"]]], [".min-h-0", null, 4, [["min-height", "0"]]], [".min-h-6", null, 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-h-7", null, 4, [["min-height", "calc(var(--spacing) * 7)"]]], [".min-h-8", null, 4, [["min-height", "calc(var(--spacing) * 8)"]]], [".min-h-9", null, 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".min-h-10", null, 4, [["min-height", "calc(var(--spacing) * 10)"]]], [".min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".min-h-20", null, 4, [["min-height", "calc(var(--spacing) * 20)"]]], [".min-h-40", null, 4, [["min-height", "calc(var(--spacing) * 40)"]]], [".min-h-\\[1\\.5em\\]", null, 4, [["min-height", "1.5em"]]], [".min-h-\\[1\\.8rem\\]", null, 4, [["min-height", "1.8rem"]]], [".min-h-\\[2\\.5rem\\]", null, 4, [["min-height", "2.5rem"]]], [".min-h-\\[3\\.2rem\\]", null, 4, [["min-height", "3.2rem"]]], [".min-h-\\[3\\.25rem\\]", null, 4, [["min-height", "3.25rem"]]], [".min-h-\\[6rem\\]", null, 4, [["min-height", "6rem"]]], [".min-h-\\[8rem\\]", null, 4, [["min-height", "8rem"]]], [".min-h-\\[10rem\\]", null, 4, [["min-height", "10rem"]]], [".min-h-\\[12rem\\]", null, 4, [["min-height", "12rem"]]], [".min-h-\\[13rem\\]", null, 4, [["min-height", "13rem"]]], [".min-h-\\[32px\\]", null, 4, [["min-height", "32px"]]], [".min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".min-h-\\[60px\\]", null, 4, [["min-height", "60px"]]], [".min-h-\\[100dvh\\]", null, 4, [["min-height", "100dvh"]]], [".min-h-\\[calc\\(22px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["min-height", "calc(22px * var(--zoom, 1))"]]], [".min-h-full", null, 4, [["min-height", "100%"]]], [".w-2", null, 4, [["width", "calc(var(--spacing) * 2)"]]], [".w-3", null, 4, [["width", "calc(var(--spacing) * 3)"]]], [".w-4", null, 4, [["width", "calc(var(--spacing) * 4)"]]], [".w-5", null, 4, [["width", "calc(var(--spacing) * 5)"]]], [".w-7", null, 4, [["width", "calc(var(--spacing) * 7)"]]], [".w-8", null, 4, [["width", "calc(var(--spacing) * 8)"]]], [".w-9", null, 4, [["width", "calc(var(--spacing) * 9)"]]], [".w-10", null, 4, [["width", "calc(var(--spacing) * 10)"]]], [".w-20", null, 4, [["width", "calc(var(--spacing) * 20)"]]], [".w-40", null, 4, [["width", "calc(var(--spacing) * 40)"]]], [".w-44", null, 4, [["width", "calc(var(--spacing) * 44)"]]], [".w-\\[1\\.1rem\\]", null, 4, [["width", "1.1rem"]]], [".w-\\[1\\.4rem\\]", null, 4, [["width", "1.4rem"]]], [".w-\\[1\\.6rem\\]", null, 4, [["width", "1.6rem"]]], [".w-\\[1\\.25rem\\]", null, 4, [["width", "1.25rem"]]], [".w-\\[2\\.4rem\\]", null, 4, [["width", "2.4rem"]]], [".w-\\[2\\.25rem\\]", null, 4, [["width", "2.25rem"]]], [".w-\\[6rem\\]", null, 4, [["width", "6rem"]]], [".w-\\[7rem\\]", null, 4, [["width", "7rem"]]], [".w-\\[11rem\\]", null, 4, [["width", "11rem"]]], [".w-\\[15rem\\]", null, 4, [["width", "15rem"]]], [".w-\\[16rem\\]", null, 4, [["width", "16rem"]]], [".w-\\[18px\\]", null, 4, [["width", "18px"]]], [".w-\\[100cqi\\]", null, 4, [["width", "100cqi"]]], [".w-\\[calc\\(\\(100\\%-0\\.875rem\\)\\/8\\)\\]", null, 4, [["width", "calc(12.5% - .109375rem)"]]], [".w-\\[calc\\(100\\%_-_0\\.6rem\\)\\]", null, 4, [["width", "calc(100% - .6rem)"]]], [".w-\\[calc\\(100\\%_-_1rem\\)\\]", null, 4, [["width", "calc(100% - 1rem)"]]], [".w-\\[min\\(22rem\\,calc\\(100vw-3rem\\)\\)\\]", null, 4, [["width", "min(22rem, 100vw - 3rem)"]]], [".w-\\[min\\(26rem\\,100\\%\\)\\]", null, 4, [["width", "min(26rem, 100%)"]]], [".w-\\[min\\(28rem\\,calc\\(100vw-2\\.5rem\\)\\)\\]", null, 4, [["width", "min(28rem, 100vw - 2.5rem)"]]], [".w-\\[min\\(30rem\\,92vw\\)\\]", null, 4, [["width", "min(30rem, 92vw)"]]], [".w-\\[min\\(32rem\\,100\\%\\)\\]", null, 4, [["width", "min(32rem, 100%)"]]], [".w-\\[min\\(340px\\,calc\\(100vw-16px\\)\\)\\]", null, 4, [["width", "min(340px, 100vw - 16px)"]]], [".w-\\[min\\(360px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(360px, 100vw - 2rem)"]]], [".w-\\[min\\(420px\\,calc\\(100vw_-_16px\\)\\)\\]", null, 4, [["width", "min(420px, 100vw - 16px)"]]], [".w-\\[min\\(480px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(480px, 100vw - 2rem)"]]], [".w-\\[min\\(560px\\,calc\\(100vw_-_2rem\\)\\)\\]", null, 4, [["width", "min(560px, 100vw - 2rem)"]]], [".w-\\[var\\(--sidebar-width\\,240px\\)\\]", null, 4, [["width", "var(--sidebar-width, 240px)"]]], [".w-\\[var\\(--tools-width\\)\\]", null, 4, [["width", "var(--tools-width)"]]], [".w-auto", null, 4, [["width", "auto"]]], [".w-full", null, 4, [["width", "100%"]]], [".w-px", null, 4, [["width", "1px"]]], [".max-w-24", null, 4, [["max-width", "calc(var(--spacing) * 24)"]]], [".max-w-32", null, 4, [["max-width", "calc(var(--spacing) * 32)"]]], [".max-w-\\[9rem\\]", null, 4, [["max-width", "9rem"]]], [".max-w-\\[10rem\\]", null, 4, [["max-width", "10rem"]]], [".max-w-\\[14rem\\]", null, 4, [["max-width", "14rem"]]], [".max-w-\\[16rem\\]", null, 4, [["max-width", "16rem"]]], [".max-w-\\[24rem\\]", null, 4, [["max-width", "24rem"]]], [".max-w-\\[25\\%\\]", null, 4, [["max-width", "25%"]]], [".max-w-\\[26rem\\]", null, 4, [["max-width", "26rem"]]], [".max-w-\\[28rem\\]", null, 4, [["max-width", "28rem"]]], [".max-w-\\[35\\%\\]", null, 4, [["max-width", "35%"]]], [".max-w-\\[38\\%\\]", null, 4, [["max-width", "38%"]]], [".max-w-\\[45\\%\\]", null, 4, [["max-width", "45%"]]], [".max-w-\\[46rem\\]", null, 4, [["max-width", "46rem"]]], [".max-w-\\[55\\%\\]", null, 4, [["max-width", "55%"]]], [".max-w-\\[56rem\\]", null, 4, [["max-width", "56rem"]]], [".max-w-\\[85\\%\\]", null, 4, [["max-width", "85%"]]], [".max-w-\\[140px\\]", null, 4, [["max-width", "140px"]]], [".max-w-\\[320px\\]", null, 4, [["max-width", "320px"]]], [".max-w-\\[min\\(22rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(22rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(30rem\\,calc\\(100\\%-1\\.6rem\\)\\)\\]", null, 4, [["max-width", "min(30rem, 100% - 1.6rem)"]]], [".max-w-\\[min\\(34rem\\,calc\\(100\\%-1\\.5rem\\)\\)\\]", null, 4, [["max-width", "min(34rem, 100% - 1.5rem)"]]], [".max-w-\\[min\\(320px\\,calc\\(100vw_-_24px\\)\\)\\]", null, 4, [["max-width", "min(320px, 100vw - 24px)"]]], [".max-w-full", null, 4, [["max-width", "100%"]]], [".max-w-none", null, 4, [["max-width", "none"]]], [".min-w-0", null, 4, [["min-width", "0"]]], [".min-w-6", null, 4, [["min-width", "calc(var(--spacing) * 6)"]]], [".min-w-8", null, 4, [["min-width", "calc(var(--spacing) * 8)"]]], [".min-w-12", null, 4, [["min-width", "calc(var(--spacing) * 12)"]]], [".min-w-24", null, 4, [["min-width", "calc(var(--spacing) * 24)"]]], [".min-w-36", null, 4, [["min-width", "calc(var(--spacing) * 36)"]]], [".min-w-56", null, 4, [["min-width", "calc(var(--spacing) * 56)"]]], [".min-w-\\[5\\.5rem\\]", null, 4, [["min-width", "5.5rem"]]], [".min-w-\\[7rem\\]", null, 4, [["min-width", "7rem"]]], [".min-w-\\[12rem\\]", null, 4, [["min-width", "12rem"]]], [".min-w-\\[14px\\]", null, 4, [["min-width", "14px"]]], [".min-w-\\[200px\\]", null, 4, [["min-width", "200px"]]], [".min-w-fit", null, 4, [["min-width", "fit-content"]]], [".min-w-max", null, 4, [["min-width", "max-content"]]], [".flex-1", null, 4, [["flex", "1"]]], [".flex-\\[0_0_5rem\\]", null, 4, [["flex", "0 0 5rem"]]], [".flex-\\[0_0_8px\\]", null, 4, [["flex", "0 0 8px"]]], [".flex-\\[0_1_40\\%\\]", null, 4, [["flex", "0 40%"]]], [".flex-\\[1_1_100\\%\\]", null, 4, [["flex", "100%"]]], [".flex-\\[2\\]", null, 4, [["flex", "2"]]], [".flex-none", null, 4, [["flex", "none"]]], [".shrink", null, 4, [["flex-shrink", "1"]]], [".shrink-0", null, 4, [["flex-shrink", "0"]]], [".shrink-\\[0\\.001\\]", null, 4, [["flex-shrink", ".001"]]], [".shrink-\\[2\\]", null, 4, [["flex-shrink", "2"]]], [".shrink-\\[3\\]", null, 4, [["flex-shrink", "3"]]], [".grow", null, 4, [["flex-grow", "1"]]], [".basis-0", null, 4, [["flex-basis", "0"]]], [".basis-\\[14rem\\]", null, 4, [["flex-basis", "14rem"]]], [".-translate-y-1\\/2", null, 4, [["--tw-translate-y", "calc(calc(1 / 2 * 100%) * -1)"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".\\[transform\\:translateY\\(-50\\%\\)\\]", null, 4, [["transform", "translateY(-50%)"]]], [".transform", null, 4, [["transform", "var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, )"]]], [".animate-drop-zone", null, 4, [["animation", "var(--animate-drop-zone)"]]], [".animate-host-pulse", null, 4, [["animation", "var(--animate-host-pulse)"]]], [".animate-pulse", null, 4, [["animation", "var(--animate-pulse)"]]], [".animate-toast-in", null, 4, [["animation", "var(--animate-toast-in)"]]], [".cursor-col-resize", null, 4, [["cursor", "col-resize"]]], [".cursor-default", null, 4, [["cursor", "default"]]], [".cursor-grab", null, 4, [["cursor", "grab"]]], [".cursor-grabbing", null, 4, [["cursor", "grabbing"]]], [".cursor-pointer", null, 4, [["cursor", "pointer"]]], [".cursor-row-resize", null, 4, [["cursor", "row-resize"]]], [".touch-none", null, 4, [["touch-action", "none"]]], [".resize", null, 4, [["resize", "both"]]], [".resize-none", null, 4, [["resize", "none"]]], [".resize-y", null, 4, [["resize", "vertical"]]], [".\\[scrollbar-width\\:none\\]", null, 4, [["scrollbar-width", "none"]]], [".list-disc", null, 4, [["list-style-type", "disc"]]], [".list-none", null, 4, [["list-style-type", "none"]]], [".appearance-none", null, 4, [["appearance", "none"]]], [".grid-cols-8", null, 4, [["grid-template-columns", "repeat(8, minmax(0, 1fr))"]]], [".grid-cols-\\[1fr_auto_1fr\\]", null, 4, [["grid-template-columns", "1fr auto 1fr"]]], [".grid-cols-\\[2\\.5rem_2\\.5rem_0\\.9rem_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "2.5rem 2.5rem .9rem minmax(0, 1fr)"]]], [".grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]", null, 4, [["grid-template-columns", "auto minmax(0, 1fr)"]]], [".grid-cols-\\[minmax\\(4rem\\,10rem\\)_1fr_auto\\]", null, 4, [["grid-template-columns", "minmax(4rem, 10rem) 1fr auto"]]], [".grid-cols-\\[repeat\\(2\\,minmax\\(0\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(2, minmax(0, 1fr))"]]], [".grid-cols-\\[repeat\\(auto-fit\\,minmax\\(8rem\\,1fr\\)\\)\\]", null, 4, [["grid-template-columns", "repeat(auto-fit, minmax(8rem, 1fr))"]]], [".flex-col", null, 4, [["flex-direction", "column"]]], [".flex-row", null, 4, [["flex-direction", "row"]]], [".flex-wrap", null, 4, [["flex-wrap", "wrap"]]], [".place-items-center", null, 4, [["place-items", "center"]]], [".content-center", null, 4, [["align-content", "center"]]], [".items-baseline", null, 4, [["align-items", "baseline"]]], [".items-center", null, 4, [["align-items", "center"]]], [".items-end", null, 4, [["align-items", "flex-end"]]], [".items-start", null, 4, [["align-items", "flex-start"]]], [".items-stretch", null, 4, [["align-items", "stretch"]]], [".justify-between", null, 4, [["justify-content", "space-between"]]], [".justify-center", null, 4, [["justify-content", "center"]]], [".justify-end", null, 4, [["justify-content", "flex-end"]]], [".justify-start", null, 4, [["justify-content", "flex-start"]]], [".justify-items-center", null, 4, [["justify-items", "center"]]], [".justify-items-start", null, 4, [["justify-items", "start"]]], [".gap-0", null, 4, [["gap", "0"]]], [".gap-0\\.5", null, 4, [["gap", "calc(var(--spacing) * .5)"]]], [".gap-1", null, 4, [["gap", "var(--spacing)"]]], [".gap-1\\.5", null, 4, [["gap", "calc(var(--spacing) * 1.5)"]]], [".gap-2", null, 4, [["gap", "calc(var(--spacing) * 2)"]]], [".gap-3", null, 4, [["gap", "calc(var(--spacing) * 3)"]]], [".gap-4", null, 4, [["gap", "calc(var(--spacing) * 4)"]]], [".gap-6", null, 4, [["gap", "calc(var(--spacing) * 6)"]]], [".gap-\\[0\\.1rem\\]", null, 4, [["gap", ".1rem"]]], [".gap-\\[0\\.3rem\\]", null, 4, [["gap", ".3rem"]]], [".gap-\\[0\\.4rem\\]", null, 4, [["gap", ".4rem"]]], [".gap-\\[0\\.05rem\\]", null, 4, [["gap", ".05rem"]]], [".gap-\\[0\\.6rem\\]", null, 4, [["gap", ".6rem"]]], [".gap-\\[0\\.8rem\\]", null, 4, [["gap", ".8rem"]]], [".gap-\\[0\\.16rem\\]", null, 4, [["gap", ".16rem"]]], [".gap-\\[0\\.32rem\\]", null, 4, [["gap", ".32rem"]]], [".gap-\\[0\\.35rem\\]", null, 4, [["gap", ".35rem"]]], [".gap-\\[0\\.45rem\\]", null, 4, [["gap", ".45rem"]]], [".gap-\\[0\\.55rem\\]", null, 4, [["gap", ".55rem"]]], [".gap-\\[0\\.65rem\\]", null, 4, [["gap", ".65rem"]]], [".gap-\\[0\\.85rem\\]", null, 4, [["gap", ".85rem"]]], [".gap-\\[1px\\]", null, 4, [["gap", "1px"]]], [".gap-\\[2px\\]", null, 4, [["gap", "2px"]]], [".gap-\\[3px\\]", null, 4, [["gap", "3px"]]], [".gap-\\[7px\\]", null, 4, [["gap", "7px"]]], [".gap-\\[13px\\]", null, 4, [["gap", "13px"]]], [":where(.space-y-0\\.5 > :not(:last-child))", null, 4, [["--tw-space-y-reverse", "0"], ["margin-block-start", "calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse))"], ["margin-block-end", "calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))"]]], [".gap-x-3", null, 4, [["column-gap", "calc(var(--spacing) * 3)"]]], [".gap-x-4", null, 4, [["column-gap", "calc(var(--spacing) * 4)"]]], [".gap-x-\\[0\\.7rem\\]", null, 4, [["column-gap", ".7rem"]]], [".gap-x-\\[0\\.9rem\\]", null, 4, [["column-gap", ".9rem"]]], [".gap-y-1", null, 4, [["row-gap", "var(--spacing)"]]], [".gap-y-\\[0\\.3rem\\]", null, 4, [["row-gap", ".3rem"]]], [".self-center", null, 4, [["align-self", "center"]]], [".self-end", null, 4, [["align-self", "flex-end"]]], [".self-start", null, 4, [["align-self", "flex-start"]]], [".self-stretch", null, 4, [["align-self", "stretch"]]], [".justify-self-start", null, 4, [["justify-self", "flex-start"]]], [".truncate", null, 4, [["text-overflow", "ellipsis"], ["white-space", "nowrap"], ["overflow", "hidden"]]], [".overflow-auto", null, 4, [["overflow", "auto"]]], [".overflow-hidden", null, 4, [["overflow", "hidden"]]], [".overflow-visible", null, 4, [["overflow", "visible"]]], [".overflow-x-auto", null, 4, [["overflow-x", "auto"]]], [".overflow-y-auto", null, 4, [["overflow-y", "auto"]]], [".overscroll-contain", null, 4, [["overscroll-behavior", "contain"]]], [".rounded, .rounded-\\[0\\.25rem\\]", null, 4, [["border-radius", ".25rem"]]], [".rounded-\\[1\\.5rem\\]", null, 4, [["border-radius", "1.5rem"]]], [".rounded-\\[2px\\]", null, 4, [["border-radius", "2px"]]], [".rounded-\\[3px\\]", null, 4, [["border-radius", "3px"]]], [".rounded-\\[12px\\]", null, 4, [["border-radius", "12px"]]], [".rounded-\\[50\\%\\]", null, 4, [["border-radius", "50%"]]], [".rounded-\\[999px\\]", null, 4, [["border-radius", "999px"]]], [".rounded-\\[calc\\(var\\(--radius\\)\\*2\\)\\]", null, 4, [["border-radius", "calc(var(--radius) * 2)"]]], [".rounded-\\[var\\(--card-radius\\,8px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 8px)"]]], [".rounded-\\[var\\(--card-radius\\,12px\\)\\]", null, 4, [["border-radius", "var(--card-radius, 12px)"]]], [".rounded-full", null, 4, [["border-radius", "3.40282e38px"]]], [".rounded-none", null, 4, [["border-radius", "0"]]], [".rounded-soft", null, 4, [["border-radius", "var(--radius-pane)"]]], [".rounded-ui", null, 4, [["border-radius", "var(--radius)"]]], [".rounded-t-\\[12px\\]", null, 4, [["border-top-left-radius", "12px"], ["border-top-right-radius", "12px"]]], [".rounded-t-none", null, 4, [["border-top-left-radius", "0"], ["border-top-right-radius", "0"]]], [".border", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1px"]]], [".border-0", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "0"]]], [".border-\\[1\\.5px\\]", null, 4, [["border-style", "var(--tw-border-style)"], ["border-width", "1.5px"]]], [".border-b", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "1px"]]], [".border-l", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "1px"]]], [".border-l-\\[3px\\]", null, 4, [["border-left-style", "var(--tw-border-style)"], ["border-left-width", "3px"]]], [".border-solid", null, 4, [["--tw-border-style", "solid"], ["border-style", "solid"]]], [".border-accent", null, 4, [["border-color", "var(--accent)"]]], [".border-overlay-0", null, 4, [["border-color", "var(--overlay-0)"]]], [".border-overlay-1", null, 4, [["border-color", "var(--overlay-1)"]]], [".border-red", null, 4, [["border-color", "var(--red)"]]], [".border-subtext-0", null, 4, [["border-color", "var(--subtext-0)"]]], [".border-surface-1", null, 4, [["border-color", "var(--surface-1)"]]], [".border-teal", null, 4, [["border-color", "var(--teal)"]]], [".border-yellow", null, 4, [["border-color", "var(--yellow)"]]], [".border-l-accent", null, 4, [["border-left-color", "var(--accent)"]]], [".border-l-green", null, 4, [["border-left-color", "var(--green)"]]], [".border-l-red", null, 4, [["border-left-color", "var(--red)"]]], [".border-l-yellow", null, 4, [["border-left-color", "var(--yellow)"]]], [".bg-\\[\\#161616\\]", null, 4, [["background-color", "#161616"]]], [".bg-\\[\\#fff\\]", null, 4, [["background-color", "#fff"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_8\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 8%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--blue)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--blue\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--blue) 15%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--green)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--green\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--green) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_7\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 7%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--red)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--red\\)_9\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--red) 9%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_42\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 42%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--surface-1\\)_70\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--surface-1) 70%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--text)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_8\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 8%,transparent)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "var(--yellow)"]]], [".bg-\\[color-mix\\(in_srgb\\,var\\(--yellow\\)_15\\%\\,transparent\\)\\]", null, 4, [["background-color", "color-mix(in srgb,var(--yellow) 15%,transparent)"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["background-color", "#00000080"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.7\\)\\]", null, 4, [["background-color", "#000000b3"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["background-color", "#0000008c"]]], [".bg-\\[rgba\\(0\\,0\\,0\\,0\\.62\\)\\]", null, 4, [["background-color", "#0000009e"]]], [".bg-\\[var\\(--accent\\)\\]", null, 4, [["background-color", "var(--accent)"]]], [".bg-\\[var\\(--backdrop\\)\\]", null, 4, [["background-color", "var(--backdrop)"]]], [".bg-\\[var\\(--bg\\)\\]", null, 4, [["background-color", "var(--bg)"]]], [".bg-\\[var\\(--card-bg\\)\\]", null, 4, [["background-color", "var(--card-bg)"]]], [".bg-\\[var\\(--picker-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--picker-bg, var(--panel-bg))"]]], [".bg-\\[var\\(--surface-1\\)\\]", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-\\[var\\(--workspace-tools-bg\\,var\\(--panel-bg\\)\\)\\]", null, 4, [["background-color", "var(--workspace-tools-bg, var(--panel-bg))"]]], [".bg-accent, .bg-accent\\/10", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/10", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 10%, transparent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "var(--accent)"]]], [".bg-accent\\/35", null, 4, [["background-color", "color-mix(in oklab, var(--accent) 35%, transparent)"]]], [".bg-fg", null, 4, [["background-color", "var(--text)"]]], [".bg-green, .bg-green\\/15", null, 4, [["background-color", "var(--green)"]]], [".bg-green\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--green) 15%, transparent)"]]], [".bg-overlay-0", null, 4, [["background-color", "var(--overlay-0)"]]], [".bg-overlay-1", null, 4, [["background-color", "var(--overlay-1)"]]], [".bg-panel-bg", null, 4, [["background-color", "var(--panel-bg)"]]], [".bg-red, .bg-red\\/15", null, 4, [["background-color", "var(--red)"]]], [".bg-red\\/15", null, 4, [["background-color", "color-mix(in oklab, var(--red) 15%, transparent)"]]], [".bg-subtext-0", null, 4, [["background-color", "var(--subtext-0)"]]], [".bg-surface-0", null, 4, [["background-color", "var(--surface-0)"]]], [".bg-surface-1, .bg-surface-1\\/30", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/30", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 30%, transparent)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/60", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 60%, transparent)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "var(--surface-1)"]]], [".bg-surface-1\\/70", null, 4, [["background-color", "color-mix(in oklab, var(--surface-1) 70%, transparent)"]]], [".bg-transparent", null, 4, [["background-color", "#0000"]]], [".bg-yellow", null, 4, [["background-color", "var(--yellow)"]]], [".object-contain", null, 4, [["object-fit", "contain"]]], [".object-cover", null, 4, [["object-fit", "cover"]]], [".p-0", null, 4, [["padding", "0"]]], [".p-0\\.5", null, 4, [["padding", "calc(var(--spacing) * .5)"]]], [".p-1", null, 4, [["padding", "var(--spacing)"]]], [".p-2", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".p-3", null, 4, [["padding", "calc(var(--spacing) * 3)"]]], [".p-4", null, 4, [["padding", "calc(var(--spacing) * 4)"]]], [".p-5", null, 4, [["padding", "calc(var(--spacing) * 5)"]]], [".p-6", null, 4, [["padding", "calc(var(--spacing) * 6)"]]], [".p-\\[0\\.2rem\\]", null, 4, [["padding", ".2rem"]]], [".p-\\[0\\.4rem\\]", null, 4, [["padding", ".4rem"]]], [".p-\\[0\\.5rem\\]", null, 4, [["padding", ".5rem"]]], [".p-\\[0\\.9rem\\]", null, 4, [["padding", ".9rem"]]], [".p-\\[0\\.45rem\\]", null, 4, [["padding", ".45rem"]]], [".p-\\[0\\.55rem\\]", null, 4, [["padding", ".55rem"]]], [".p-\\[0\\.65rem\\]", null, 4, [["padding", ".65rem"]]], [".p-\\[2px\\]", null, 4, [["padding", "2px"]]], [".px-0", null, 4, [["padding-inline", "0"]]], [".px-1", null, 4, [["padding-inline", "var(--spacing)"]]], [".px-1\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 1.5)"]]], [".px-2", null, 4, [["padding-inline", "calc(var(--spacing) * 2)"]]], [".px-3", null, 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".px-3\\.5", null, 4, [["padding-inline", "calc(var(--spacing) * 3.5)"]]], [".px-4", null, 4, [["padding-inline", "calc(var(--spacing) * 4)"]]], [".px-8", null, 4, [["padding-inline", "calc(var(--spacing) * 8)"]]], [".px-\\[0\\.2rem\\]", null, 4, [["padding-inline", ".2rem"]]], [".px-\\[0\\.3rem\\]", null, 4, [["padding-inline", ".3rem"]]], [".px-\\[0\\.4rem\\]", null, 4, [["padding-inline", ".4rem"]]], [".px-\\[0\\.5rem\\]", null, 4, [["padding-inline", ".5rem"]]], [".px-\\[0\\.6rem\\]", null, 4, [["padding-inline", ".6rem"]]], [".px-\\[0\\.7rem\\]", null, 4, [["padding-inline", ".7rem"]]], [".px-\\[0\\.8rem\\]", null, 4, [["padding-inline", ".8rem"]]], [".px-\\[0\\.9rem\\]", null, 4, [["padding-inline", ".9rem"]]], [".px-\\[0\\.26rem\\]", null, 4, [["padding-inline", ".26rem"]]], [".px-\\[0\\.28rem\\]", null, 4, [["padding-inline", ".28rem"]]], [".px-\\[0\\.35rem\\]", null, 4, [["padding-inline", ".35rem"]]], [".px-\\[0\\.42rem\\]", null, 4, [["padding-inline", ".42rem"]]], [".px-\\[0\\.45rem\\]", null, 4, [["padding-inline", ".45rem"]]], [".px-\\[0\\.48rem\\]", null, 4, [["padding-inline", ".48rem"]]], [".px-\\[0\\.55rem\\]", null, 4, [["padding-inline", ".55rem"]]], [".px-\\[0\\.65rem\\]", null, 4, [["padding-inline", ".65rem"]]], [".px-\\[0\\.75rem\\]", null, 4, [["padding-inline", ".75rem"]]], [".px-\\[0\\.85rem\\]", null, 4, [["padding-inline", ".85rem"]]], [".px-\\[1\\.4rem\\]", null, 4, [["padding-inline", "1.4rem"]]], [".px-\\[3px\\]", null, 4, [["padding-inline", "3px"]]], [".px-\\[10px\\]", null, 4, [["padding-inline", "10px"]]], [".py-0", null, 4, [["padding-block", "0"]]], [".py-0\\.5", null, 4, [["padding-block", "calc(var(--spacing) * .5)"]]], [".py-1", null, 4, [["padding-block", "var(--spacing)"]]], [".py-1\\.5", null, 4, [["padding-block", "calc(var(--spacing) * 1.5)"]]], [".py-2", null, 4, [["padding-block", "calc(var(--spacing) * 2)"]]], [".py-3", null, 4, [["padding-block", "calc(var(--spacing) * 3)"]]], [".py-4", null, 4, [["padding-block", "calc(var(--spacing) * 4)"]]], [".py-8", null, 4, [["padding-block", "calc(var(--spacing) * 8)"]]], [".py-\\[0\\.1rem\\]", null, 4, [["padding-block", ".1rem"]]], [".py-\\[0\\.2rem\\]", null, 4, [["padding-block", ".2rem"]]], [".py-\\[0\\.3rem\\]", null, 4, [["padding-block", ".3rem"]]], [".py-\\[0\\.4rem\\]", null, 4, [["padding-block", ".4rem"]]], [".py-\\[0\\.05rem\\]", null, 4, [["padding-block", ".05rem"]]], [".py-\\[0\\.6rem\\]", null, 4, [["padding-block", ".6rem"]]], [".py-\\[0\\.8rem\\]", null, 4, [["padding-block", ".8rem"]]], [".py-\\[0\\.12rem\\]", null, 4, [["padding-block", ".12rem"]]], [".py-\\[0\\.14rem\\]", null, 4, [["padding-block", ".14rem"]]], [".py-\\[0\\.15rem\\]", null, 4, [["padding-block", ".15rem"]]], [".py-\\[0\\.18rem\\]", null, 4, [["padding-block", ".18rem"]]], [".py-\\[0\\.25rem\\]", null, 4, [["padding-block", ".25rem"]]], [".py-\\[0\\.28rem\\]", null, 4, [["padding-block", ".28rem"]]], [".py-\\[0\\.32rem\\]", null, 4, [["padding-block", ".32rem"]]], [".py-\\[0\\.35rem\\]", null, 4, [["padding-block", ".35rem"]]], [".py-\\[0\\.42rem\\]", null, 4, [["padding-block", ".42rem"]]], [".py-\\[0\\.45rem\\]", null, 4, [["padding-block", ".45rem"]]], [".py-\\[0\\.55rem\\]", null, 4, [["padding-block", ".55rem"]]], [".py-\\[0\\.65rem\\]", null, 4, [["padding-block", ".65rem"]]], [".py-\\[1\\.1rem\\]", null, 4, [["padding-block", "1.1rem"]]], [".py-\\[2px\\]", null, 4, [["padding-block", "2px"]]], [".py-\\[3px\\]", null, 4, [["padding-block", "3px"]]], [".py-\\[6px\\]", null, 4, [["padding-block", "6px"]]], [".py-px", null, 4, [["padding-block", "1px"]]], [".pt-1", null, 4, [["padding-top", "var(--spacing)"]]], [".pt-2", null, 4, [["padding-top", "calc(var(--spacing) * 2)"]]], [".pt-2\\.5", null, 4, [["padding-top", "calc(var(--spacing) * 2.5)"]]], [".pt-3", null, 4, [["padding-top", "calc(var(--spacing) * 3)"]]], [".pt-4", null, 4, [["padding-top", "calc(var(--spacing) * 4)"]]], [".pt-5", null, 4, [["padding-top", "calc(var(--spacing) * 5)"]]], [".pt-\\[0\\.2rem\\]", null, 4, [["padding-top", ".2rem"]]], [".pt-\\[0\\.4rem\\]", null, 4, [["padding-top", ".4rem"]]], [".pt-\\[0\\.6rem\\]", null, 4, [["padding-top", ".6rem"]]], [".pt-\\[0\\.85rem\\]", null, 4, [["padding-top", ".85rem"]]], [".pt-\\[2px\\]", null, 4, [["padding-top", "2px"]]], [".pt-\\[12vh\\]", null, 4, [["padding-top", "12vh"]]], [".pt-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-top\\)\\)\\]", null, 4, [["padding-top", "max(.5rem, env(safe-area-inset-top))"]]], [".pr-0\\.5", null, 4, [["padding-right", "calc(var(--spacing) * .5)"]]], [".pr-1", null, 4, [["padding-right", "var(--spacing)"]]], [".pr-1\\.5", null, 4, [["padding-right", "calc(var(--spacing) * 1.5)"]]], [".pr-2", null, 4, [["padding-right", "calc(var(--spacing) * 2)"]]], [".pr-3", null, 4, [["padding-right", "calc(var(--spacing) * 3)"]]], [".pr-12", null, 4, [["padding-right", "calc(var(--spacing) * 12)"]]], [".pr-\\[0\\.3rem\\]", null, 4, [["padding-right", ".3rem"]]], [".pr-\\[0\\.6rem\\]", null, 4, [["padding-right", ".6rem"]]], [".pr-\\[0\\.35rem\\]", null, 4, [["padding-right", ".35rem"]]], [".pr-\\[0\\.45rem\\]", null, 4, [["padding-right", ".45rem"]]], [".pr-\\[0\\.55rem\\]", null, 4, [["padding-right", ".55rem"]]], [".pr-\\[1\\.6rem\\]", null, 4, [["padding-right", "1.6rem"]]], [".pr-\\[3px\\]", null, 4, [["padding-right", "3px"]]], [".pr-\\[env\\(safe-area-inset-right\\)\\]", null, 4, [["padding-right", "env(safe-area-inset-right)"]]], [".pr-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-right\\)\\)\\]", null, 4, [["padding-right", "max(.5rem, env(safe-area-inset-right))"]]], [".pb-1", null, 4, [["padding-bottom", "var(--spacing)"]]], [".pb-2", null, 4, [["padding-bottom", "calc(var(--spacing) * 2)"]]], [".pb-3", null, 4, [["padding-bottom", "calc(var(--spacing) * 3)"]]], [".pb-4", null, 4, [["padding-bottom", "calc(var(--spacing) * 4)"]]], [".pb-8", null, 4, [["padding-bottom", "calc(var(--spacing) * 8)"]]], [".pb-\\[0\\.3rem\\]", null, 4, [["padding-bottom", ".3rem"]]], [".pb-\\[0\\.4rem\\]", null, 4, [["padding-bottom", ".4rem"]]], [".pb-\\[0\\.25rem\\]", null, 4, [["padding-bottom", ".25rem"]]], [".pb-\\[0\\.55rem\\]", null, 4, [["padding-bottom", ".55rem"]]], [".pb-\\[1\\.4rem\\]", null, 4, [["padding-bottom", "1.4rem"]]], [".pb-\\[calc\\(1\\.5rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1.5rem + env(safe-area-inset-bottom))"]]], [".pb-\\[calc\\(1rem\\+env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "calc(1rem + env(safe-area-inset-bottom))"]]], [".pb-\\[env\\(safe-area-inset-bottom\\)\\]", null, 4, [["padding-bottom", "env(safe-area-inset-bottom)"]]], [".pb-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-bottom\\)\\)\\]", null, 4, [["padding-bottom", "max(.5rem, env(safe-area-inset-bottom))"]]], [".pl-1", null, 4, [["padding-left", "var(--spacing)"]]], [".pl-2", null, 4, [["padding-left", "calc(var(--spacing) * 2)"]]], [".pl-3", null, 4, [["padding-left", "calc(var(--spacing) * 3)"]]], [".pl-4", null, 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".pl-5", null, 4, [["padding-left", "calc(var(--spacing) * 5)"]]], [".pl-6", null, 4, [["padding-left", "calc(var(--spacing) * 6)"]]], [".pl-\\[0\\.4rem\\]", null, 4, [["padding-left", ".4rem"]]], [".pl-\\[0\\.45rem\\]", null, 4, [["padding-left", ".45rem"]]], [".pl-\\[0\\.75rem\\]", null, 4, [["padding-left", ".75rem"]]], [".pl-\\[0\\.85rem\\]", null, 4, [["padding-left", ".85rem"]]], [".pl-\\[1\\.2rem\\]", null, 4, [["padding-left", "1.2rem"]]], [".pl-\\[1\\.9rem\\]", null, 4, [["padding-left", "1.9rem"]]], [".pl-\\[1\\.45rem\\]", null, 4, [["padding-left", "1.45rem"]]], [".pl-\\[1\\.55rem\\]", null, 4, [["padding-left", "1.55rem"]]], [".pl-\\[1\\.875rem\\]", null, 4, [["padding-left", "1.875rem"]]], [".pl-\\[85px\\]", null, 4, [["padding-left", "85px"]]], [".pl-\\[max\\(0\\.5rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.5rem, env(safe-area-inset-left))"]]], [".pl-\\[max\\(0\\.25rem\\,env\\(safe-area-inset-left\\)\\)\\]", null, 4, [["padding-left", "max(.25rem, env(safe-area-inset-left))"]]], [".text-center", null, 4, [["text-align", "center"]]], [".text-left", null, 4, [["text-align", "left"]]], [".text-right", null, 4, [["text-align", "right"]]], [".\\[font-family\\:inherit\\]", null, 4, [["font-family", "inherit"]]], [".\\[font-family\\:ui-monospace\\,SFMono-Regular\\,Menlo\\,monospace\\]", null, 4, [["font-family", "ui-monospace, SFMono-Regular, Menlo, monospace"]]], [".\\[font-family\\:var\\(--font-mono\\)\\]", null, 4, [["font-family", "var(--font-mono)"]]], [".text-sm", null, 4, [["font-size", "var(--text-sm)"], ["line-height", "var(--tw-leading, var(--text-sm--line-height))"]]], [".text-xs", null, 4, [["font-size", "var(--text-xs)"], ["line-height", "var(--tw-leading, var(--text-xs--line-height))"]]], [".\\[font-size\\:inherit\\]", null, 4, [["font-size", "inherit"]]], [".text-\\[0\\.6rem\\]", null, 4, [["font-size", ".6rem"]]], [".text-\\[0\\.7rem\\]", null, 4, [["font-size", ".7rem"]]], [".text-\\[0\\.8em\\]", null, 4, [["font-size", ".8em"]]], [".text-\\[0\\.8rem\\]", null, 4, [["font-size", ".8rem"]]], [".text-\\[0\\.9em\\]", null, 4, [["font-size", ".9em"]]], [".text-\\[0\\.9rem\\]", null, 4, [["font-size", ".9rem"]]], [".text-\\[0\\.54rem\\]", null, 4, [["font-size", ".54rem"]]], [".text-\\[0\\.58rem\\]", null, 4, [["font-size", ".58rem"]]], [".text-\\[0\\.62rem\\]", null, 4, [["font-size", ".62rem"]]], [".text-\\[0\\.63rem\\]", null, 4, [["font-size", ".63rem"]]], [".text-\\[0\\.64rem\\]", null, 4, [["font-size", ".64rem"]]], [".text-\\[0\\.65rem\\]", null, 4, [["font-size", ".65rem"]]], [".text-\\[0\\.66rem\\]", null, 4, [["font-size", ".66rem"]]], [".text-\\[0\\.66rem\\]\\!", null, 4, [["font-size", ".66rem", 1]]], [".text-\\[0\\.68rem\\]", null, 4, [["font-size", ".68rem"]]], [".text-\\[0\\.72rem\\]", null, 4, [["font-size", ".72rem"]]], [".text-\\[0\\.74rem\\]", null, 4, [["font-size", ".74rem"]]], [".text-\\[0\\.75rem\\]", null, 4, [["font-size", ".75rem"]]], [".text-\\[0\\.76rem\\]", null, 4, [["font-size", ".76rem"]]], [".text-\\[0\\.77rem\\]", null, 4, [["font-size", ".77rem"]]], [".text-\\[0\\.78rem\\]", null, 4, [["font-size", ".78rem"]]], [".text-\\[0\\.82rem\\]", null, 4, [["font-size", ".82rem"]]], [".text-\\[0\\.83rem\\]", null, 4, [["font-size", ".83rem"]]], [".text-\\[0\\.85rem\\]", null, 4, [["font-size", ".85rem"]]], [".text-\\[0\\.88rem\\]", null, 4, [["font-size", ".88rem"]]], [".text-\\[0\\.95rem\\]", null, 4, [["font-size", ".95rem"]]], [".text-\\[0\\.875rem\\]", null, 4, [["font-size", ".875rem"]]], [".text-\\[1\\.1rem\\]", null, 4, [["font-size", "1.1rem"]]], [".text-\\[1\\.3rem\\]", null, 4, [["font-size", "1.3rem"]]], [".text-\\[1\\.4em\\]", null, 4, [["font-size", "1.4em"]]], [".text-\\[1\\.6rem\\]", null, 4, [["font-size", "1.6rem"]]], [".text-\\[1\\.15rem\\]", null, 4, [["font-size", "1.15rem"]]], [".text-\\[1rem\\]", null, 4, [["font-size", "1rem"]]], [".text-\\[2\\.4rem\\]", null, 4, [["font-size", "2.4rem"]]], [".text-\\[9px\\]", null, 4, [["font-size", "9px"]]], [".text-\\[10px\\]", null, 4, [["font-size", "10px"]]], [".text-\\[11px\\]", null, 4, [["font-size", "11px"]]], [".text-\\[12\\.5px\\]", null, 4, [["font-size", "12.5px"]]], [".text-\\[12px\\]", null, 4, [["font-size", "12px"]]], [".text-\\[13px\\]", null, 4, [["font-size", "13px"]]], [".text-\\[14px\\]", null, 4, [["font-size", "14px"]]], [".text-\\[calc\\(0\\.95rem\\*var\\(--chat-font-scale\\,1\\)\\)\\]", null, 4, [["font-size", "calc(.95rem * var(--chat-font-scale, 1))"]]], [".text-\\[length\\:calc\\(11px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(11px * var(--zoom, 1))"]]], [".text-\\[length\\:calc\\(13px\\*var\\(--zoom\\,1\\)\\)\\]", null, 4, [["font-size", "calc(13px * var(--zoom, 1))"]]], [".leading-4", null, 4, [["--tw-leading", "calc(var(--spacing) * 4)"], ["line-height", "calc(var(--spacing) * 4)"]]], [".leading-\\[1\\.1\\]", null, 4, [["--tw-leading", "1.1"], ["line-height", "1.1"]]], [".leading-\\[1\\.2\\]", null, 4, [["--tw-leading", "1.2"], ["line-height", "1.2"]]], [".leading-\\[1\\.3\\]", null, 4, [["--tw-leading", "1.3"], ["line-height", "1.3"]]], [".leading-\\[1\\.4\\]", null, 4, [["--tw-leading", "1.4"], ["line-height", "1.4"]]], [".leading-\\[1\\.5\\]", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".leading-\\[1\\.6\\]", null, 4, [["--tw-leading", "1.6"], ["line-height", "1.6"]]], [".leading-\\[1\\.45\\]", null, 4, [["--tw-leading", "1.45"], ["line-height", "1.45"]]], [".leading-\\[18px\\]", null, 4, [["--tw-leading", "18px"], ["line-height", "18px"]]], [".leading-none", null, 4, [["--tw-leading", "1"], ["line-height", "1"]]], [".leading-relaxed", null, 4, [["--tw-leading", "var(--leading-relaxed)"], ["line-height", "var(--leading-relaxed)"]]], [".leading-tight", null, 4, [["--tw-leading", "var(--leading-tight)"], ["line-height", "var(--leading-tight)"]]], [".\\[line-height\\:inherit\\]", null, 4, [["line-height", "inherit"]]], [".font-bold", null, 4, [["--tw-font-weight", "var(--font-weight-bold)"], ["font-weight", "var(--font-weight-bold)"]]], [".font-medium", null, 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".font-normal", null, 4, [["--tw-font-weight", "var(--font-weight-normal)"], ["font-weight", "var(--font-weight-normal)"]]], [".font-semibold", null, 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".\\[font-weight\\:inherit\\]", null, 4, [["font-weight", "inherit"]]], [".tracking-\\[-0\\.02em\\]", null, 4, [["--tw-tracking", "-.02em"], ["letter-spacing", "-.02em"]]], [".tracking-\\[0\\.03em\\]", null, 4, [["--tw-tracking", ".03em"], ["letter-spacing", ".03em"]]], [".tracking-\\[0\\.04em\\]", null, 4, [["--tw-tracking", ".04em"], ["letter-spacing", ".04em"]]], [".tracking-\\[0\\.06em\\]", null, 4, [["--tw-tracking", ".06em"], ["letter-spacing", ".06em"]]], [".tracking-\\[0\\.08em\\]", null, 4, [["--tw-tracking", ".08em"], ["letter-spacing", ".08em"]]], [".tracking-\\[0\\.09em\\]", null, 4, [["--tw-tracking", ".09em"], ["letter-spacing", ".09em"]]], [".tracking-\\[0\\.22em\\]", null, 4, [["--tw-tracking", ".22em"], ["letter-spacing", ".22em"]]], [".tracking-normal", null, 4, [["--tw-tracking", "var(--tracking-normal)"], ["letter-spacing", "var(--tracking-normal)"]]], [".tracking-wide", null, 4, [["--tw-tracking", "var(--tracking-wide)"], ["letter-spacing", "var(--tracking-wide)"]]], [".\\[overflow-wrap\\:anywhere\\]", null, 4, [["overflow-wrap", "anywhere"]]], [".break-words", null, 4, [["overflow-wrap", "break-word"]]], [".\\[word-break\\:break-word\\]", null, 4, [["word-break", "break-word"]]], [".text-ellipsis", null, 4, [["text-overflow", "ellipsis"]]], [".whitespace-normal", null, 4, [["white-space", "normal"]]], [".whitespace-nowrap", null, 4, [["white-space", "nowrap"]]], [".whitespace-pre", null, 4, [["white-space", "pre"]]], [".whitespace-pre-wrap", null, 4, [["white-space", "pre-wrap"]]], [".\\[tab-size\\:2\\]", null, 4, [["tab-size", "2"]]], [".text-\\[color\\:var\\(--git-muted\\)\\]", null, 4, [["color", "var(--git-muted)"]]], [".text-\\[var\\(--subtext-0\\)\\]", null, 4, [["color", "var(--subtext-0)"]]], [".text-\\[var\\(--text\\)\\]", null, 4, [["color", "var(--text)"]]], [".text-accent", null, 4, [["color", "var(--accent)"]]], [".text-blue", null, 4, [["color", "var(--blue)"]]], [".text-current", null, 4, [["color", "currentColor"]]], [".text-fg", null, 4, [["color", "var(--text)"]]], [".text-green", null, 4, [["color", "var(--green)"]]], [".text-inherit", null, 4, [["color", "inherit"]]], [".text-mauve", null, 4, [["color", "var(--mauve)"]]], [".text-overlay-0", null, 4, [["color", "var(--overlay-0)"]]], [".text-overlay-1", null, 4, [["color", "var(--overlay-1)"]]], [".text-panel-bg", null, 4, [["color", "var(--panel-bg)"]]], [".text-peach", null, 4, [["color", "var(--peach)"]]], [".text-red", null, 4, [["color", "var(--red)"]]], [".text-red\\!", null, 4, [["color", "var(--red)", 1]]], [".text-subtext-0", null, 4, [["color", "var(--subtext-0)"]]], [".text-yellow", null, 4, [["color", "var(--yellow)"]]], [".capitalize", null, 4, [["text-transform", "capitalize"]]], [".normal-case", null, 4, [["text-transform", "none"]]], [".uppercase", null, 4, [["text-transform", "uppercase"]]], [".italic", null, 4, [["font-style", "italic"]]], [".not-italic", null, 4, [["font-style", "normal"]]], [".tabular-nums", null, 4, [["--tw-numeric-spacing", "tabular-nums"], ["font-variant-numeric", "var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, )"]]], [".line-through", null, 4, [["text-decoration-line", "line-through"]]], [".no-underline", null, 4, [["text-decoration-line", "none"]]], [".underline", null, 4, [["text-decoration-line", "underline"]]], [".opacity-0", null, 4, [["opacity", "0"]]], [".opacity-40", null, 4, [["opacity", ".4"]]], [".opacity-60", null, 4, [["opacity", ".6"]]], [".opacity-70", null, 4, [["opacity", ".7"]]], [".opacity-75", null, 4, [["opacity", ".75"]]], [".opacity-80", null, 4, [["opacity", ".8"]]], [".opacity-\\[0\\.72\\]", null, 4, [["opacity", ".72"]]], [".shadow", null, 4, [["--tw-shadow", "0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_1px_4px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 1px 4px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.4\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #0006)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_2px_8px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 2px 8px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_6px_20px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["--tw-shadow", "0 6px 20px var(--tw-shadow-color, #0000004d)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000059)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_24px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\]", null, 4, [["--tw-shadow", "0 8px 24px var(--tw-shadow-color, #00000073)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_8px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 8px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_12px_32px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\]", null, 4, [["--tw-shadow", "0 12px 32px var(--tw-shadow-color, #00000080)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[0_16px_48px_rgba\\(0\\,0\\,0\\,0\\.55\\)\\]", null, 4, [["--tw-shadow", "0 16px 48px var(--tw-shadow-color, #0000008c)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-\\[inset_0_0_24px_var\\(--accent\\)\\]", null, 4, [["--tw-shadow", "inset 0 0 24px var(--tw-shadow-color, var(--accent))"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".shadow-lg", null, 4, [["--tw-shadow", "0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".ring", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".\\[box-shadow\\:0_1px_2px_rgba\\(0\\,0\\,0\\,0\\.3\\)\\]", null, 4, [["box-shadow", "0 1px 2px #0000004d"]]], [".\\[box-shadow\\:0_4px_14px_rgba\\(0\\,0\\,0\\,0\\.35\\)\\]", null, 4, [["box-shadow", "0 4px 14px #00000059"]]], [".\\[box-shadow\\:none\\]", null, 4, [["box-shadow", "none"]]], [".\\[outline\\:none\\]", null, 4, [["outline", "none"]]], [".outline, .outline-1", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".outline-2", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".outline-accent", null, 4, [["outline-color", "var(--accent)"]]], [".blur", null, 4, [["--tw-blur", "blur(8px)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".\\!filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )", 1]]], [".\\[filter\\:drop-shadow\\(0_6px_10px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\)\\]", null, 4, [["filter", "drop-shadow(0 6px 10px #00000073)"]]], [".filter", null, 4, [["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".backdrop-blur-xl", null, 4, [["--tw-backdrop-blur", "blur(var(--blur-xl))"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".backdrop-saturate-150", null, 4, [["--tw-backdrop-saturate", "saturate(150%)"], ["-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"], ["backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"]]], [".transition", null, 4, [["transition-property", "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-\\[left\\,top\\,width\\,height\\]", null, 4, [["transition-property", "left, top, width, height"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".transition-opacity", null, 4, [["transition-property", "opacity"], ["transition-timing-function", "var(--tw-ease, var(--default-transition-timing-function))"], ["transition-duration", "var(--tw-duration, var(--default-transition-duration))"]]], [".duration-150", null, 4, [["--tw-duration", ".15s"], ["transition-duration", ".15s"]]], [".ease-out", null, 4, [["--tw-ease", "var(--ease-out)"], ["transition-timing-function", "var(--ease-out)"]]], [".outline-none", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".outline-solid", null, 4, [["--tw-outline-style", "solid"], ["outline-style", "solid"]]], [".select-none", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".select-text", null, 4, [["-webkit-user-select", "text"], ["user-select", "text"]]], [".\\[--panel-bg\\:var\\(--surface-dim\\)\\]", null, 4, [["--panel-bg", "var(--surface-dim)"]]], [".\\[--picker-bg\\:var\\(--surface-0\\)\\]", null, 4, [["--picker-bg", "var(--surface-0)"]]], [".\\[--radius\\:var\\(--radius-pane\\)\\]", null, 4, [["--radius", "var(--radius-pane)"]]], [".\\[--workspace-tools-bg\\:transparent\\]", null, 4, [["--workspace-tools-bg", "transparent"]]], [".\\[-webkit-box-orient\\:vertical\\]", null, 4, [["-webkit-box-orient", "vertical"]]], [".\\[-webkit-line-clamp\\:3\\]", null, 4, [["-webkit-line-clamp", "3"]]], [".\\[-webkit-touch-callout\\:none\\]", null, 4, [["-webkit-touch-callout", "none"]]], [".\\[background\\:none\\]", null, 4, [["background", "none"]]], [".\\[border-right\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-right", "1px solid var(--git-border)"]]], [".\\[border-top\\:1px_solid_var\\(--git-border\\)\\]", null, 4, [["border-top", "1px solid var(--git-border)"]]], [".\\[border\\:0\\]", null, 4, [["border", "0"]]], [".\\[border\\:none\\]", null, 4, [["border", "none"]]], [".\\[font\\:1\\.15rem\\/1_var\\(--font-mono\\)\\]", null, 4, [["font", "1.15rem/1 var(--font-mono)"]]], [".\\[font\\:1rem\\/1\\.2_var\\(--font-mono\\)\\]", null, 4, [["font", "1rem/1.2 var(--font-mono)"]]], [".\\[font\\:inherit\\]", null, 4, [["font", "inherit"]]], [".\\[transition\\:background_0\\.1s_ease\\]", null, 4, [["transition", "background .1s"]]], [".\\[transition\\:background_0\\.12s_ease\\]", null, 4, [["transition", "background .12s"]]], [".\\[transition\\:background_0\\.15s_ease\\]", null, 4, [["transition", "background .15s"]]], [".\\[transition\\:color_0\\.1s_ease\\,background_0\\.1s_ease\\]", null, 4, [["transition", "color .1s, background .1s"]]], [".\\[transition\\:color_0\\.12s_ease\\,background_0\\.12s_ease\\]", null, 4, [["transition", "color .12s, background .12s"]]], [".\\[transition\\:color_0\\.15s_ease\\]", null, 4, [["transition", "color .15s"]]], [".\\[transition\\:opacity_0\\.12s_ease\\]", null, 4, [["transition", "opacity .12s"]]], [".\\[transition\\:transform_0\\.15s_ease\\,background_0\\.15s_ease\\]", null, 4, [["transition", "transform .15s, background .15s"]]], [".not-has-\\[\\[data-setting-row\\]\\]\\:hidden:not(:has([data-setting-row]))", null, 4, [["display", "none"]]], [".group-focus-within\\:flex:is(:where(.group):focus-within *)", null, 4, [["display", "flex"]]], [".group-focus-within\\/row\\:opacity-100:is(:where(.group\\/row):focus-within *)", null, 4, [["opacity", "1"]]], [".group-hover\\:flex:is(:where(.group):hover *)", null, 4, [["display", "flex"]]], [".group-hover\\:opacity-100:is(:where(.group):hover *)", null, 4, [["opacity", "1"]]], [".group-hover\\/line\\:opacity-90:is(:where(.group\\/line):hover *)", null, 4, [["opacity", ".9"]]], [".group-hover\\/ph\\:opacity-100:is(:where(.group\\/ph):hover *), .group-hover\\/row\\:opacity-100:is(:where(.group\\/row):hover *)", null, 4, [["opacity", "1"]]], [".group-focus\\/tree\\:ring-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-shadow", "var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)"], ["box-shadow", "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"]]], [".group-focus\\/tree\\:ring-overlay-1:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-color", "var(--overlay-1)"]]], [".group-focus\\/tree\\:ring-inset:is(:where(.group\\/tree):focus *)", null, 4, [["--tw-ring-inset", "inset"]]], ['.group-aria-checked\\:\\[transform\\:translateX\\(1\\.1rem\\)\\]:is(:where(.group)[aria-checked="true"] *)', null, 4, [["transform", "translateX(1.1rem)"]]], ['.group-aria-checked\\:border-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["border-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-accent:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--accent)"]]], ['.group-aria-checked\\:bg-panel-bg:is(:where(.group)[aria-checked="true"] *)', null, 4, [["background-color", "var(--panel-bg)"]]], ['.group-aria-checked\\:text-accent:is(:where(.group)[aria-checked="true"] *), .group-aria-\\[checked\\=false\\]\\:text-accent:is(:where(.group)[aria-checked="false"] *)', null, 4, [["color", "var(--accent)"]]], [".placeholder\\:text-subtext-0::placeholder", null, 4, [["color", "var(--subtext-0)"]]], [".before\\:absolute:before", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".before\\:top-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["top", ".15rem"]]], [".before\\:left-\\[0\\.15rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["left", ".15rem"]]], [".before\\:h-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["height", ".95rem"]]], [".before\\:w-\\[0\\.95rem\\]:before", null, 4, [["content", "var(--tw-content)"], ["width", ".95rem"]]], [".before\\:rounded-full:before", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".before\\:bg-fg:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--text)"]]], [".before\\:content-\\[\\'\\'\\]:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".before\\:\\[transition\\:transform_0\\.12s_ease\\]:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .12s"]]], [".after\\:absolute:after", null, 4, [["content", "var(--tw-content)"], ["position", "absolute"]]], [".after\\:inset-0:after", null, 4, [["content", "var(--tw-content)"], ["inset", "0"]]], [".after\\:inset-x-0:after", null, 4, [["content", "var(--tw-content)"], ["inset-inline", "0"]]], [".after\\:-inset-y-2:after", null, 4, [["content", "var(--tw-content)"], ["inset-block", "calc(var(--spacing) * -2)"]]], [".after\\:m-auto:after", null, 4, [["content", "var(--tw-content)"], ["margin", "auto"]]], [".after\\:h-8:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 8)"]]], [".after\\:h-12:after", null, 4, [["content", "var(--tw-content)"], ["height", "calc(var(--spacing) * 12)"]]], [".after\\:h-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["height", "3px"]]], [".after\\:w-8:after", null, 4, [["content", "var(--tw-content)"], ["width", "calc(var(--spacing) * 8)"]]], [".after\\:w-\\[3px\\]:after", null, 4, [["content", "var(--tw-content)"], ["width", "3px"]]], [".after\\:rounded-full:after", null, 4, [["content", "var(--tw-content)"], ["border-radius", "3.40282e38px"]]], [".after\\:bg-transparent:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "#0000"]]], [".after\\:content-\\[\\'\\'\\]:after", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".last\\:border-b-0:last-child", null, 4, [["border-bottom-style", "var(--tw-border-style)"], ["border-bottom-width", "0"]]], [".checked\\:bg-accent:checked", null, 4, [["background-color", "var(--accent)"]]], [".checked\\:before\\:translate-x-\\[1rem\\]:checked:before", null, 4, [["content", "var(--tw-content)"], ["--tw-translate-x", "1rem"], ["translate", "var(--tw-translate-x) var(--tw-translate-y)"]]], [".checked\\:before\\:bg-panel-bg:checked:before", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--panel-bg)"]]], [".focus-within\\:bg-surface-1:focus-within", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-within\\:outline:focus-within, .focus-within\\:outline-1:focus-within", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-within\\:outline-fg:focus-within", null, 4, [["outline-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_12\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 12%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--accent\\)_15\\%\\,transparent\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--accent) 15%,transparent)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "var(--text)"]]], [".hover\\:bg-\\[color-mix\\(in_srgb\\,var\\(--text\\)_10\\%\\,var\\(--panel-bg\\)\\)\\]:hover", null, 4, [["background-color", "color-mix(in srgb,var(--text) 10%,var(--panel-bg))"]]], [".hover\\:bg-\\[var\\(--surface-0\\)\\]:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-accent:hover", null, 4, [["background-color", "var(--accent)"]]], [".hover\\:bg-overlay-0:hover", null, 4, [["background-color", "var(--overlay-0)"]]], [".hover\\:bg-panel-bg:hover", null, 4, [["background-color", "var(--panel-bg)"]]], [".hover\\:bg-surface-0:hover", null, 4, [["background-color", "var(--surface-0)"]]], [".hover\\:bg-surface-1:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".hover\\:bg-transparent:hover", null, 4, [["background-color", "#0000"]]], [".hover\\:text-accent:hover", null, 4, [["color", "var(--accent)"]]], [".hover\\:text-fg:hover", null, 4, [["color", "var(--text)"]]], [".hover\\:text-inherit:hover", null, 4, [["color", "inherit"]]], [".hover\\:text-overlay-0:hover", null, 4, [["color", "var(--overlay-0)"]]], [".hover\\:text-panel-bg:hover", null, 4, [["color", "var(--panel-bg)"]]], [".hover\\:text-red:hover", null, 4, [["color", "var(--red)"]]], [".hover\\:text-subtext-0:hover", null, 4, [["color", "var(--subtext-0)"]]], [".hover\\:text-yellow:hover", null, 4, [["color", "var(--yellow)"]]], [".hover\\:underline:hover", null, 4, [["text-decoration-line", "underline"]]], [".hover\\:opacity-60:hover", null, 4, [["opacity", ".6"]]], [".hover\\:opacity-100\\!:hover", null, 4, [["opacity", "1", 1]]], [".hover\\:opacity-\\[0\\.85\\]:hover", null, 4, [["opacity", ".85"]]], [".hover\\:brightness-110:hover", null, 4, [["--tw-brightness", "brightness(110%)"], ["filter", "var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, )"]]], [".hover\\:\\[filter\\:brightness\\(1\\.08\\)\\]:hover", null, 4, [["filter", "brightness(1.08)"]]], [".hover\\:after\\:bg-overlay-1:hover:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--overlay-1)"]]], [".focus\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus\\:outline-2:focus", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "2px"]]], [".focus\\:outline-none:focus", null, 4, [["--tw-outline-style", "none"], ["outline-style", "none"]]], [".focus-visible\\:bg-accent:focus-visible", null, 4, [["background-color", "var(--accent)"]]], [".focus-visible\\:bg-surface-0:focus-visible", null, 4, [["background-color", "var(--surface-0)"]]], [".focus-visible\\:bg-surface-1:focus-visible", null, 4, [["background-color", "var(--surface-1)"]]], [".focus-visible\\:text-accent:focus-visible", null, 4, [["color", "var(--accent)"]]], [".focus-visible\\:text-fg:focus-visible", null, 4, [["color", "var(--text)"]]], [".focus-visible\\:text-panel-bg:focus-visible", null, 4, [["color", "var(--panel-bg)"]]], [".focus-visible\\:text-red:focus-visible", null, 4, [["color", "var(--red)"]]], [".focus-visible\\:text-yellow:focus-visible", null, 4, [["color", "var(--yellow)"]]], [".focus-visible\\:underline:focus-visible", null, 4, [["text-decoration-line", "underline"]]], [".focus-visible\\:opacity-100:focus-visible", null, 4, [["opacity", "1"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--accent)"]]], [".focus-visible\\:\\[outline\\:1px_solid_var\\(--overlay-1\\)\\]:focus-visible", null, 4, [["outline", "1px solid var(--overlay-1)"]]], [".focus-visible\\:\\[outline\\:2px_solid_var\\(--accent\\)\\]:focus-visible", null, 4, [["outline", "2px solid var(--accent)"]]], [".focus-visible\\:outline:focus-visible, .focus-visible\\:outline-1:focus-visible", null, 4, [["outline-style", "var(--tw-outline-style)"], ["outline-width", "1px"]]], [".focus-visible\\:\\[outline-offset\\:-1px\\]:focus-visible", null, 4, [["outline-offset", "-1px"]]], [".focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible", null, 4, [["outline-offset", "-2px"]]], [".focus-visible\\:\\[outline-offset\\:2px\\]:focus-visible", null, 4, [["outline-offset", "2px"]]], [".focus-visible\\:outline-offset-1:focus-visible", null, 4, [["outline-offset", "1px"]]], [".focus-visible\\:outline-fg:focus-visible", null, 4, [["outline-color", "var(--text)"]]], [".focus-visible\\:after\\:bg-accent:focus-visible:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".active\\:cursor-grabbing:active", null, 4, [["cursor", "grabbing"]]], [".active\\:bg-surface-1:active", null, 4, [["background-color", "var(--surface-1)"]]], [".active\\:text-fg:active", null, 4, [["color", "var(--text)"]]], [".active\\:after\\:bg-accent:active:after", null, 4, [["content", "var(--tw-content)"], ["background-color", "var(--accent)"]]], [".enabled\\:hover\\:bg-surface-1:enabled:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".enabled\\:hover\\:text-fg:enabled:hover", null, 4, [["color", "var(--text)"]]], [".disabled\\:cursor-default:disabled", null, 4, [["cursor", "default"]]], [".disabled\\:cursor-not-allowed:disabled", null, 4, [["cursor", "not-allowed"]]], [".disabled\\:cursor-not-allowed\\!:disabled", null, 4, [["cursor", "not-allowed", 1]]], [".disabled\\:cursor-wait:disabled", null, 4, [["cursor", "wait"]]], [".disabled\\:bg-transparent:disabled", null, 4, [["background-color", "#0000"]]], [".disabled\\:text-fg:disabled", null, 4, [["color", "var(--text)"]]], [".disabled\\:opacity-40:disabled", null, 4, [["opacity", ".4"]]], [".disabled\\:opacity-50:disabled", null, 4, [["opacity", ".5"]]], [".disabled\\:opacity-\\[0\\.45\\]:disabled", null, 4, [["opacity", ".45"]]], [".disabled\\:opacity-\\[0\\.55\\]:disabled", null, 4, [["opacity", ".55"]]], [":where(.app--mac-desktop) .in-\\[\\.app--mac-desktop\\]\\:pl-\\[84px\\]", null, 4, [["padding-left", "84px"]]], [".has-\\[\\:checked\\]\\:bg-surface-0:has(:checked)", null, 4, [["background-color", "var(--surface-0)"]]], [".has-\\[\\:checked\\]\\:text-fg:has(:checked)", null, 4, [["color", "var(--text)"]]], [".has-\\[\\:focus-visible\\]\\:bg-surface-0:has(:focus-visible)", null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-disabled\\:cursor-not-allowed[aria-disabled="true"]', null, 4, [["cursor", "not-allowed"]]], ['.aria-disabled\\:opacity-40[aria-disabled="true"]', null, 4, [["opacity", ".4"]]], ['.aria-expanded\\:opacity-100[aria-expanded="true"]', null, 4, [["opacity", "1"]]], ['.aria-pressed\\:bg-surface-0[aria-pressed="true"]', null, 4, [["background-color", "var(--surface-0)"]]], ['.aria-pressed\\:text-fg[aria-pressed="true"]', null, 4, [["color", "var(--text)"]]], [".motion-reduce\\:animate-none", ["(prefers-reduced-motion: reduce)"], 4, [["animation", "none"]]], [".max-\\[900px\\]\\:hidden", ["not all and (min-width: 900px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:hidden", ["not all and (min-width: 700px)"], 4, [["display", "none"]]], [".max-\\[700px\\]\\:size-11", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 11)"], ["height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:h-9", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:h-12", ["not all and (min-width: 700px)"], 4, [["height", "calc(var(--spacing) * 12)"]]], [".max-\\[700px\\]\\:min-h-9", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 9)"]]], [".max-\\[700px\\]\\:min-h-11", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:w-24", ["not all and (min-width: 700px)"], 4, [["width", "calc(var(--spacing) * 24)"]]], [".max-\\[700px\\]\\:min-w-11", ["not all and (min-width: 700px)"], 4, [["min-width", "calc(var(--spacing) * 11)"]]], [".max-\\[700px\\]\\:flex-1", ["not all and (min-width: 700px)"], 4, [["flex", "1"]]], [".max-\\[700px\\]\\:flex-\\[1_1_6rem\\]", ["not all and (min-width: 700px)"], 4, [["flex", "6rem"]]], [".max-\\[700px\\]\\:flex-\\[1_1_100\\%\\]", ["not all and (min-width: 700px)"], 4, [["flex", "100%"]]], [".max-\\[700px\\]\\:basis-56", ["not all and (min-width: 700px)"], 4, [["flex-basis", "calc(var(--spacing) * 56)"]]], [".max-\\[700px\\]\\:basis-full", ["not all and (min-width: 700px)"], 4, [["flex-basis", "100%"]]], [".max-\\[700px\\]\\:flex-wrap", ["not all and (min-width: 700px)"], 4, [["flex-wrap", "wrap"]]], [".max-\\[700px\\]\\:gap-y-2", ["not all and (min-width: 700px)"], 4, [["row-gap", "calc(var(--spacing) * 2)"]]], [".min-\\[701px\\]\\:left-auto", ["(min-width: 701px)"], 4, [["left", "auto"]]], [".min-\\[701px\\]\\:my-\\[3px\\]", ["(min-width: 701px)"], 4, [["margin-block", "3px"]]], [".min-\\[701px\\]\\:block", ["(min-width: 701px)"], 4, [["display", "block"]]], [".min-\\[701px\\]\\:hidden", ["(min-width: 701px)"], 4, [["display", "none"]]], [".min-\\[701px\\]\\:min-h-6", ["(min-width: 701px)"], 4, [["min-height", "calc(var(--spacing) * 6)"]]], [".min-\\[701px\\]\\:w-80", ["(min-width: 701px)"], 4, [["width", "calc(var(--spacing) * 80)"]]], [".min-\\[701px\\]\\:rounded-ui", ["(min-width: 701px)"], 4, [["border-radius", "var(--radius)"]]], [".min-\\[701px\\]\\:px-3", ["(min-width: 701px)"], 4, [["padding-inline", "calc(var(--spacing) * 3)"]]], [".min-\\[701px\\]\\:pr-\\[3px\\]", ["(min-width: 701px)"], 4, [["padding-right", "3px"]]], [".min-\\[701px\\]\\:pl-4", ["(min-width: 701px)"], 4, [["padding-left", "calc(var(--spacing) * 4)"]]], [".min-\\[701px\\]\\:text-\\[0\\.62rem\\]", ["(min-width: 701px)"], 4, [["font-size", ".62rem"]]], [".min-\\[701px\\]\\:text-\\[12\\.5px\\]", ["(min-width: 701px)"], 4, [["font-size", "12.5px"]]], [".min-\\[701px\\]\\:text-\\[12px\\]", ["(min-width: 701px)"], 4, [["font-size", "12px"]]], [".min-\\[701px\\]\\:font-medium", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-medium)"], ["font-weight", "var(--font-weight-medium)"]]], [".min-\\[701px\\]\\:font-semibold", ["(min-width: 701px)"], 4, [["--tw-font-weight", "var(--font-weight-semibold)"], ["font-weight", "var(--font-weight-semibold)"]]], [".min-\\[701px\\]\\:tracking-\\[0\\.045em\\]", ["(min-width: 701px)"], 4, [["--tw-tracking", ".045em"], ["letter-spacing", ".045em"]]], [".min-\\[701px\\]\\:text-subtext-0", ["(min-width: 701px)"], 4, [["color", "var(--subtext-0)"]]], [".min-\\[701px\\]\\:uppercase", ["(min-width: 701px)"], 4, [["text-transform", "uppercase"]]], [".min-\\[900px\\]\\:inline", ["(min-width: 900px)"], 4, [["display", "inline"]]], [".pointer-coarse\\:opacity-100", ["(pointer: coarse)"], 4, [["opacity", "1"]]], [".\\[\\&_\\.mode-switch\\]\\:ml-0 .mode-switch", null, 4, [["margin-left", "0"]]], [".max-\\[700px\\]\\:\\[\\&_button\\]\\:min-h-11 button", ["not all and (min-width: 700px)"], 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".\\[\\&_pre\\]\\:m-\\[0\\.2rem_0_0\\.3rem_1\\.2rem\\] pre", null, 4, [["margin", ".2rem 0 .3rem 1.2rem"]]], [".\\[\\&_pre\\]\\:max-h-72 pre", null, 4, [["max-height", "calc(var(--spacing) * 72)"]]], [".\\[\\&_pre\\]\\:overflow-auto pre", null, 4, [["overflow", "auto"]]], [".\\[\\&_pre\\]\\:rounded-ui pre", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&_pre\\]\\:bg-surface-0 pre", null, 4, [["background-color", "var(--surface-0)"]]], [".\\[\\&_pre\\]\\:p-2 pre", null, 4, [["padding", "calc(var(--spacing) * 2)"]]], [".\\[\\&_pre\\]\\:text-\\[0\\.78rem\\] pre", null, 4, [["font-size", ".78rem"]]], [".\\[\\&_pre\\]\\:\\[overflow-wrap\\:anywhere\\] pre", null, 4, [["overflow-wrap", "anywhere"]]], [".\\[\\&_pre\\]\\:whitespace-pre-wrap pre", null, 4, [["white-space", "pre-wrap"]]], [".\\[\\&_pre\\]\\:text-fg pre, .\\[\\&_strong\\]\\:text-fg strong", null, 4, [["color", "var(--text)"]]], [".\\[\\&_summary\\]\\:cursor-pointer summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:bg-surface-1:hover:not(:disabled)", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-accent:hover:not(:disabled)", null, 4, [["color", "var(--accent)"]]], [".\\[\\&\\:hover\\:not\\(\\:disabled\\)\\]\\:text-red:hover:not(:disabled)", null, 4, [["color", "var(--red)"]]], [".\\[\\&\\:not\\(\\:has\\(\\[data-setting-row\\]\\)\\)\\>\\[data-none\\]\\]\\:block:not(:has([data-setting-row])) > [data-none]", null, 4, [["display", "block"]]], [".\\[\\&\\>\\*\\]\\:min-h-0 > *", null, 4, [["min-height", "0"]]], [".\\[\\&\\>\\*\\]\\:min-w-0 > *", null, 4, [["min-width", "0"]]], [".\\[\\&\\>\\*\\]\\:flex-1 > *", null, 4, [["flex", "1"]]], [".\\[\\&\\>\\*\\]\\:shrink-0 > *", null, 4, [["flex-shrink", "0"]]], [".\\[\\&\\>li\\]\\:text-\\[0\\.85rem\\] > li", null, 4, [["font-size", ".85rem"]]], [".\\[\\&\\>li\\]\\:leading-\\[1\\.5\\] > li", null, 4, [["--tw-leading", "1.5"], ["line-height", "1.5"]]], [".\\[\\&\\>li\\]\\:text-fg > li", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\>summary\\]\\:flex > summary", null, 4, [["display", "flex"]]], [".\\[\\&\\>summary\\]\\:cursor-pointer > summary", null, 4, [["cursor", "pointer"]]], [".\\[\\&\\>summary\\]\\:list-none > summary", null, 4, [["list-style-type", "none"]]], [".\\[\\&\\>summary\\]\\:items-center > summary", null, 4, [["align-items", "center"]]], [".\\[\\&\\>summary\\]\\:gap-\\[0\\.4rem\\] > summary", null, 4, [["gap", ".4rem"]]], [".\\[\\&\\>summary\\]\\:rounded-ui > summary", null, 4, [["border-radius", "var(--radius)"]]], [".\\[\\&\\>summary\\]\\:px-\\[0\\.4rem\\] > summary", null, 4, [["padding-inline", ".4rem"]]], [".\\[\\&\\>summary\\]\\:py-\\[0\\.25rem\\] > summary", null, 4, [["padding-block", ".25rem"]]], [".\\[\\&\\>summary\\]\\:select-none > summary", null, 4, [["-webkit-user-select", "none"], ["user-select", "none"]]], [".\\[\\&\\>summary\\]\\:before\\:inline-block > summary:before", null, 4, [["content", "var(--tw-content)"], ["display", "inline-block"]]], [".\\[\\&\\>summary\\]\\:before\\:size-\\[0\\.4rem\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["width", ".4rem"], ["height", ".4rem"]]], [".\\[\\&\\>summary\\]\\:before\\:shrink-0 > summary:before", null, 4, [["content", "var(--tw-content)"], ["flex-shrink", "0"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transform\\:rotate\\(-45deg\\)\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(-45deg)"]]], [".\\[\\&\\>summary\\]\\:before\\:content-\\[\\'\\'\\] > summary:before", null, 4, [["--tw-content", '""'], ["content", "var(--tw-content)"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-bottom\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-bottom", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[border-right\\:1\\.3px_solid_currentColor\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["border-right", "1.3px solid"]]], [".\\[\\&\\>summary\\]\\:before\\:\\[transition\\:transform_0\\.15s_ease\\] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transition", "transform .15s"]]], [".\\[\\&\\>summary\\:hover\\]\\:bg-surface-1 > summary:hover", null, 4, [["background-color", "var(--surface-1)"]]], [".\\[\\&\\>summary\\:hover\\]\\:text-fg > summary:hover", null, 4, [["color", "var(--text)"]]], [".\\[\\&\\[open\\]\\>summary\\]\\:before\\:\\[transform\\:rotate\\(45deg\\)\\][open] > summary:before", null, 4, [["content", "var(--tw-content)"], ["transform", "rotate(45deg)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-11", null, 4, [["min-height", "calc(var(--spacing) * 11)"]]], [".app--mobile .\\[\\.app--mobile_\\&\\]\\:min-h-\\[44px\\]", null, 4, [["min-height", "44px"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-60", ["(hover: none)"], 4, [["opacity", ".6"]]], [".\\[\\@media\\(hover\\:none\\)\\]\\:opacity-100", ["(hover: none)"], 4, [["opacity", "1"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-h-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-height", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:min-w-\\[2\\.75rem\\]", ["(max-width: 700px)"], 4, [["min-width", "2.75rem"]]], [".\\[\\@media\\(max-width\\:700px\\)\\]\\:px-\\[0\\.65rem\\]", ["(max-width: 700px)"], 4, [["padding-inline", ".65rem"]]], ["div:hover > .\\[div\\:hover\\>\\&\\]\\:opacity-100", null, 4, [["opacity", "1"]]], [":root", null, 1e3, [["color-scheme", "dark"], ["--scrollbar-size", "6px"], ["--accent", "#c8c8c8"], ["--panel-bg", "#161616"], ["--surface-0", "#262626"], ["--surface-1", "#333"], ["--surface-dim", "#1c1c1c"], ["--backdrop", "#050505"], ["--overlay-0", "#3a3a3a"], ["--overlay-1", "#9b9b9b"], ["--text", "#d8d8d8"], ["--subtext-0", "#9b9b9b"], ["--mauve", "#a993c9"], ["--green", "#7fb685"], ["--yellow", "#d3b46a"], ["--red", "#df8c8c"], ["--blue", "#7aa2d7"], ["--teal", "#7fb8b8"], ["--peach", "#d39a6a"], ["--bg", "var(--panel-bg)"], ["--surface", "var(--surface-0)"], ["--surface-alt", "var(--surface-1)"], ["--border", "var(--overlay-0)"], ["--muted", "var(--subtext-0)"], ["--danger", "var(--red)"], ["--radius", "8px"], ["--radius-pane", "8px"], ["accent-color", "var(--accent)"], ["--font-ui", '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'], ["--font-mono", `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace`], ["font-family", "var(--font-ui)"]]], ["code, pre, kbd, samp", null, 1e3, [["font-family", "var(--font-mono)"]]], ["*", null, 1e3, [["box-sizing", "border-box"]]], ["html, body, #root", null, 1e3, [["height", "100%"], ["margin", "0"]]], ["html", null, 1e3, [["overscroll-behavior", "none"], ["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--shell-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ["html", null, 1e3, [["--backdrop-bg", "var(--backdrop)"], ["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "var(--backdrop)"]]], ["html[data-glass]", null, 1e3, [["--backdrop-bg", "color-mix(in srgb, var(--backdrop) 86%, transparent)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "var(--panel-bg)"]]], ["html[data-glass]", null, 1e3, [["--card-bg", "color-mix(in srgb, var(--panel-bg) 86%, transparent)"]]], ['body:has(.app--cards, .app--mobile), .app--cards .dock-area:has([data-testid="split-canvas"]:not([data-split="0"]))', null, 1e3, [["background", "var(--backdrop-bg)"]]], ["body", null, 1e3, [["background", "var(--shell-bg)"], ["color", "var(--text)"], ["overscroll-behavior", "none"], ["-webkit-tap-highlight-color", "transparent"], ["line-height", "1.3"]]], [".app", null, 1e3, [["flex-direction", "column"], ["height", "100dvh"], ["display", "flex"]]], [".app--mobile", null, 1e3, [["inset", "var(--visible-top, 0px) 0 auto 0"], ["height", "var(--visible-height, 100dvh)"], ["position", "fixed"]]], [".mobile-drawer-backdrop", null, 1e3, [["animation", ".15s ease-out mobile-fade"]]], [".mobile-drawer--left", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-left"]]], [".mobile-drawer--right", null, 1e3, [["animation", ".2s cubic-bezier(.2, .8, .2, 1) mobile-slide-right"]]], [".mobile-sheet", null, 1e3, [["animation", ".22s cubic-bezier(.2, .8, .2, 1) mobile-rise"]]], [".mobile-drawer-backdrop, .mobile-drawer, .mobile-sheet", ["(prefers-reduced-motion: reduce)"], 1e3, [["animation", "none"]]], [".layout-drawer", null, 1e3, [["transform", "translateX(var(--float-hide, 0))"], ["transition", "transform .18s"]]], [".layout-drawer:hover, .layout-drawer:focus-within", null, 1e3, [["--float-hide", "0px"]]], [".dockview-theme-perch", null, 1e3, [["--dv-color-abyss-dark", "var(--panel-bg)"], ["--dv-color-abyss", "var(--surface-0)"], ["--dv-color-abyss-light", "var(--surface-1)"], ["--dv-color-abyss-lighter", "var(--overlay-0)"], ["--dv-color-abyss-accent", "var(--accent)"], ["--dv-color-abyss-primary-text", "var(--text)"], ["--dv-color-abyss-secondary-text", "var(--subtext-0)"], ["--dv-group-view-background-color", "var(--panel-bg)"], ["--dv-tabs-and-actions-container-background-color", "var(--surface-0)"], ["--dv-activegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-activegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-inactivegroup-visiblepanel-tab-background-color", "var(--panel-bg)"], ["--dv-inactivegroup-hiddenpanel-tab-background-color", "var(--surface-0)"], ["--dv-tab-divider-color", "var(--overlay-0)"], ["--dv-activegroup-visiblepanel-tab-color", "var(--text)"], ["--dv-activegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-visiblepanel-tab-color", "var(--subtext-0)"], ["--dv-inactivegroup-hiddenpanel-tab-color", "var(--subtext-0)"], ["--dv-separator-border", "var(--overlay-0)"], ["--dv-paneview-header-border-color", "var(--overlay-0)"], ["--dv-tabs-and-actions-container-font-size", ".82rem"], ["--dv-tabs-and-actions-container-height", "2.1rem"]]], [".dockview-theme-perch .dv-tabs-and-actions-container", null, 1e3, [["z-index", "1"], ["position", "relative"]]], [".pane-tab", null, 1e3, [["align-items", "center"], ["width", "100%"], ["height", "100%"], ["display", "flex"]]], [".pane-tab__agent-badge", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["flex-shrink", "0"], ["margin-right", ".4rem"], ["font-size", ".78em"]]], ['.pane-tab[data-testid="pane-tab-chat"] .dv-default-tab-action', null, 1e3, [["display", "none"]]], [".dockview-group-action", null, 1e3, [["border-radius", "var(--radius)"], ["width", "1.5rem"], ["height", "1.5rem"], ["color", "var(--subtext-0)"], ["cursor", "pointer"], ["background", "none"], ["border", "none"], ["justify-content", "center"], ["align-self", "center"], ["align-items", "center"], ["margin", "0 .15rem"], ["font-size", "1rem"], ["line-height", "1"], ["transition", "color .1s, background .1s"], ["display", "flex"]]], [".dockview-group-action:hover", null, 1e3, [["color", "var(--text)"], ["background", "var(--surface-1)"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-inactive-group)", ["(max-width: 700px)"], 1e3, [["display", "none"]]], [".dockview-theme-perch .dv-view-container > .dv-view:has(.dv-active-group)", ["(max-width: 700px)"], 1e3, [["width", "100%", 1], ["left", "0", 1]]], [".chat", null, 1e3, [["isolation", "isolate"], ["flex-direction", "column"], ["flex", "1"], ["height", "100%"], ["min-height", "0"], ["display", "flex"]]], [".message__markdown p", null, 1e3, [["margin", "0 0 .5em"]]], [".message__markdown p:last-child", null, 1e3, [["margin-bottom", "0"]]], [".message__markdown h1, .message__markdown h2, .message__markdown h3, .message__markdown h4", null, 1e3, [["margin", ".6em 0 .3em"], ["line-height", "1.25"]]], [".message__markdown h1", null, 1e3, [["font-size", "1.25em"]]], [".message__markdown h2", null, 1e3, [["font-size", "1.12em"]]], [".message__markdown h3", null, 1e3, [["font-size", "1em"]]], [".message__markdown > * + *", null, 1e3, [["margin-top", ".5em"]]], [".message__markdown table, .md-table", null, 1e3, [["border-collapse", "separate"], ["border-spacing", "0"], ["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["max-width", "100%"], ["margin", ".5em 0"], ["font-size", ".92em"], ["display", "block"], ["overflow-x", "auto"]]], [".md-table", null, 1e3, [["width", "100%"], ["margin", "0"], ["display", "table"]]], [".message__markdown th, .message__markdown td, .md-table th, .md-table td", null, 1e3, [["text-align", "left"], ["vertical-align", "top"], ["border-bottom", "1px solid var(--surface-1)"], ["padding", ".35em .75em"]]], [".message__markdown th, .md-table th", null, 1e3, [["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["background", "var(--surface-1)"], ["font-weight", "600"]]], [".message__markdown tbody tr:last-child td, .md-table tbody tr:last-child td", null, 1e3, [["border-bottom", "0"]]], [".message__markdown tbody tr:hover td, .md-table tbody tr:hover td", null, 1e3, [["background", "var(--surface-1)"]]], [".md-table caption", null, 1e3, [["text-align", "left"], ["color", "var(--subtext-0)"], ["padding", ".4em .75em"]]], [".md-code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["overflow", "hidden"]]], [".md-code__bar", null, 1e3, [["color", "var(--subtext-0)"], ["background", "var(--surface-1)"], ["justify-content", "space-between"], ["align-items", "center"], ["padding", ".1rem .4rem .1rem .75rem"], ["font-size", ".75em"], ["display", "flex"]]], [".message__markdown .md-code pre", null, 1e3, [["background", "none"], ["border-radius", "0"], ["margin", "0"]]], [".hl-keyword", null, 1e3, [["color", "var(--mauve)"]]], [".hl-string", null, 1e3, [["color", "var(--green)"]]], [".hl-number", null, 1e3, [["color", "var(--peach)"]]], [".hl-function", null, 1e3, [["color", "var(--blue)"]]], [".hl-type", null, 1e3, [["color", "var(--yellow)"]]], [".hl-tag", null, 1e3, [["color", "var(--teal)"]]], [".hl-comment", null, 1e3, [["color", "var(--overlay-1)"], ["font-style", "italic"]]], [".message__markdown ul, .message__markdown ol", null, 1e3, [["margin", ".3em 0 .5em 1.3em"], ["padding", "0"]]], [".message__markdown li", null, 1e3, [["margin-bottom", ".2em"]]], [".message__markdown code", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", ".25rem"], ["padding", ".1em .35em"], ["font-family", "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"], ["font-size", ".88em"]]], [".message__markdown pre", null, 1e3, [["background", "var(--surface-0)"], ["border-radius", "var(--radius)"], ["margin", ".4em 0"], ["padding", ".6rem .75rem"], ["position", "relative"], ["overflow-x", "auto"]]], [".message__markdown pre code", null, 1e3, [["background", "none"], ["border", "none"], ["padding", "0"], ["font-size", ".85em"]]], [".message__markdown a", null, 1e3, [["color", "var(--accent)"], ["text-decoration", "underline"]]], [".message__markdown blockquote", null, 1e3, [["border-left", "3px solid var(--overlay-0)"], ["color", "var(--subtext-0)"], ["margin", ".4em 0"], ["padding", ".1em .6em"]]], [".message__markdown hr", null, 1e3, [["border", "none"], ["border-top", "1px solid var(--overlay-0)"], ["margin", ".75em 0"]]], [".file-markdown", null, 1e3, [["overflow-wrap", "anywhere"]]], [".file-markdown img", null, 1e3, [["max-width", "100%"]]], [".file-markdown table", null, 1e3, [["border-collapse", "collapse"], ["margin", ".4em 0"], ["display", "block"], ["overflow-x", "auto"]]], [".file-markdown th, .file-markdown td", null, 1e3, [["border", "1px solid var(--overlay-0)"], ["padding", ".2em .5em"]]], [".file-markdown .md-placeholder", null, 1e3, [["color", "var(--subtext-0)"], ["border", "1px dashed var(--overlay-0)"], ["border-radius", ".25rem"], ["padding", ".05em .35em"], ["font-size", ".9em"]]], [".terminal", null, 1e3, [["min-width", "0"], ["min-height", "0"], ["padding", "var(--terminal-padding, 0)"], ["opacity", "var(--terminal-opacity, 1)"], ["flex", "1"], ["display", "flex"], ["position", "relative"]]], [".terminal__surface", null, 1e3, [["flex", "1"], ["min-width", "0"], ["min-height", "0"], ["overflow", "hidden"]]], [".terminal__surface .xterm", null, 1e3, [["height", "100%"]]], [".terminal__surface .xterm:not(.allow-transparency) .xterm-viewport", null, 1e3, [["background-color", "#0000"]]], [".terminal__surface .xterm-scrollable-element", null, 1e3, [["position", "static", 1]]], [".terminal__surface .xterm-decoration-overview-ruler, .no-pane-scrollbars .terminal__surface .xterm-scrollable-element > .xterm-scrollbar", null, 1e3, [["display", "none"]]], [".terminal--persistent", null, 1e3, [["flex-direction", "column"]]], [".terminal__toolbar", null, 1e3, [["color", "var(--subtext-0)"], ["align-items", "center"], ["gap", ".5rem"], ["padding", ".25rem 1.5rem .25rem .5rem"], ["font-size", ".8rem"], ["display", "flex"]]], [".terminal__toolbar button", null, 1e3, [["border-radius", "var(--radius)"], ["min-height", "32px"], ["color", "var(--text)"], ["background", "var(--surface-0)"], ["border", "0"], ["padding", ".25rem .5rem"]]], [".terminal__toolbar--overlay", null, 1e3, [["z-index", "2"], ["border-radius", "var(--radius)"], ["background", "var(--surface-1)"], ["padding", ".2rem .3rem .2rem .6rem"], ["position", "absolute"], ["top", ".4rem"], ["right", ".9rem"], ["box-shadow", "0 2px 8px #00000040"]]], [".terminal__connection", null, 1e3, [["margin-right", "auto"]]], [".terminal__toolbar button:disabled", null, 1e3, [["opacity", ".5"]]], [".terminal__notice", null, 1e3, [["color", "var(--subtext-0)"], ["padding", ".75rem"], ["font-size", ".85rem"]]], [".app--mobile .terminal__toolbar button", null, 1e3, [["min-height", "44px"]]], [".app--mobile .terminal__connection", null, 1e3, [["display", "none"]]], [".app--mobile .terminal__toolbar", null, 1e3, [["padding-right", ".5rem"]]], [".terminal__exited", null, 1e3, [["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["color", "var(--subtext-0)"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__exited--cli", null, 1e3, [["background", "var(--panel-bg)"], ["flex-direction", "column"], ["align-items", "center"], ["gap", ".6rem"], ["padding", ".9rem 1.1rem"], ["display", "flex"], ["top", "50%"], ["bottom", "auto"], ["transform", "translate(-50%, -50%)"], ["box-shadow", "0 6px 24px #00000059"]]], [".terminal__exited-actions", null, 1e3, [["gap", ".5rem"], ["display", "flex"]]], [".terminal__cli-error", null, 1e3, [["background", "var(--red)"], ["position", "absolute"], ["bottom", ".75rem"], ["left", "50%"], ["transform", "translateX(-50%)"]]], [".terminal__cli-error", null, 1e3, [["background", "color-mix(in srgb, var(--red) 20%, var(--panel-bg))"]]], [".terminal__cli-error", null, 1e3, [["border-radius", "var(--radius)"], ["color", "var(--red)"], ["text-align", "center"], ["white-space", "pre-wrap"], ["word-break", "break-word"], ["max-width", "90%"], ["padding", ".35rem .75rem"], ["font-size", ".85rem"]]], [".mobile-pane-shell__content > .chat, .mobile-pane-shell__content > .terminal, .mobile-pane-shell__content > .workspace-files, .mobile-pane-shell__content > .workspace-git", null, 1e3, [["flex", "1"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"]]], [".terminal__host", null, 1e3, [["width", "100%"], ["height", "100%"], ["overflow", "hidden"]]], [".workspace-git", null, 1e3, [["--git-border", "var(--overlay-0)"]]], [".workspace-git", null, 1e3, [["--git-border", "color-mix(in srgb, var(--overlay-0) 72%, transparent)"]]], [".workspace-git", null, 1e3, [["--git-muted", "var(--subtext-0)"], ["width", "100%"], ["min-width", "0"], ["height", "100%"], ["min-height", "0"], ["color", "var(--text)"], ["background", "var(--workspace-tools-bg, var(--panel-bg))"], ["flex-direction", "column"], ["font-size", ".78rem"], ["display", "flex"], ["position", "relative"], ["overflow", "hidden"], ["container-type", "inline-size"]]], [".workspace-git button, .workspace-git input, .workspace-git textarea", null, 1e3, [["font", "inherit"]]], [".workspace-git button", null, 1e3, [["cursor", "pointer"]]], ['.workspace-git button:focus-visible, .workspace-git input:focus-visible, .workspace-git textarea:focus-visible, .workspace-git [role="button"]:focus-visible', null, 1e3, [["outline", "2px solid var(--accent)"], ["outline-offset", "1px"]]], [".workspace-git__diff", null, 1e3, [["container-type", "inline-size"]]], [".workspace-git__line-comment-thread", null, 1e3, [["max-width", "max(0px, min(42rem, 100cqi - 6.9rem))"], ["position", "sticky"], ["left", "0"]]], [".workspace-git__comment-composer", null, 1e3, [["max-width", "max(0px, 100cqi - 1.4rem)"], ["position", "sticky"], ["left", "0"]]], [".dockview-group-action--split-session", null, 1e3, [["font-size", "13px"]]], [".session-split-popover", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["background", "var(--surface-1)"], ["border-radius", "var(--radius)"], ["box-shadow", "0 8px 24px rgba(0, 0, 0, 0.45)"], ["padding", "4px"], ["font-size", "12.5px"], ["color", "var(--text)"], ["overflow", "hidden"]]], [".session-split-popover__header", null, 1e3, [["padding", "6px 8px 4px"], ["font-size", "11px"], ["text-transform", "uppercase"], ["letter-spacing", "0.04em"], ["color", "var(--subtext-0)"]]], [".session-split-popover__empty", null, 1e3, [["padding", "8px"], ["color", "var(--subtext-0)"]]], [".session-split-popover__list", null, 1e3, [["overflow-y", "auto"]]], [".session-split-popover__item", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "flex-start"], ["gap", "1px"], ["width", "100%"], ["padding", "6px 8px"], ["border", "none"], ["border-radius", "4px"], ["background", "transparent"], ["color", "inherit"], ["text-align", "left"], ["cursor", "grab"]]], [".session-split-popover__item:hover", null, 1e3, [["background", "var(--surface-0)"]]], [".session-split-popover__item-title", null, 1e3, [["font-weight", "500"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-cwd", null, 1e3, [["font-size", "11px"], ["color", "var(--subtext-0)"], ["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["max-width", "100%"]]], [".session-split-popover__item-badge", null, 1e3, [["align-self", "flex-end"], ["font-size", "10px"], ["color", "var(--accent)"], ["margin-top", "-14px"]]], [".inactive-session-pane", null, 1e3, [["display", "flex"], ["flex-direction", "column"], ["align-items", "center"], ["justify-content", "center"], ["gap", "10px"], ["height", "100%"], ["padding", "24px"], ["text-align", "center"], ["color", "var(--subtext-0)"]]], [".inactive-session-pane__title", null, 1e3, [["font-size", "14px"], ["font-weight", "500"], ["color", "var(--text)"]]], [".inactive-session-pane__cwd", null, 1e3, [["font-size", "12px"], ["color", "var(--subtext-0)"], ["word-break", "break-all"]]], [".inactive-session-pane__note", null, 1e3, [["font-size", "12px"], ["max-width", "320px"], ["line-height", "1.5"]]], [".inactive-session-pane__switch", null, 1e3, [["margin-top", "4px"], ["padding", "6px 14px"], ["border-radius", "var(--radius)"], ["border", "0"], ["background", "var(--surface-0)"], ["color", "var(--text)"], ["cursor", "pointer"], ["font-size", "12.5px"]]], [".inactive-session-pane__switch:hover", null, 1e3, [["background", "var(--surface-1)"]]]], skipped: { "@supports evaluated false": 2, "@container": 6, "@keyframes": 9 } };
//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
let w0 = null;
const _0 = () => w0 ??= new Gh(x0);
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
let Pa = pl.NoEventPriority;
function S0(n, i) {
  const o = /* @__PURE__ */ new Set([...Object.keys(n), ...Object.keys(i)]);
  for (const c of o) {
    if (c === "children") continue;
    const s = n[c], d = i[c];
    if (!(s === d || typeof s == "function" && typeof d == "function") && !(c === "style" && s && d && typeof s == "object" && typeof d == "object" && [.../* @__PURE__ */ new Set([...Object.keys(s), ...Object.keys(d)])].every((m) => s[m] === d[m])))
      return !0;
  }
  return !1;
}
const z0 = (n) => !n.props.disabled && (/^(button|input|select|textarea)$/.test(n.tagName) || n.tagName === "a" && n.props.href != null || n.props.tabIndex != null);
function _d(n, i) {
  for (const o of dh(i.dangerouslySetInnerHTML?.__html, n.ownerDocument) ?? []) n.appendChild(o);
  return n;
}
const k0 = {
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
  scheduleTimeout: (n, i) => setTimeout(n, i),
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
  createInstance: (n, i, o) => _d(new re(n, i, o.ownerDocument), i),
  createTextInstance: (n, i) => new Ai(n),
  appendInitialChild: (n, i) => {
    n.appendChild(i);
  },
  // `autoFocus` focuses the element once it is in the tree, as React DOM does.
  finalizeInitialChildren: (n, i, o) => !!o.autoFocus,
  shouldSetTextContent: () => !1,
  appendChild: (n, i) => {
    n.appendChild(i);
  },
  appendChildToContainer: (n, i) => {
    n.appendChild(i);
  },
  insertBefore: (n, i, o) => {
    n.insertBefore(i, o);
  },
  insertInContainerBefore: (n, i, o) => {
    n.insertBefore(i, o);
  },
  removeChild: (n, i) => {
    n.removeChild(i);
  },
  removeChildFromContainer: (n, i) => {
    n.removeChild(i);
  },
  clearContainer: (n) => {
    for (const i of [...n.childNodes]) n.removeChild(i);
  },
  commitUpdate: (n, i, o, c) => {
    if (n.props = c, n.inline) for (const s of Object.keys(n.inline)) o.style?.[s] !== c.style?.[s] && delete n.inline[s];
    if (o.dangerouslySetInnerHTML?.__html !== c.dangerouslySetInnerHTML?.__html) {
      for (const s of [...n.childNodes]) n.removeChild(s);
      _d(n, c);
    }
    S0(o, c) && n.touch();
  },
  commitTextUpdate: (n, i, o) => {
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
    Pa = n;
  },
  getCurrentUpdatePriority: () => Pa,
  resolveUpdatePriority: () => Pa !== pl.NoEventPriority ? Pa : pl.DefaultEventPriority,
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
  bindToConsole: (n, i) => Function.prototype.bind.call(console[n], console, ...i)
}, Se = Nh(k0), Oi = (n, i, o = null) => Se.createPortal(n, i, null, o), E0 = {
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
};
class N0 {
  constructor(i, o, c) {
    Object.assign(this, { clientX: 0, clientY: 0, button: 0, buttons: 0, pointerType: "mouse", key: "", code: "", shiftKey: !1, metaKey: !1, ctrlKey: !1, altKey: !1, repeat: !1, isComposing: !1, keyCode: 0 }, o), this.type = i, this.target = c, this.currentTarget = null, this.defaultPrevented = !1, this.propagationStopped = !1, this.timeStamp = Date.now();
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
function vi(n, i, o) {
  i.currentTarget = n;
  for (const { type: c, listener: s, capture: d } of [...n.listeners ?? []])
    c === i.type && d === o && s.call(n, i);
  if (n instanceof re) {
    const c = E0[i.type], s = c && n.props[o ? `${c}Capture` : c];
    typeof s == "function" && s(i);
  }
}
function pv(n, i, o = {}) {
  const { document: c, window: s, globals: d } = gh(n), p = new re("div", { id: "root", style: o.container ?? {} }, c);
  c.body.appendChild(p);
  const m = [];
  let x = null;
  const w = () => [c, s].map((N) => N.listeners.map((A) => `${A.type}:${A.capture}`).sort().join(",")).join("|");
  let M = "";
  const D = {}, k = () => (x = y0(c, n, _0(), D, o.names), M = w(), n.render?.(x), x), g = () => {
    Se.flushPassiveEffects(), Se.flushSyncWork(), w() !== M && k();
  };
  c.afterCommit = k;
  const S = (N) => {
    m.push(N), n.error?.(N);
  }, _ = Se.createContainer(p, pl.ConcurrentRoot, null, !1, null, "", S, S, S, null);
  Se.updateContainerSync(ft.createElement(i, o.props ?? {}), _, null, null), Se.flushSyncWork(), g();
  const z = (N) => {
    const A = (H) => {
      if (H.id === N) return H;
      for (const C of H.children) {
        const b = A(C);
        if (b) return b;
      }
      return null;
    };
    return A(c.documentElement);
  }, Y = (N) => {
    const A = Pa;
    Pa = pl.DiscreteEventPriority;
    try {
      return N();
    } finally {
      Pa = A, Se.flushSyncWork(), g();
    }
  }, E = {
    document: c,
    window: s,
    /** What `window`, `document` and `localStorage` read while this screen runs (`dom.mjs`'s `GLOBALS`). */
    globals: d,
    container: p,
    errors: m,
    /** The latest description (after the last commit or state change). */
    get description() {
      return x;
    },
    describe: k,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(N, A, H = {}) {
      const C = typeof N == "string" ? z(N) : N;
      if (!C) return !1;
      const b = new N0(A, H, C), h = [];
      for (let at = C; at; at = at.parentNode) h.push(at);
      const G = [...h, c, s];
      Y(() => {
        for (let at = G.length - 1; at > 0 && !b.propagationStopped; at--) vi(G[at], b, !0);
        b.propagationStopped || (vi(C, b, !0), b.propagationStopped || vi(C, b, !1));
        for (let at = 1; at < G.length && !b.propagationStopped; at++) vi(G[at], b, !1);
      });
      const J = A === "click" && !b.defaultPrevented ? Mo(C) : null;
      return J && E.dispatch(J, "submit", {}), !b.defaultPrevented;
    },
    /** A key pressed while the screen has the keyboard (`init`: the DOM's `key`, modifiers, `repeat`), at the
     * focused element. When nothing prevented it and that element is a text field, the key edits the field as a
     * browser would: a character is typed at the end (or replaces the text when all of it is selected), Backspace
     * deletes the last one, and the field gets `input` and `change` events with its new `value`. Returns whether the
     * source took the key (prevented it, or a field changed). */
    key(N) {
      const A = c.activeElement && c.activeElement !== c.body ? c.activeElement : c.body;
      if (!E.dispatch(A, "keydown", N)) return !0;
      const C = N.key === "Enter" && !N.isComposing ? Mo(A, !0) : null;
      if (C)
        return E.dispatch(C, "submit", {}), !0;
      if (!Kd(A) || A.props.disabled || A.props.readOnly) return !1;
      if ((N.ctrlKey || N.metaKey) && !N.altKey && !N.shiftKey && N.key.toLowerCase() === "a")
        return A.selectedAll = !0, !0;
      if (N.ctrlKey || N.metaKey) return !1;
      const b = A.selectedAll;
      A.selectedAll = !1;
      const h = A.value, J = N.key === "Backspace" || b && N.key === "Delete" ? b ? "" : h.slice(0, -1) : [...N.key].length === 1 ? (b ? "" : h) + N.key : h;
      return J === h ? !1 : (A.value = J, E.dispatch(A, "input", { data: N.key }), E.dispatch(A, "change", {}), A.props.value !== void 0 && delete A.edit, A.touch(), k(), !0);
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(N, A) {
      const H = z(N);
      H && (H.bounds = { x: A.x, y: A.y, width: A.width, height: A.height });
    },
    /** A click on a check box or radio button (`id`): the `click` event, then, unless the source prevented it, the
     * box ticked as a browser ticks it (a radio button only on), with `input` and `change` events. */
    toggle(N) {
      const A = z(N);
      if (!A || A.props.disabled || !E.dispatch(N, "click", { button: 0, detail: 1 })) return;
      const H = A.props.type === "radio";
      H && A.checked || (A.checked = H ? !0 : !A.checked, E.dispatch(N, "input", {}), E.dispatch(N, "change", {}), A.props.checked !== void 0 && delete A.ticked, A.touch(), k());
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(N, A = {}) {
      const H = { button: 0, buttons: 1, pointerType: "mouse", ...A };
      for (const C of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) E.dispatch(N, C, H);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (N) => !!z(N)?.state.hover,
    hover(N, A) {
      const H = z(N);
      !H || H.state.hover === A || (H.state.hover = A, H.touch(), k());
    },
    focus(N) {
      const A = z(N);
      A && (Y(() => {
        const H = c.activeElement;
        H && H !== A && H !== c.body && E.dispatch(H, "blur"), c.focus(A), E.dispatch(A, "focus");
      }), k());
    },
    /** A press at node `id` that nothing prevented: the browser's default focuses the element pressed. Only an element
     * that listens for keys (`onKeyDown`) is focused, so a press elsewhere leaves the keyboard where it was; the focus
     * is not `:focus-visible`, as after a pointer press in a browser. */
    // ponytail: a browser focuses every focusable element pressed; here only one with its own key handler, so a
    // screen's ordinary buttons do not take the keyboard from a terminal.
    pressFocus(N) {
      let H = typeof N == "string" ? z(N) : N;
      for (; H && !(H instanceof re && typeof H.props.onKeyDown == "function" && z0(H)); ) H = H.parentNode;
      !H || H === c.activeElement || (E.focus(H.id), H.state.pointerFocus = !0, H.touch(), k());
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: g,
    update(N) {
      Se.updateContainerSync(ft.createElement(i, N ?? {}), _, null, null), Se.flushSyncWork(), g();
    },
    unmount() {
      Se.updateContainerSync(null, _, null, null), Se.flushSyncWork(), Se.flushPassiveEffects(), c.afterCommit = null;
    }
  };
  return E;
}
//! `react-dom` for a screen on the native renderer: `createPortal` (into `document.body`, the overlay layer) and
//! `flushSync`. Nothing of the browser renderer.
const am = (n) => Se.flushSyncFromReconciler(n), T0 = { createPortal: Oi, flushSync: am }, hv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createPortal: Oi,
  default: T0,
  flushSync: am
}, Symbol.toStringTag, { value: "Module" }));
function nm(n) {
  var i, o, c = "";
  if (typeof n == "string" || typeof n == "number") c += n;
  else if (typeof n == "object") if (Array.isArray(n)) {
    var s = n.length;
    for (i = 0; i < s; i++) n[i] && (o = nm(n[i])) && (c && (c += " "), c += o);
  } else for (o in n) n[o] && (c && (c += " "), c += o);
  return c;
}
function lm() {
  for (var n, i, o = 0, c = "", s = arguments.length; o < s; o++) (n = arguments[o]) && (i = nm(n)) && (c && (c += " "), c += i);
  return c;
}
const C0 = (n, i) => {
  const o = new Array(n.length + i.length);
  for (let c = 0; c < n.length; c++)
    o[c] = n[c];
  for (let c = 0; c < i.length; c++)
    o[n.length + c] = i[c];
  return o;
}, j0 = (n, i) => ({
  classGroupId: n,
  validator: i
}), im = (n = /* @__PURE__ */ new Map(), i = null, o) => ({
  nextPart: n,
  validators: i,
  classGroupId: o
}), Ti = "-", Sd = [], M0 = "arbitrary..", A0 = (n) => {
  const i = R0(n), {
    conflictingClassGroups: o,
    conflictingClassGroupModifiers: c
  } = n;
  return {
    getClassGroupId: (p) => {
      if (p.startsWith("[") && p.endsWith("]"))
        return O0(p);
      const m = p.split(Ti), x = m[0] === "" && m.length > 1 ? 1 : 0;
      return rm(m, x, i);
    },
    getConflictingClassGroupIds: (p, m) => {
      if (m) {
        const x = c[p], w = o[p];
        return x ? w ? C0(w, x) : x : w || Sd;
      }
      return o[p] || Sd;
    }
  };
}, rm = (n, i, o) => {
  if (n.length - i === 0)
    return o.classGroupId;
  const s = n[i], d = o.nextPart.get(s);
  if (d) {
    const w = rm(n, i + 1, d);
    if (w) return w;
  }
  const p = o.validators;
  if (p === null)
    return;
  const m = i === 0 ? n.join(Ti) : n.slice(i).join(Ti), x = p.length;
  for (let w = 0; w < x; w++) {
    const M = p[w];
    if (M.validator(m))
      return M.classGroupId;
  }
}, O0 = (n) => n.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
  const i = n.slice(1, -1), o = i.indexOf(":"), c = i.slice(0, o);
  return c ? M0 + c : void 0;
})(), R0 = (n) => {
  const {
    theme: i,
    classGroups: o
  } = n;
  return H0(o, i);
}, H0 = (n, i) => {
  const o = im();
  for (const c in n) {
    const s = n[c];
    Wo(s, o, c, i);
  }
  return o;
}, Wo = (n, i, o, c) => {
  const s = n.length;
  for (let d = 0; d < s; d++) {
    const p = n[d];
    D0(p, i, o, c);
  }
}, D0 = (n, i, o, c) => {
  if (typeof n == "string") {
    U0(n, i, o);
    return;
  }
  if (typeof n == "function") {
    B0(n, i, o, c);
    return;
  }
  q0(n, i, o, c);
}, U0 = (n, i, o) => {
  const c = n === "" ? i : om(i, n);
  c.classGroupId = o;
}, B0 = (n, i, o, c) => {
  if (Y0(n)) {
    Wo(n(c), i, o, c);
    return;
  }
  i.validators === null && (i.validators = []), i.validators.push(j0(o, n));
}, q0 = (n, i, o, c) => {
  const s = Object.entries(n), d = s.length;
  for (let p = 0; p < d; p++) {
    const [m, x] = s[p];
    Wo(x, om(i, m), o, c);
  }
}, om = (n, i) => {
  let o = n;
  const c = i.split(Ti), s = c.length;
  for (let d = 0; d < s; d++) {
    const p = c[d];
    let m = o.nextPart.get(p);
    m || (m = im(), o.nextPart.set(p, m)), o = m;
  }
  return o;
}, Y0 = (n) => "isThemeGetter" in n && n.isThemeGetter === !0, G0 = (n) => {
  if (n < 1)
    return {
      get: () => {
      },
      set: () => {
      }
    };
  let i = 0, o = /* @__PURE__ */ Object.create(null), c = /* @__PURE__ */ Object.create(null);
  const s = (d, p) => {
    o[d] = p, i++, i > n && (i = 0, c = o, o = /* @__PURE__ */ Object.create(null));
  };
  return {
    get(d) {
      let p = o[d];
      if (p !== void 0)
        return p;
      if ((p = c[d]) !== void 0)
        return s(d, p), p;
    },
    set(d, p) {
      d in o ? o[d] = p : s(d, p);
    }
  };
}, Bo = "!", zd = ":", Q0 = [], kd = (n, i, o, c, s) => ({
  modifiers: n,
  hasImportantModifier: i,
  baseClassName: o,
  maybePostfixModifierPosition: c,
  isExternal: s
}), K0 = (n) => {
  const {
    prefix: i,
    experimentalParseClassName: o
  } = n;
  let c = (s) => {
    const d = [];
    let p = 0, m = 0, x = 0, w;
    const M = s.length;
    for (let _ = 0; _ < M; _++) {
      const z = s[_];
      if (p === 0 && m === 0) {
        if (z === zd) {
          d.push(s.slice(x, _)), x = _ + 1;
          continue;
        }
        if (z === "/") {
          w = _;
          continue;
        }
      }
      z === "[" ? p++ : z === "]" ? p-- : z === "(" ? m++ : z === ")" && m--;
    }
    const D = d.length === 0 ? s : s.slice(x);
    let k = D, g = !1;
    D.endsWith(Bo) ? (k = D.slice(0, -1), g = !0) : (
      /**
       * In Tailwind CSS v3 the important modifier was at the start of the base class name. This is still supported for legacy reasons.
       * @see https://github.com/dcastil/tailwind-merge/issues/513#issuecomment-2614029864
       */
      D.startsWith(Bo) && (k = D.slice(1), g = !0)
    );
    const S = w && w > x ? w - x : void 0;
    return kd(d, g, k, S);
  };
  if (i) {
    const s = i + zd, d = c;
    c = (p) => p.startsWith(s) ? d(p.slice(s.length)) : kd(Q0, !1, p, void 0, !0);
  }
  if (o) {
    const s = c;
    c = (d) => o({
      className: d,
      parseClassName: s
    });
  }
  return c;
}, V0 = (n) => {
  const i = /* @__PURE__ */ new Map();
  return n.orderSensitiveModifiers.forEach((o, c) => {
    i.set(o, 1e6 + c);
  }), (o) => {
    const c = [];
    let s = [];
    for (let d = 0; d < o.length; d++) {
      const p = o[d], m = p[0] === "[", x = i.has(p);
      m || x ? (s.length > 0 && (s.sort(), c.push(...s), s = []), c.push(p)) : s.push(p);
    }
    return s.length > 0 && (s.sort(), c.push(...s)), c;
  };
}, X0 = (n) => ({
  cache: G0(n.cacheSize),
  parseClassName: K0(n),
  sortModifiers: V0(n),
  postfixLookupClassGroupIds: Z0(n),
  ...A0(n)
}), Z0 = (n) => {
  const i = /* @__PURE__ */ Object.create(null), o = n.postfixLookupClassGroups;
  if (o)
    for (let c = 0; c < o.length; c++)
      i[o[c]] = !0;
  return i;
}, J0 = /\s+/, L0 = (n, i) => {
  const {
    parseClassName: o,
    getClassGroupId: c,
    getConflictingClassGroupIds: s,
    sortModifiers: d,
    postfixLookupClassGroupIds: p
  } = i, m = [], x = n.trim().split(J0);
  let w = "";
  for (let M = x.length - 1; M >= 0; M -= 1) {
    const D = x[M], {
      isExternal: k,
      modifiers: g,
      hasImportantModifier: S,
      baseClassName: _,
      maybePostfixModifierPosition: z
    } = o(D);
    if (k) {
      w = D + (w.length > 0 ? " " + w : w);
      continue;
    }
    let Y = !!z, E;
    if (Y) {
      const b = _.substring(0, z);
      E = c(b);
      const h = E && p[E] ? c(_) : void 0;
      h && h !== E && (E = h, Y = !1);
    } else
      E = c(_);
    if (!E) {
      if (!Y) {
        w = D + (w.length > 0 ? " " + w : w);
        continue;
      }
      if (E = c(_), !E) {
        w = D + (w.length > 0 ? " " + w : w);
        continue;
      }
      Y = !1;
    }
    const N = g.length === 0 ? "" : g.length === 1 ? g[0] : d(g).join(":"), A = S ? N + Bo : N, H = A + E;
    if (m.indexOf(H) > -1)
      continue;
    m.push(H);
    const C = s(E, Y);
    for (let b = 0; b < C.length; ++b) {
      const h = C[b];
      m.push(A + h);
    }
    w = D + (w.length > 0 ? " " + w : w);
  }
  return w;
}, W0 = (...n) => {
  let i = 0, o, c, s = "";
  for (; i < n.length; )
    (o = n[i++]) && (c = sm(o)) && (s && (s += " "), s += c);
  return s;
}, sm = (n) => {
  if (typeof n == "string")
    return n;
  let i, o = "";
  for (let c = 0; c < n.length; c++)
    n[c] && (i = sm(n[c])) && (o && (o += " "), o += i);
  return o;
}, F0 = (n, ...i) => {
  let o, c, s, d;
  const p = (x) => {
    const w = i.reduce((M, D) => D(M), n());
    return o = X0(w), c = o.cache.get, s = o.cache.set, d = m, m(x);
  }, m = (x) => {
    const w = c(x);
    if (w)
      return w;
    const M = L0(x, o);
    return s(x, M), M;
  };
  return d = p, (...x) => d(W0(...x));
}, I0 = [], Zt = (n) => {
  const i = (o) => o[n] || I0;
  return i.isThemeGetter = !0, i.themeKey = n, i;
}, cm = /^\[(?:(\w[\w-]*):)?(.+)\]$/i, um = /^\((?:(\w[\w-]*):)?(.+)\)$/i, $0 = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/, P0 = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/, tg = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/, eg = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/, ag = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/, ng = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/, Ca = (n) => $0.test(n), pt = (n) => !!n && !Number.isNaN(Number(n)), Ze = (n) => !!n && Number.isInteger(Number(n)), No = (n) => n.endsWith("%") && pt(n.slice(0, -1)), sa = (n) => P0.test(n), dm = () => !0, lg = (n) => (
  // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
  // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
  // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
  tg.test(n) && !eg.test(n)
), Fo = () => !1, ig = (n) => ag.test(n), rg = (n) => ng.test(n), og = (n) => !W(n) && !F(n), sg = (n) => n.startsWith("@container") && (n[10] === "/" && n[11] !== void 0 || n[11] === "s" && n[16] !== void 0 && n.startsWith("-size/", 10) || n[11] === "n" && n[18] !== void 0 && n.startsWith("-normal/", 10)), cg = (n) => Aa(n, pm, Fo), W = (n) => cm.test(n), $a = (n) => Aa(n, hm, lg), Ed = (n) => Aa(n, bg, pt), ug = (n) => Aa(n, bm, dm), dg = (n) => Aa(n, gm, Fo), Nd = (n) => Aa(n, mm, Fo), mg = (n) => Aa(n, fm, rg), yi = (n) => Aa(n, vm, ig), F = (n) => um.test(n), dl = (n) => en(n, hm), fg = (n) => en(n, gm), Td = (n) => en(n, mm), pg = (n) => en(n, pm), hg = (n) => en(n, fm), xi = (n) => en(n, vm, !0), gg = (n) => en(n, bm, !0), Aa = (n, i, o) => {
  const c = cm.exec(n);
  return c ? c[1] ? i(c[1]) : o(c[2]) : !1;
}, en = (n, i, o = !1) => {
  const c = um.exec(n);
  return c ? c[1] ? i(c[1]) : o : !1;
}, mm = (n) => n === "position" || n === "percentage", fm = (n) => n === "image" || n === "url", pm = (n) => n === "length" || n === "size" || n === "bg-size", hm = (n) => n === "length", bg = (n) => n === "number", gm = (n) => n === "family-name", bm = (n) => n === "number" || n === "weight", vm = (n) => n === "shadow", vg = () => {
  const n = Zt("color"), i = Zt("font"), o = Zt("text"), c = Zt("font-weight"), s = Zt("tracking"), d = Zt("leading"), p = Zt("breakpoint"), m = Zt("container"), x = Zt("spacing"), w = Zt("radius"), M = Zt("shadow"), D = Zt("inset-shadow"), k = Zt("text-shadow"), g = Zt("drop-shadow"), S = Zt("blur"), _ = Zt("perspective"), z = Zt("aspect"), Y = Zt("ease"), E = Zt("animate"), N = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"], A = () => [
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
  ], H = () => [...A(), F, W], C = () => ["auto", "hidden", "clip", "visible", "scroll"], b = () => ["auto", "contain", "none"], h = () => [F, W, x], G = () => [Ca, "full", "auto", ...h()], J = () => [Ze, "none", "subgrid", F, W], at = () => ["auto", {
    span: ["full", Ze, F, W]
  }, Ze, F, W], ot = () => [Ze, "auto", F, W], Mt = () => ["auto", "min", "max", "fr", F, W], Kt = () => ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "center-safe", "end-safe"], Nt = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"], K = () => ["auto", ...h()], et = () => [Ca, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...h()], nt = () => [m, Ca, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...h()], U = () => [Ca, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...h()], B = () => [n, F, W], v = () => [...A(), Td, Nd, {
    position: [F, W]
  }], q = () => ["no-repeat", {
    repeat: ["", "x", "y", "space", "round"]
  }], tt = () => ["auto", "cover", "contain", pg, cg, {
    size: [F, W]
  }], $ = () => [No, dl, $a], P = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    "full",
    w,
    F,
    W
  ], lt = () => ["", pt, dl, $a], xt = () => ["solid", "dashed", "dotted", "double"], Jt = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"], ut = () => [pt, No, Td, Nd], Oa = () => [
    // Deprecated since Tailwind CSS v4.0.0
    "",
    "none",
    S,
    F,
    W
  ], Ra = () => ["none", pt, F, W], Ae = () => ["none", pt, F, W], Oe = () => [pt, F, W], ua = () => [Ca, "full", ...h()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [sa],
      breakpoint: [sa],
      color: [dm],
      container: [sa],
      "drop-shadow": [sa],
      ease: ["in", "out", "in-out"],
      font: [og],
      "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      "inset-shadow": [sa],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [sa],
      shadow: [sa],
      spacing: ["px", pt],
      text: [sa],
      "text-shadow": [sa],
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
        aspect: ["auto", "square", Ca, W, F, z]
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
        "@container": ["", "normal", "size", F, W]
      }],
      /**
       * Container Name
       * @see https://tailwindcss.com/docs/responsive-design#named-containers
       */
      "container-named": [sg],
      /**
       * Columns
       * @see https://tailwindcss.com/docs/columns
       */
      columns: [{
        columns: [pt, "auto", W, F, m]
      }],
      /**
       * Break After
       * @see https://tailwindcss.com/docs/break-after
       */
      "break-after": [{
        "break-after": N()
      }],
      /**
       * Break Before
       * @see https://tailwindcss.com/docs/break-before
       */
      "break-before": [{
        "break-before": N()
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
        overflow: C()
      }],
      /**
       * Overflow X
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-x": [{
        "overflow-x": C()
      }],
      /**
       * Overflow Y
       * @see https://tailwindcss.com/docs/overflow
       */
      "overflow-y": [{
        "overflow-y": C()
      }],
      /**
       * Overscroll Behavior
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      overscroll: [{
        overscroll: b()
      }],
      /**
       * Overscroll Behavior X
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-x": [{
        "overscroll-x": b()
      }],
      /**
       * Overscroll Behavior Y
       * @see https://tailwindcss.com/docs/overscroll-behavior
       */
      "overscroll-y": [{
        "overscroll-y": b()
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
        inset: G()
      }],
      /**
       * Inset Inline
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-x": [{
        "inset-x": G()
      }],
      /**
       * Inset Block
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-y": [{
        "inset-y": G()
      }],
      /**
       * Inset Inline Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-s` in next major release
       */
      start: [{
        "inset-s": G(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        start: G()
      }],
      /**
       * Inset Inline End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       * @todo class group will be renamed to `inset-e` in next major release
       */
      end: [{
        "inset-e": G(),
        /**
         * @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
         * @see https://github.com/tailwindlabs/tailwindcss/pull/19613
         */
        end: G()
      }],
      /**
       * Inset Block Start
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-bs": [{
        "inset-bs": G()
      }],
      /**
       * Inset Block End
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      "inset-be": [{
        "inset-be": G()
      }],
      /**
       * Top
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      top: [{
        top: G()
      }],
      /**
       * Right
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      right: [{
        right: G()
      }],
      /**
       * Bottom
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      bottom: [{
        bottom: G()
      }],
      /**
       * Left
       * @see https://tailwindcss.com/docs/top-right-bottom-left
       */
      left: [{
        left: G()
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
        z: [Ze, "auto", F, W]
      }],
      // ------------------------
      // --- Flexbox and Grid ---
      // ------------------------
      /**
       * Flex Basis
       * @see https://tailwindcss.com/docs/flex-basis
       */
      basis: [{
        basis: [Ca, "full", "auto", m, ...h()]
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
        flex: [pt, Ca, "auto", "initial", "none", W]
      }],
      /**
       * Flex Grow
       * @see https://tailwindcss.com/docs/flex-grow
       */
      grow: [{
        grow: ["", pt, F, W]
      }],
      /**
       * Flex Shrink
       * @see https://tailwindcss.com/docs/flex-shrink
       */
      shrink: [{
        shrink: ["", pt, F, W]
      }],
      /**
       * Order
       * @see https://tailwindcss.com/docs/order
       */
      order: [{
        order: [Ze, "first", "last", "none", F, W]
      }],
      /**
       * Grid Template Columns
       * @see https://tailwindcss.com/docs/grid-template-columns
       */
      "grid-cols": [{
        "grid-cols": J()
      }],
      /**
       * Grid Column Start / End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start-end": [{
        col: at()
      }],
      /**
       * Grid Column Start
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-start": [{
        "col-start": ot()
      }],
      /**
       * Grid Column End
       * @see https://tailwindcss.com/docs/grid-column
       */
      "col-end": [{
        "col-end": ot()
      }],
      /**
       * Grid Template Rows
       * @see https://tailwindcss.com/docs/grid-template-rows
       */
      "grid-rows": [{
        "grid-rows": J()
      }],
      /**
       * Grid Row Start / End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start-end": [{
        row: at()
      }],
      /**
       * Grid Row Start
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-start": [{
        "row-start": ot()
      }],
      /**
       * Grid Row End
       * @see https://tailwindcss.com/docs/grid-row
       */
      "row-end": [{
        "row-end": ot()
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
        "auto-cols": Mt()
      }],
      /**
       * Grid Auto Rows
       * @see https://tailwindcss.com/docs/grid-auto-rows
       */
      "auto-rows": [{
        "auto-rows": Mt()
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
        justify: [...Kt(), "normal"]
      }],
      /**
       * Justify Items
       * @see https://tailwindcss.com/docs/justify-items
       */
      "justify-items": [{
        "justify-items": [...Nt(), "normal"]
      }],
      /**
       * Justify Self
       * @see https://tailwindcss.com/docs/justify-self
       */
      "justify-self": [{
        "justify-self": ["auto", ...Nt()]
      }],
      /**
       * Align Content
       * @see https://tailwindcss.com/docs/align-content
       */
      "align-content": [{
        content: ["normal", ...Kt()]
      }],
      /**
       * Align Items
       * @see https://tailwindcss.com/docs/align-items
       */
      "align-items": [{
        items: [...Nt(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Align Self
       * @see https://tailwindcss.com/docs/align-self
       */
      "align-self": [{
        self: ["auto", ...Nt(), {
          baseline: ["", "last"]
        }]
      }],
      /**
       * Place Content
       * @see https://tailwindcss.com/docs/place-content
       */
      "place-content": [{
        "place-content": Kt()
      }],
      /**
       * Place Items
       * @see https://tailwindcss.com/docs/place-items
       */
      "place-items": [{
        "place-items": [...Nt(), "baseline"]
      }],
      /**
       * Place Self
       * @see https://tailwindcss.com/docs/place-self
       */
      "place-self": [{
        "place-self": ["auto", ...Nt()]
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
        m: K()
      }],
      /**
       * Margin Inline
       * @see https://tailwindcss.com/docs/margin
       */
      mx: [{
        mx: K()
      }],
      /**
       * Margin Block
       * @see https://tailwindcss.com/docs/margin
       */
      my: [{
        my: K()
      }],
      /**
       * Margin Inline Start
       * @see https://tailwindcss.com/docs/margin
       */
      ms: [{
        ms: K()
      }],
      /**
       * Margin Inline End
       * @see https://tailwindcss.com/docs/margin
       */
      me: [{
        me: K()
      }],
      /**
       * Margin Block Start
       * @see https://tailwindcss.com/docs/margin
       */
      mbs: [{
        mbs: K()
      }],
      /**
       * Margin Block End
       * @see https://tailwindcss.com/docs/margin
       */
      mbe: [{
        mbe: K()
      }],
      /**
       * Margin Top
       * @see https://tailwindcss.com/docs/margin
       */
      mt: [{
        mt: K()
      }],
      /**
       * Margin Right
       * @see https://tailwindcss.com/docs/margin
       */
      mr: [{
        mr: K()
      }],
      /**
       * Margin Bottom
       * @see https://tailwindcss.com/docs/margin
       */
      mb: [{
        mb: K()
      }],
      /**
       * Margin Left
       * @see https://tailwindcss.com/docs/margin
       */
      ml: [{
        ml: K()
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
        size: et()
      }],
      /**
       * Inline Size
       * @see https://tailwindcss.com/docs/inline-size
       */
      "inline-size": [{
        inline: ["auto", ...nt()]
      }],
      /**
       * Min-Inline Size
       * @see https://tailwindcss.com/docs/min-inline-size
       */
      "min-inline-size": [{
        "min-inline": ["auto", ...nt()]
      }],
      /**
       * Max-Inline Size
       * @see https://tailwindcss.com/docs/max-inline-size
       */
      "max-inline-size": [{
        "max-inline": ["none", ...nt()]
      }],
      /**
       * Block Size
       * @see https://tailwindcss.com/docs/block-size
       */
      "block-size": [{
        block: ["auto", ...U()]
      }],
      /**
       * Min-Block Size
       * @see https://tailwindcss.com/docs/min-block-size
       */
      "min-block-size": [{
        "min-block": ["auto", ...U()]
      }],
      /**
       * Max-Block Size
       * @see https://tailwindcss.com/docs/max-block-size
       */
      "max-block-size": [{
        "max-block": ["none", ...U()]
      }],
      /**
       * Width
       * @see https://tailwindcss.com/docs/width
       */
      w: [{
        w: [m, "screen", ...et()]
      }],
      /**
       * Min-Width
       * @see https://tailwindcss.com/docs/min-width
       */
      "min-w": [{
        "min-w": [
          m,
          "screen",
          /** Deprecated. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          "none",
          ...et()
        ]
      }],
      /**
       * Max-Width
       * @see https://tailwindcss.com/docs/max-width
       */
      "max-w": [{
        "max-w": [
          m,
          "screen",
          "none",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          "prose",
          /** Deprecated since Tailwind CSS v4.0.0. @see https://github.com/tailwindlabs/tailwindcss.com/issues/2027#issuecomment-2620152757 */
          {
            screen: [p]
          },
          ...et()
        ]
      }],
      /**
       * Height
       * @see https://tailwindcss.com/docs/height
       */
      h: [{
        h: ["screen", "lh", ...et()]
      }],
      /**
       * Min-Height
       * @see https://tailwindcss.com/docs/min-height
       */
      "min-h": [{
        "min-h": ["screen", "lh", "none", ...et()]
      }],
      /**
       * Max-Height
       * @see https://tailwindcss.com/docs/max-height
       */
      "max-h": [{
        "max-h": ["screen", "lh", "none", ...et()]
      }],
      // ------------------
      // --- Typography ---
      // ------------------
      /**
       * Font Size
       * @see https://tailwindcss.com/docs/font-size
       */
      "font-size": [{
        text: ["base", o, dl, $a]
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
        font: [c, gg, ug]
      }],
      /**
       * Font Stretch
       * @see https://tailwindcss.com/docs/font-stretch
       */
      "font-stretch": [{
        "font-stretch": ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed", "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded", No, W]
      }],
      /**
       * Font Family
       * @see https://tailwindcss.com/docs/font-family
       */
      "font-family": [{
        font: [fg, dg, i]
      }],
      /**
       * Font Feature Settings
       * @see https://tailwindcss.com/docs/font-feature-settings
       */
      "font-features": [{
        "font-features": [W]
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
        tracking: [s, F, W]
      }],
      /**
       * Line Clamp
       * @see https://tailwindcss.com/docs/line-clamp
       */
      "line-clamp": [{
        "line-clamp": [pt, "none", F, Ed]
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
          ...h()
        ]
      }],
      /**
       * List Style Image
       * @see https://tailwindcss.com/docs/list-style-image
       */
      "list-image": [{
        "list-image": ["none", F, W]
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
        list: ["disc", "decimal", "none", F, W]
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
        placeholder: B()
      }],
      /**
       * Text Color
       * @see https://tailwindcss.com/docs/text-color
       */
      "text-color": [{
        text: B()
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
        decoration: [...xt(), "wavy"]
      }],
      /**
       * Text Decoration Thickness
       * @see https://tailwindcss.com/docs/text-decoration-thickness
       */
      "text-decoration-thickness": [{
        decoration: [pt, "from-font", "auto", F, $a]
      }],
      /**
       * Text Decoration Color
       * @see https://tailwindcss.com/docs/text-decoration-color
       */
      "text-decoration-color": [{
        decoration: B()
      }],
      /**
       * Text Underline Offset
       * @see https://tailwindcss.com/docs/text-underline-offset
       */
      "underline-offset": [{
        "underline-offset": [pt, "auto", F, W]
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
        tab: [Ze, F, W]
      }],
      /**
       * Vertical Alignment
       * @see https://tailwindcss.com/docs/vertical-align
       */
      "vertical-align": [{
        align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", F, W]
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
        content: ["none", F, W]
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
        bg: v()
      }],
      /**
       * Background Repeat
       * @see https://tailwindcss.com/docs/background-repeat
       */
      "bg-repeat": [{
        bg: q()
      }],
      /**
       * Background Size
       * @see https://tailwindcss.com/docs/background-size
       */
      "bg-size": [{
        bg: tt()
      }],
      /**
       * Background Image
       * @see https://tailwindcss.com/docs/background-image
       */
      "bg-image": [{
        bg: ["none", {
          linear: [{
            to: ["t", "tr", "r", "br", "b", "bl", "l", "tl"]
          }, Ze, F, W],
          radial: ["", F, W],
          conic: ["", Ze, F, W]
        }, hg, mg]
      }],
      /**
       * Background Color
       * @see https://tailwindcss.com/docs/background-color
       */
      "bg-color": [{
        bg: B()
      }],
      /**
       * Gradient Color Stops From Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-from-pos": [{
        from: $()
      }],
      /**
       * Gradient Color Stops Via Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via-pos": [{
        via: $()
      }],
      /**
       * Gradient Color Stops To Position
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to-pos": [{
        to: $()
      }],
      /**
       * Gradient Color Stops From
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-from": [{
        from: B()
      }],
      /**
       * Gradient Color Stops Via
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-via": [{
        via: B()
      }],
      /**
       * Gradient Color Stops To
       * @see https://tailwindcss.com/docs/gradient-color-stops
       */
      "gradient-to": [{
        to: B()
      }],
      // ---------------
      // --- Borders ---
      // ---------------
      /**
       * Border Radius
       * @see https://tailwindcss.com/docs/border-radius
       */
      rounded: [{
        rounded: P()
      }],
      /**
       * Border Radius Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-s": [{
        "rounded-s": P()
      }],
      /**
       * Border Radius End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-e": [{
        "rounded-e": P()
      }],
      /**
       * Border Radius Top
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-t": [{
        "rounded-t": P()
      }],
      /**
       * Border Radius Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-r": [{
        "rounded-r": P()
      }],
      /**
       * Border Radius Bottom
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-b": [{
        "rounded-b": P()
      }],
      /**
       * Border Radius Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-l": [{
        "rounded-l": P()
      }],
      /**
       * Border Radius Start Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ss": [{
        "rounded-ss": P()
      }],
      /**
       * Border Radius Start End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-se": [{
        "rounded-se": P()
      }],
      /**
       * Border Radius End End
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-ee": [{
        "rounded-ee": P()
      }],
      /**
       * Border Radius End Start
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-es": [{
        "rounded-es": P()
      }],
      /**
       * Border Radius Top Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tl": [{
        "rounded-tl": P()
      }],
      /**
       * Border Radius Top Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-tr": [{
        "rounded-tr": P()
      }],
      /**
       * Border Radius Bottom Right
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-br": [{
        "rounded-br": P()
      }],
      /**
       * Border Radius Bottom Left
       * @see https://tailwindcss.com/docs/border-radius
       */
      "rounded-bl": [{
        "rounded-bl": P()
      }],
      /**
       * Border Width
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w": [{
        border: lt()
      }],
      /**
       * Border Width Inline
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-x": [{
        "border-x": lt()
      }],
      /**
       * Border Width Block
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-y": [{
        "border-y": lt()
      }],
      /**
       * Border Width Inline Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-s": [{
        "border-s": lt()
      }],
      /**
       * Border Width Inline End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-e": [{
        "border-e": lt()
      }],
      /**
       * Border Width Block Start
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-bs": [{
        "border-bs": lt()
      }],
      /**
       * Border Width Block End
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-be": [{
        "border-be": lt()
      }],
      /**
       * Border Width Top
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-t": [{
        "border-t": lt()
      }],
      /**
       * Border Width Right
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-r": [{
        "border-r": lt()
      }],
      /**
       * Border Width Bottom
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-b": [{
        "border-b": lt()
      }],
      /**
       * Border Width Left
       * @see https://tailwindcss.com/docs/border-width
       */
      "border-w-l": [{
        "border-l": lt()
      }],
      /**
       * Divide Width X
       * @see https://tailwindcss.com/docs/border-width#between-children
       */
      "divide-x": [{
        "divide-x": lt()
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
        "divide-y": lt()
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
        border: [...xt(), "hidden", "none"]
      }],
      /**
       * Divide Style
       * @see https://tailwindcss.com/docs/border-style#setting-the-divider-style
       */
      "divide-style": [{
        divide: [...xt(), "hidden", "none"]
      }],
      /**
       * Border Color
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color": [{
        border: B()
      }],
      /**
       * Border Color Inline
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-x": [{
        "border-x": B()
      }],
      /**
       * Border Color Block
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-y": [{
        "border-y": B()
      }],
      /**
       * Border Color Inline Start
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-s": [{
        "border-s": B()
      }],
      /**
       * Border Color Inline End
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-e": [{
        "border-e": B()
      }],
      /**
       * Border Color Block Start
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-bs": [{
        "border-bs": B()
      }],
      /**
       * Border Color Block End
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-be": [{
        "border-be": B()
      }],
      /**
       * Border Color Top
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-t": [{
        "border-t": B()
      }],
      /**
       * Border Color Right
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-r": [{
        "border-r": B()
      }],
      /**
       * Border Color Bottom
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-b": [{
        "border-b": B()
      }],
      /**
       * Border Color Left
       * @see https://tailwindcss.com/docs/border-color
       */
      "border-color-l": [{
        "border-l": B()
      }],
      /**
       * Divide Color
       * @see https://tailwindcss.com/docs/divide-color
       */
      "divide-color": [{
        divide: B()
      }],
      /**
       * Outline Style
       * @see https://tailwindcss.com/docs/outline-style
       */
      "outline-style": [{
        outline: [...xt(), "none", "hidden"]
      }],
      /**
       * Outline Offset
       * @see https://tailwindcss.com/docs/outline-offset
       */
      "outline-offset": [{
        "outline-offset": [pt, F, W]
      }],
      /**
       * Outline Width
       * @see https://tailwindcss.com/docs/outline-width
       */
      "outline-w": [{
        outline: ["", pt, dl, $a]
      }],
      /**
       * Outline Color
       * @see https://tailwindcss.com/docs/outline-color
       */
      "outline-color": [{
        outline: B()
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
          M,
          xi,
          yi
        ]
      }],
      /**
       * Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-shadow-color
       */
      "shadow-color": [{
        shadow: B()
      }],
      /**
       * Inset Box Shadow
       * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-shadow
       */
      "inset-shadow": [{
        "inset-shadow": ["none", D, xi, yi]
      }],
      /**
       * Inset Box Shadow Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-shadow-color
       */
      "inset-shadow-color": [{
        "inset-shadow": B()
      }],
      /**
       * Ring Width
       * @see https://tailwindcss.com/docs/box-shadow#adding-a-ring
       */
      "ring-w": [{
        ring: lt()
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
        ring: B()
      }],
      /**
       * Ring Offset Width
       * @see https://v3.tailwindcss.com/docs/ring-offset-width
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-w": [{
        "ring-offset": [pt, $a]
      }],
      /**
       * Ring Offset Color
       * @see https://v3.tailwindcss.com/docs/ring-offset-color
       * @deprecated since Tailwind CSS v4.0.0
       * @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
       */
      "ring-offset-color": [{
        "ring-offset": B()
      }],
      /**
       * Inset Ring Width
       * @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-ring
       */
      "inset-ring-w": [{
        "inset-ring": lt()
      }],
      /**
       * Inset Ring Color
       * @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-ring-color
       */
      "inset-ring-color": [{
        "inset-ring": B()
      }],
      /**
       * Text Shadow
       * @see https://tailwindcss.com/docs/text-shadow
       */
      "text-shadow": [{
        "text-shadow": ["none", k, xi, yi]
      }],
      /**
       * Text Shadow Color
       * @see https://tailwindcss.com/docs/text-shadow#setting-the-shadow-color
       */
      "text-shadow-color": [{
        "text-shadow": B()
      }],
      /**
       * Opacity
       * @see https://tailwindcss.com/docs/opacity
       */
      opacity: [{
        opacity: [pt, F, W]
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
        "mask-linear": [pt]
      }],
      "mask-image-linear-from-pos": [{
        "mask-linear-from": ut()
      }],
      "mask-image-linear-to-pos": [{
        "mask-linear-to": ut()
      }],
      "mask-image-linear-from-color": [{
        "mask-linear-from": B()
      }],
      "mask-image-linear-to-color": [{
        "mask-linear-to": B()
      }],
      "mask-image-t-from-pos": [{
        "mask-t-from": ut()
      }],
      "mask-image-t-to-pos": [{
        "mask-t-to": ut()
      }],
      "mask-image-t-from-color": [{
        "mask-t-from": B()
      }],
      "mask-image-t-to-color": [{
        "mask-t-to": B()
      }],
      "mask-image-r-from-pos": [{
        "mask-r-from": ut()
      }],
      "mask-image-r-to-pos": [{
        "mask-r-to": ut()
      }],
      "mask-image-r-from-color": [{
        "mask-r-from": B()
      }],
      "mask-image-r-to-color": [{
        "mask-r-to": B()
      }],
      "mask-image-b-from-pos": [{
        "mask-b-from": ut()
      }],
      "mask-image-b-to-pos": [{
        "mask-b-to": ut()
      }],
      "mask-image-b-from-color": [{
        "mask-b-from": B()
      }],
      "mask-image-b-to-color": [{
        "mask-b-to": B()
      }],
      "mask-image-l-from-pos": [{
        "mask-l-from": ut()
      }],
      "mask-image-l-to-pos": [{
        "mask-l-to": ut()
      }],
      "mask-image-l-from-color": [{
        "mask-l-from": B()
      }],
      "mask-image-l-to-color": [{
        "mask-l-to": B()
      }],
      "mask-image-x-from-pos": [{
        "mask-x-from": ut()
      }],
      "mask-image-x-to-pos": [{
        "mask-x-to": ut()
      }],
      "mask-image-x-from-color": [{
        "mask-x-from": B()
      }],
      "mask-image-x-to-color": [{
        "mask-x-to": B()
      }],
      "mask-image-y-from-pos": [{
        "mask-y-from": ut()
      }],
      "mask-image-y-to-pos": [{
        "mask-y-to": ut()
      }],
      "mask-image-y-from-color": [{
        "mask-y-from": B()
      }],
      "mask-image-y-to-color": [{
        "mask-y-to": B()
      }],
      "mask-image-radial": [{
        "mask-radial": [F, W]
      }],
      "mask-image-radial-from-pos": [{
        "mask-radial-from": ut()
      }],
      "mask-image-radial-to-pos": [{
        "mask-radial-to": ut()
      }],
      "mask-image-radial-from-color": [{
        "mask-radial-from": B()
      }],
      "mask-image-radial-to-color": [{
        "mask-radial-to": B()
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
        "mask-radial-at": A()
      }],
      "mask-image-conic-pos": [{
        "mask-conic": [pt]
      }],
      "mask-image-conic-from-pos": [{
        "mask-conic-from": ut()
      }],
      "mask-image-conic-to-pos": [{
        "mask-conic-to": ut()
      }],
      "mask-image-conic-from-color": [{
        "mask-conic-from": B()
      }],
      "mask-image-conic-to-color": [{
        "mask-conic-to": B()
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
        mask: v()
      }],
      /**
       * Mask Repeat
       * @see https://tailwindcss.com/docs/mask-repeat
       */
      "mask-repeat": [{
        mask: q()
      }],
      /**
       * Mask Size
       * @see https://tailwindcss.com/docs/mask-size
       */
      "mask-size": [{
        mask: tt()
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
        mask: ["none", F, W]
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
          F,
          W
        ]
      }],
      /**
       * Blur
       * @see https://tailwindcss.com/docs/blur
       */
      blur: [{
        blur: Oa()
      }],
      /**
       * Brightness
       * @see https://tailwindcss.com/docs/brightness
       */
      brightness: [{
        brightness: [pt, F, W]
      }],
      /**
       * Contrast
       * @see https://tailwindcss.com/docs/contrast
       */
      contrast: [{
        contrast: [pt, F, W]
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
          g,
          xi,
          yi
        ]
      }],
      /**
       * Drop Shadow Color
       * @see https://tailwindcss.com/docs/filter-drop-shadow#setting-the-shadow-color
       */
      "drop-shadow-color": [{
        "drop-shadow": B()
      }],
      /**
       * Grayscale
       * @see https://tailwindcss.com/docs/grayscale
       */
      grayscale: [{
        grayscale: ["", pt, F, W]
      }],
      /**
       * Hue Rotate
       * @see https://tailwindcss.com/docs/hue-rotate
       */
      "hue-rotate": [{
        "hue-rotate": [pt, F, W]
      }],
      /**
       * Invert
       * @see https://tailwindcss.com/docs/invert
       */
      invert: [{
        invert: ["", pt, F, W]
      }],
      /**
       * Saturate
       * @see https://tailwindcss.com/docs/saturate
       */
      saturate: [{
        saturate: [pt, F, W]
      }],
      /**
       * Sepia
       * @see https://tailwindcss.com/docs/sepia
       */
      sepia: [{
        sepia: ["", pt, F, W]
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
          F,
          W
        ]
      }],
      /**
       * Backdrop Blur
       * @see https://tailwindcss.com/docs/backdrop-blur
       */
      "backdrop-blur": [{
        "backdrop-blur": Oa()
      }],
      /**
       * Backdrop Brightness
       * @see https://tailwindcss.com/docs/backdrop-brightness
       */
      "backdrop-brightness": [{
        "backdrop-brightness": [pt, F, W]
      }],
      /**
       * Backdrop Contrast
       * @see https://tailwindcss.com/docs/backdrop-contrast
       */
      "backdrop-contrast": [{
        "backdrop-contrast": [pt, F, W]
      }],
      /**
       * Backdrop Grayscale
       * @see https://tailwindcss.com/docs/backdrop-grayscale
       */
      "backdrop-grayscale": [{
        "backdrop-grayscale": ["", pt, F, W]
      }],
      /**
       * Backdrop Hue Rotate
       * @see https://tailwindcss.com/docs/backdrop-hue-rotate
       */
      "backdrop-hue-rotate": [{
        "backdrop-hue-rotate": [pt, F, W]
      }],
      /**
       * Backdrop Invert
       * @see https://tailwindcss.com/docs/backdrop-invert
       */
      "backdrop-invert": [{
        "backdrop-invert": ["", pt, F, W]
      }],
      /**
       * Backdrop Opacity
       * @see https://tailwindcss.com/docs/backdrop-opacity
       */
      "backdrop-opacity": [{
        "backdrop-opacity": [pt, F, W]
      }],
      /**
       * Backdrop Saturate
       * @see https://tailwindcss.com/docs/backdrop-saturate
       */
      "backdrop-saturate": [{
        "backdrop-saturate": [pt, F, W]
      }],
      /**
       * Backdrop Sepia
       * @see https://tailwindcss.com/docs/backdrop-sepia
       */
      "backdrop-sepia": [{
        "backdrop-sepia": ["", pt, F, W]
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
        transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", F, W]
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
        duration: [pt, "initial", F, W]
      }],
      /**
       * Transition Timing Function
       * @see https://tailwindcss.com/docs/transition-timing-function
       */
      ease: [{
        ease: ["linear", "initial", Y, F, W]
      }],
      /**
       * Transition Delay
       * @see https://tailwindcss.com/docs/transition-delay
       */
      delay: [{
        delay: [pt, F, W]
      }],
      /**
       * Animation
       * @see https://tailwindcss.com/docs/animation
       */
      animate: [{
        animate: ["none", E, F, W]
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
        perspective: [_, F, W]
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
        rotate: Ra()
      }],
      /**
       * Rotate X
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-x": [{
        "rotate-x": Ra()
      }],
      /**
       * Rotate Y
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-y": [{
        "rotate-y": Ra()
      }],
      /**
       * Rotate Z
       * @see https://tailwindcss.com/docs/rotate
       */
      "rotate-z": [{
        "rotate-z": Ra()
      }],
      /**
       * Scale
       * @see https://tailwindcss.com/docs/scale
       */
      scale: [{
        scale: Ae()
      }],
      /**
       * Scale X
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-x": [{
        "scale-x": Ae()
      }],
      /**
       * Scale Y
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-y": [{
        "scale-y": Ae()
      }],
      /**
       * Scale Z
       * @see https://tailwindcss.com/docs/scale
       */
      "scale-z": [{
        "scale-z": Ae()
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
        skew: Oe()
      }],
      /**
       * Skew X
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-x": [{
        "skew-x": Oe()
      }],
      /**
       * Skew Y
       * @see https://tailwindcss.com/docs/skew
       */
      "skew-y": [{
        "skew-y": Oe()
      }],
      /**
       * Transform
       * @see https://tailwindcss.com/docs/transform
       */
      transform: [{
        transform: [F, W, "", "none", "gpu", "cpu"]
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
        translate: ua()
      }],
      /**
       * Translate X
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-x": [{
        "translate-x": ua()
      }],
      /**
       * Translate Y
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-y": [{
        "translate-y": ua()
      }],
      /**
       * Translate Z
       * @see https://tailwindcss.com/docs/translate
       */
      "translate-z": [{
        "translate-z": ua()
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
        zoom: [Ze, F, W]
      }],
      // ---------------------
      // --- Interactivity ---
      // ---------------------
      /**
       * Accent Color
       * @see https://tailwindcss.com/docs/accent-color
       */
      accent: [{
        accent: B()
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
        caret: B()
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
        cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", F, W]
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
        "scrollbar-thumb": B()
      }],
      /**
       * Scrollbar Track Color
       * @see https://tailwindcss.com/docs/scrollbar-color
       */
      "scrollbar-track-color": [{
        "scrollbar-track": B()
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
        "will-change": ["auto", "scroll", "contents", "transform", F, W]
      }],
      // -----------
      // --- SVG ---
      // -----------
      /**
       * Fill
       * @see https://tailwindcss.com/docs/fill
       */
      fill: [{
        fill: ["none", ...B()]
      }],
      /**
       * Stroke Width
       * @see https://tailwindcss.com/docs/stroke-width
       */
      "stroke-w": [{
        stroke: [pt, dl, $a, Ed]
      }],
      /**
       * Stroke
       * @see https://tailwindcss.com/docs/stroke
       */
      stroke: [{
        stroke: ["none", ...B()]
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
}, yg = /* @__PURE__ */ F0(vg);
function je(...n) {
  return yg(lm(n));
}
const ym = typeof navigator < "u" && /Mac/i.test(navigator.platform), Ci = {
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
for (let n = 1; n <= 12; n++) Ci[`f${n}`] = `F${n}`;
const xg = Object.fromEntries(Object.entries(Ci).map(([n, i]) => [i, n])), wg = {
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
function _g(n) {
  const i = /^Key([A-Z])$/.exec(n) ?? /^Digit(\d)$/.exec(n);
  return i ? i[1].toLowerCase() : xg[n];
}
const Cd = /* @__PURE__ */ new Map();
function xm(n, i = ym) {
  const o = `${i}|${n}`, c = Cd.get(o);
  if (c) return c;
  const s = { cmd: !1, ctrl: !1, shift: !1, alt: !1, code: "" };
  for (const d of n.split("+"))
    if (d === "mod")
      i ? s.cmd = !0 : (s.ctrl = !0, s.shift = !0);
    else if (d === "cmd" || d === "ctrl" || d === "shift" || d === "alt") s[d] = !0;
    else if (/^[a-z]$/.test(d))
      s.code = `Key${d.toUpperCase()}`, s.letter = d;
    else if (/^[0-9]$/.test(d)) s.code = `Digit${d}`;
    else if (Ci[d]) s.code = Ci[d];
    else throw new Error(`unknown key "${d}" in "${n}"`);
  if (!s.code) throw new Error(`no key in "${n}"`);
  return Cd.set(o, s), s;
}
new Set(["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"].map((n) => {
  const i = xm(n, !0);
  return [i.cmd && "cmd", i.ctrl && "ctrl", i.alt && "alt", i.shift && "shift", i.code].filter(Boolean).join("+");
}));
function Sg(n, i = ym) {
  const o = xm(n, i), c = zg(_g(o.code) ?? "");
  return i ? `${o.ctrl ? "⌃" : ""}${o.alt ? "⌥" : ""}${o.shift ? "⇧" : ""}${o.cmd ? "⌘" : ""}${c}` : [o.ctrl && "Ctrl", o.alt && "Alt", o.shift && "Shift", c].filter(Boolean).join("+");
}
const zg = (n) => wg[n] ?? n.toUpperCase(), jd = (n) => typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n, Md = lm, Ri = (n, i) => (o) => {
  var c;
  if (i?.variants == null) return Md(n, o?.class, o?.className);
  const { variants: s, defaultVariants: d } = i, p = Object.keys(s).map((w) => {
    const M = o?.[w], D = d?.[w];
    if (M === null) return null;
    const k = jd(M) || jd(D);
    return s[w][k];
  }), m = o && Object.entries(o).reduce((w, M) => {
    let [D, k] = M;
    return k === void 0 || (w[D] = k), w;
  }, {}), x = i == null || (c = i.compoundVariants) === null || c === void 0 ? void 0 : c.reduce((w, M) => {
    let { class: D, className: k, ...g } = M;
    return Object.entries(g).every((S) => {
      let [_, z] = S;
      return Array.isArray(z) ? z.includes({
        ...d,
        ...m
      }[_]) : {
        ...d,
        ...m
      }[_] === z;
    }) ? [
      ...w,
      D,
      k
    ] : w;
  }, []);
  return Md(n, p, x, o?.class, o?.className);
}, kg = Ri(
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
), Eg = Ri(
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
function Ng({ className: n, ...i } = {}) {
  return je(Eg(i), n);
}
const wm = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent", _m = "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40", Tg = Ri(`${_m} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
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
function Cg({ className: n, ...i } = {}) {
  return je(Tg(i), n);
}
const Sm = "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]", jg = Ri(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: !1 } }
), Mg = "my-1 h-px bg-overlay-0";
function Ag({ size: n = 14, className: i }) {
  return /* @__PURE__ */ zt.jsxs("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ zt.jsx("circle", { cx: "3.5", cy: "8", r: "1.1" }),
    /* @__PURE__ */ zt.jsx("circle", { cx: "8", cy: "8", r: "1.1" }),
    /* @__PURE__ */ zt.jsx("circle", { cx: "12.5", cy: "8", r: "1.1" })
  ] });
}
function Og({ size: n = 16, className: i }) {
  return /* @__PURE__ */ zt.jsxs("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ zt.jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
    /* @__PURE__ */ zt.jsx("circle", { cx: "8", cy: "8", r: "2" })
  ] });
}
function Rg({ size: n = 14, className: i }) {
  return /* @__PURE__ */ zt.jsx("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ zt.jsx("path", { d: "M3.5 3.5l9 9M12.5 3.5l-9 9" }) });
}
function zm({ size: n = 14, className: i }) {
  return /* @__PURE__ */ zt.jsx("svg", { className: i, width: n, height: n, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ zt.jsx("path", { d: "M8 2.5v11M2.5 8h11" }) });
}
const Ad = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0"
};
function Hg({ state: n, error: i }) {
  return /* @__PURE__ */ zt.jsx(
    "span",
    {
      className: je("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", Ad[n] ?? Ad.disabled),
      title: n === "error" && i ? i : n
    }
  );
}
function Dg({ title: n, onClose: i, children: o, testId: c }) {
  return Oi(
    /* @__PURE__ */ zt.jsx(
      "div",
      {
        className: "fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onMouseDown: (s) => {
          s.target === s.currentTarget && i();
        },
        onKeyDown: (s) => {
          s.key === "Escape" && i();
        },
        children: /* @__PURE__ */ zt.jsxs(
          "div",
          {
            className: "grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": n,
            "data-testid": c,
            children: [
              /* @__PURE__ */ zt.jsx("h2", { className: "m-0 text-[0.9rem] font-semibold text-fg", children: n }),
              o
            ]
          }
        )
      }
    ),
    document.body
  );
}
const wi = 4, ja = 8, Ug = "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40", Od = (n) => n.text ?? (typeof n.label == "string" ? n.label : n.value);
function Bg({ value: n, onChange: i, options: o, className: c, ariaLabel: s, testId: d, id: p, title: m, disabled: x, placeholder: w, freeText: M, onKeyDown: D }) {
  const k = ft.useId(), [g, S] = ft.useState(!1), [_, z] = ft.useState(-1), [Y, E] = ft.useState(!1), N = ft.useRef(null), A = ft.useRef(null), [H, C] = ft.useState({}), b = ft.useRef({ text: "", at: 0 }), h = M && Y && n ? o.filter((U) => Od(U).toLowerCase().includes(n.toLowerCase()) || U.value.toLowerCase().includes(n.toLowerCase())) : o, G = o.find((U) => U.value === n), J = (U) => `${k}-${U}`;
  function at(U) {
    x || (z(U), S(!0));
  }
  function ot() {
    S(!1), E(!1), z(-1);
  }
  function Mt(U) {
    !U || U.disabled || (i(U.value), ot());
  }
  function Kt(U, B) {
    for (let v = 1; v <= h.length; v++) {
      const q = (U + B * v + h.length * v) % h.length;
      if (!h[q].disabled) return q;
    }
    return U;
  }
  const Nt = () => h.findIndex((U) => !U.disabled), K = () => h.length - 1 - [...h].reverse().findIndex((U) => !U.disabled);
  ft.useLayoutEffect(() => {
    if (!g || !N.current) {
      C((tt) => tt.left === void 0 ? tt : {});
      return;
    }
    const U = N.current.getBoundingClientRect(), B = window.innerHeight - U.bottom - wi - ja, v = U.top - wi - ja, q = B < 160 && v > B;
    C({
      position: "fixed",
      left: Math.min(Math.max(ja, U.left), Math.max(ja, window.innerWidth - U.width - ja)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: U.width,
      maxWidth: window.innerWidth - 2 * ja,
      maxHeight: Math.min(q ? v : B, 320),
      ...q ? { bottom: window.innerHeight - U.top + wi } : { top: U.bottom + wi },
      overflowY: "auto"
    });
  }, [g, h.length]), ft.useLayoutEffect(() => {
    const U = A.current;
    if (!g || !U || H.left === void 0) return;
    const B = U.getBoundingClientRect().right, v = window.innerWidth - ja;
    B > v && C((q) => ({ ...q, left: Math.max(ja, Number(q.left) - (B - v)) }));
  }, [g, H]), ft.useEffect(() => {
    if (!g) return;
    const U = (B) => {
      const v = B.target;
      (v === document || v instanceof Node && N.current && v.contains(N.current)) && ot();
    };
    return window.addEventListener("resize", ot), window.addEventListener("scroll", U, !0), () => {
      window.removeEventListener("resize", ot), window.removeEventListener("scroll", U, !0);
    };
  }, [g]), ft.useEffect(() => {
    const U = g && _ >= 0 ? document.getElementById(J(_)) : null, B = A.current;
    !U || !B || (U.offsetTop < B.scrollTop ? B.scrollTop = U.offsetTop : U.offsetTop + U.offsetHeight > B.scrollTop + B.clientHeight && (B.scrollTop = U.offsetTop + U.offsetHeight - B.clientHeight));
  }, [g, _]), Em(g, (U) => {
    U || ot();
  }, N, A);
  function et(U) {
    if (U.nativeEvent.isComposing) return;
    const B = () => {
      U.preventDefault(), U.stopPropagation();
    }, { key: v } = U;
    if (g) {
      if (v === "Escape") {
        B(), ot();
        return;
      } else if (v === "Tab")
        ot();
      else if (v === "ArrowDown" || v === "ArrowUp") {
        B(), h.length && z(_ < 0 ? v === "ArrowDown" ? Nt() : K() : Kt(_, v === "ArrowDown" ? 1 : -1));
        return;
      } else if (v === "Home" && !M) {
        B(), z(Nt());
        return;
      } else if (v === "End" && !M) {
        B(), z(K());
        return;
      } else if (v === "Enter" || v === " " && !M) {
        if (_ >= 0 && h[_]) {
          B(), Mt(h[_]);
          return;
        }
        if (!M) {
          B(), ot();
          return;
        }
      } else if (!M && v.length === 1 && !U.metaKey && !U.ctrlKey && !U.altKey) {
        const q = Date.now();
        b.current = { text: (q - b.current.at > 600 ? "" : b.current.text) + v.toLowerCase(), at: q };
        const tt = Math.max(_, 0), $ = [...h.slice(tt + (b.current.text.length === 1 ? 1 : 0)), ...h.slice(0, tt + 1)].find((P) => !P.disabled && Od(P).toLowerCase().startsWith(b.current.text));
        $ && (B(), z(h.indexOf($)));
        return;
      }
    } else if (v === "ArrowDown" || v === "ArrowUp" || !M && (v === "Enter" || v === " ")) {
      B(), at(Math.max(0, h.findIndex((q) => q.value === n)));
      return;
    }
    D?.(U);
  }
  const nt = {
    ref: (U) => {
      N.current = U;
    },
    id: p,
    title: m,
    disabled: x,
    "aria-label": s,
    "aria-expanded": g,
    "aria-controls": g ? k : void 0,
    "aria-activedescendant": g && _ >= 0 ? J(_) : void 0,
    "data-testid": d,
    onKeyDown: et
  };
  return /* @__PURE__ */ zt.jsxs(zt.Fragment, { children: [
    M ? /* @__PURE__ */ zt.jsx(
      "input",
      {
        ...nt,
        type: "text",
        role: "combobox",
        "aria-autocomplete": "list",
        autoComplete: "off",
        placeholder: w,
        className: c,
        value: n,
        onChange: (U) => {
          i(U.target.value), E(!0), g ? z(-1) : (z(-1), S(!0));
        },
        onBlur: () => ot()
      }
    ) : /* @__PURE__ */ zt.jsxs(
      "button",
      {
        ...nt,
        type: "button",
        role: "combobox",
        "aria-haspopup": "listbox",
        "data-value": n,
        className: je("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", c),
        onClick: () => g ? ot() : at(Math.max(0, h.findIndex((U) => U.value === n))),
        children: [
          /* @__PURE__ */ zt.jsx("span", { className: "min-w-0 flex-1 truncate", children: G ? G.label : w ?? "" }),
          /* @__PURE__ */ zt.jsx(km, { open: !0, className: "shrink-0 text-subtext-0" })
        ]
      }
    ),
    g && h.length > 0 && Oi(
      /* @__PURE__ */ zt.jsx(
        "div",
        {
          ref: A,
          id: k,
          role: "listbox",
          "aria-label": s,
          className: je("z-[9999]", Sm),
          style: H,
          onMouseDown: (U) => {
            U.preventDefault(), U.stopPropagation();
          },
          onClick: (U) => U.stopPropagation(),
          children: h.map((U, B) => /* @__PURE__ */ zt.jsxs(
            "div",
            {
              id: J(B),
              role: "option",
              "aria-selected": U.value === n,
              "aria-disabled": U.disabled || void 0,
              "data-value": U.value,
              className: je(Ug, B === _ && !U.disabled && "bg-surface-0"),
              onMouseEnter: () => {
                U.disabled || z(B);
              },
              onClick: () => Mt(U),
              children: [
                /* @__PURE__ */ zt.jsx("span", { className: "min-w-0 truncate", children: U.label }),
                U.value === n && /* @__PURE__ */ zt.jsx("span", { "aria-hidden": "true", className: "shrink-0 text-accent", children: "✓" })
              ]
            },
            U.value
          ))
        }
      ),
      document.body
    )
  ] });
}
const qg = "rounded-ui bg-surface-1 text-fg [font-family:inherit]", Yg = `${qg} px-2 py-[0.3rem] text-[0.8rem] max-[700px]:min-h-11 focus:[outline:1px_solid_var(--accent)]`;
function km({ open: n, size: i = 12, className: o }) {
  return /* @__PURE__ */ zt.jsx("svg", { className: o, width: i, height: i, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ zt.jsx("path", { d: n ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" }) });
}
function Gg(n) {
  return n.blocked && !n.stale ? "blocked" : n.status === "running" && !n.stale ? "working" : n.unseen ? "done" : "idle";
}
const qo = {
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
function Yo(n, i) {
  return !!n.parentSessionId && n.parentSessionId !== n.id && i.some((o) => o.id === n.parentSessionId);
}
function Qg(n) {
  const i = /* @__PURE__ */ new Map();
  for (const o of n)
    Yo(o, n) && i.set(o.parentSessionId, [...i.get(o.parentSessionId) ?? [], o]);
  return i.size ? n.filter((o) => !Yo(o, n)).flatMap((o) => [o, ...i.get(o.id) ?? []]) : n;
}
const _i = 6, Rd = 8;
function Kg(n, i = {}) {
  const { minWidth: o = 220, align: c = "right", minSpaceAbove: s = 100 } = i, d = n.getBoundingClientRect(), p = window.innerWidth, m = window.innerHeight, x = c === "right" ? { right: Math.max(0, p - d.right) } : { left: Math.max(0, d.left) }, w = d.top - _i - Rd, M = m - d.bottom - _i - Rd;
  return w >= s ? {
    position: "fixed",
    bottom: m - d.top + _i,
    ...x,
    minWidth: o,
    maxHeight: Math.min(w, m * 0.75),
    overflowY: "auto"
  } : {
    position: "fixed",
    top: d.bottom + _i,
    ...x,
    minWidth: o,
    maxHeight: Math.min(M, m * 0.75),
    overflowY: "auto"
  };
}
function Em(n, i, o, c) {
  ft.useEffect(() => {
    if (!n) return;
    function s(p) {
      const m = p.target, x = o.current?.contains(m) ?? !1, w = c.current?.contains(m) ?? !1;
      !x && !w && i(!1);
    }
    function d(p) {
      p.key === "Escape" && i(!1);
    }
    return document.addEventListener("mousedown", s), document.addEventListener("keydown", d), () => {
      document.removeEventListener("mousedown", s), document.removeEventListener("keydown", d);
    };
  }, [n]);
}
function Vg({ icon: n, fallback: i }) {
  const [o, c] = ft.useState(!1);
  return ft.useEffect(() => c(!1), [n]), !n || o ? /* @__PURE__ */ zt.jsx(zt.Fragment, { children: i }) : /* @__PURE__ */ zt.jsx("img", { src: n, alt: "", width: 14, height: 14, className: "size-[14px] rounded-[2px] object-contain", referrerPolicy: "no-referrer", onError: () => c(!0) });
}
//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
const Xg = "1.3.0";
let Si = null;
const Zg = (n) => {
  Si = n;
};
function Ct() {
  const n = (typeof Si == "function" ? Si() : Si) ?? globalThis.perch;
  if (!n) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return n;
}
const Jg = (n) => Ct().subscribe?.(n) ?? (() => {
}), Lg = Kg, Wg = globalThis.perch?.isMac !== !1, Fg = (n) => Sg(n, Ct().isMac !== !1), Ig = (n) => kg(n), $g = ({ className: n, ...i } = {}) => je(Ng(i), n), Pg = Cg, tb = (n) => jg(n), eb = Mg, ab = _m, nb = wm, lb = (n) => qo[n].color, ib = (n, i) => Ct().shortcutFor?.(n, i) ?? null, rb = (n) => Ct().shortcutLabel?.(n) ?? null, Hi = (n, i) => Ct().command(n, i ?? {}) !== !1, ob = (n, i, o) => Ct().startSession?.(n, i, o), sb = globalThis.perch?.pickFolder ? (n) => Ct().pickFolder(n) : null;
function fe(n) {
  const i = ft.useRef(n);
  return i.current = n, ft.useSyncExternalStore(Jg, () => i.current(Ct()));
}
const cb = (n = {}) => fe((i) => i.navigation({ showTerminals: !!n.showTerminals, sortByAttention: !!n.sortByAttention })), ub = () => fe((n) => n.hosts()), db = () => fe((n) => n.sessionFolders());
function mb() {
  const n = fe((i) => i.addProject?.() ?? fb);
  return {
    status: n.status ?? "idle",
    error: n.error,
    hostId: n.hostId,
    add: (i, o, c) => {
      i.trim() && n.status !== "pending" && Ct().addProjectFolder?.(i, o, c);
    },
    clear: () => Ct().clearAddProject?.()
  };
}
const fb = Object.freeze({ status: "idle" }), Nm = "perch.lastAgentChoice", pb = Object.freeze({ connected: !1, discovery: !1, state: "ready", choices: [] }), hb = () => {
  const n = Ct().storage?.getItem(Nm);
  return n === "claude" || n === "codex" ? n : "claude";
}, gb = Object.freeze({ items: [] });
function bb() {
  const n = fe((i) => i.notifications?.() ?? gb);
  return ft.useMemo(() => ({
    items: n.items ?? [],
    open: (i) => Ct().command("notification.open", { id: i }),
    dismiss: (i) => Ct().command("notification.dismiss", { id: i })
  }), [n]);
}
function vb(n) {
  const i = fe((s) => s.agentChoices?.(n) ?? pb), [o, c] = ft.useState(hb);
  return ft.useMemo(() => ({
    connected: !!i.connected,
    discovery: !!i.discovery,
    choices: i.choices ?? [],
    lastChoice: o,
    state: i.state ?? "ready",
    error: i.state === "error" ? i.error : void 0,
    rememberChoice: (s) => {
      s !== "claude" && s !== "codex" || (Ct().storage?.setItem(Nm, s), c(s));
    },
    manage: () => Ct().command("agents.manage", {})
  }), [i, o]);
}
function yb(n) {
  ft.useEffect(() => Ct().onRequest?.("add-project", n) ?? void 0, [n]);
}
function xb(n) {
  const i = n.map((o) => ({ id: o.id, parentSessionId: o.parentId, session: o }));
  return Qg(i).map((o) => ({ session: o.session, nested: Yo(o, i) }));
}
function wb({ id: n, plain: i, className: o }) {
  const c = fe((w) => w.session(n));
  if (!c) return null;
  const s = c.state ?? Gg(c), d = qo[s]?.color ?? qo.unknown.color, p = c.provider, m = p === "claude" || p === "claude-agent-teams" || p === "omp", x = i ? je("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", o) : je("agent-status-dot", `agent-status-dot--${s}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", o);
  return ft.createElement(
    "span",
    { className: x, style: i ? void 0 : { borderColor: d }, "data-provider": p ?? "unknown", title: i ? p ?? "Agent" : `${p ?? "Agent"} · ${s}`, "aria-hidden": "true" },
    ft.createElement("span", { className: je("inline-flex text-fg", m && "rounded-full bg-[#161616]") }, ft.createElement(Tm, { provider: p, size: 14 }))
  );
}
function Tm({ provider: n, size: i = 14 }) {
  const o = Ct().agentIcon?.(n, i) ?? null, c = o?.markup ?? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>';
  return ft.createElement("svg", { width: i, height: i, "aria-hidden": "true", "data-agent-icon": n ?? "unknown", "data-perch-markup": c, ...o && o.tint === !1 ? { "data-perch-image": "true" } : {} });
}
const _b = ({ children: n }) => ft.createElement(ft.Fragment, null, n);
function Sb(n, i) {
  const o = ft.useRef(i);
  return o.current = i, ft.useEffect(() => {
    const c = Ct();
    if (!c.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${n} cannot open`);
    const s = {};
    for (const [p, m] of Object.entries(o.current))
      s[p] = typeof m == "function" ? (...x) => o.current[p]?.(...x) : m;
    const d = c.openOverlay(n, s);
    return () => c.closeOverlay?.(d);
  }, [n]), null;
}
const an = (n) => function(o) {
  return Sb(n, o);
}, zb = an("session-menu"), kb = an("new-session-menu"), Eb = an("confirm");
let Cm = null;
const Nb = (n) => {
  Cm = n;
};
function Tb(n) {
  return ft.createElement(Cm ?? Eb, n);
}
function Cb({ className: n = Yg, ...i }) {
  return ft.createElement(Bg, { ...i, className: n });
}
let Go = null;
const jb = (n) => {
  Go = n;
}, Mb = an("folder-browser");
function Ab(n) {
  return Go ? ft.createElement(Go, { ...n, browse: (i) => Ct().browse(n.hostId, i) }) : ft.createElement(Mb, n);
}
const Ob = an("instructions"), Rb = an("memory"), Hb = Dg;
function Db({ hostId: n, path: i, className: o }) {
  const c = ft.useRef(null);
  return ft.createElement(
    "button",
    {
      type: "button",
      ref: c,
      className: je("worktree-menu__btn", wm, o),
      "data-testid": `worktree-menu-${n}-${i}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": !1,
      onClick: () => Ct().openOverlay?.("worktree", { hostId: n, cwd: i, anchor: c.current?.getBoundingClientRect() })
    },
    ft.createElement(zm, null)
  );
}
const Ub = (n, i) => Ct().beginReorderDrag?.(n, i), Bb = () => fe((n) => n.workspaceTabs()), qb = () => fe((n) => n.statusLine()), Yb = () => fe((n) => n.zoom()), Gb = () => fe((n) => n.paneLook()), Qb = () => fe((n) => n.keybindings?.() ?? []), Kb = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
function Vb(n) {
  const i = !!n?.keepFresh, o = fe((s) => s.statusLine?.().connected ?? !1), c = fe((s) => s.planUsage?.() ?? Kb);
  return ft.useEffect(() => {
    if (!i || !o) return;
    let s;
    const d = () => {
      Ct().command("usage.get"), s = setTimeout(d, 18e4);
    };
    return d(), () => clearTimeout(s);
  }, [i, o]), c;
}
const Xb = () => Ct().command("usage.get", { force: !0 }), Zb = (n) => Ct().command("usage.redeemReset", { accountId: n }), Jb = () => Hi("app.zoom_reset"), Lb = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg"
}, Wb = (n, i, o) => Ct().beginTabDrag?.(n, i, o);
function Fb(n) {
  ft.useEffect(() => Ct().onRequest?.("new-tab", n) ?? void 0, [n]);
}
const Ib = (n) => Hi("browser.open", { workspaceId: n }), $b = (n, i) => Hi("file.open", { workspaceId: n, path: i }), Pb = () => null, tv = () => null, ev = an("new-file"), gv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AgentIcon: Tm,
  Chevron: km,
  CloseIcon: Rg,
  ConfirmDialog: Tb,
  Dialog: Hb,
  EllipsisIcon: Ag,
  FolderBrowser: Ab,
  GearIcon: Og,
  HostStateDot: Hg,
  InstructionsDialog: Ob,
  MemoryDialog: Rb,
  NewFilePrompt: ev,
  NewSessionMenu: kb,
  PageIcon: Vg,
  PlusIcon: zm,
  Select: Cb,
  SessionDot: wb,
  SessionMenu: zb,
  Slot: _b,
  TabDragLayer: tv,
  TabMenu: Pb,
  WorktreeMenu: Db,
  agentStateColor: lb,
  anchoredPopoverStyle: Lg,
  beginReorderDrag: Ub,
  beginTabDrag: Wb,
  bindHost: Zg,
  buttonClass: Pg,
  cn: je,
  drawConfirmationsInPlace: Nb,
  drawFolderBrowserInPlace: jb,
  ghostButton: ab,
  iconButton: nb,
  isMac: Wg,
  keyLabel: Fg,
  menuDividerClass: eb,
  menuItemClass: tb,
  menuPanel: Sm,
  nestSessions: xb,
  openBrowserTab: Ib,
  openFileTab: $b,
  pickFolder: sb,
  redeemUsageReset: Zb,
  refreshUsage: Xb,
  resetZoom: Jb,
  rowActionClass: $g,
  runCommand: Hi,
  segmentClass: Ig,
  shortcutFor: ib,
  shortcutLabel: rb,
  startSession: ob,
  tabStateClass: Lb,
  useAddProject: mb,
  useAddProjectRequest: yb,
  useAgentChoices: vb,
  useDismissOnOutsideClick: Em,
  useHosts: ub,
  useKeybindings: Qb,
  useNavigation: cb,
  useNewTabRequest: Fb,
  useNotifications: bb,
  usePaneLook: Gb,
  usePlanUsage: Vb,
  useSessionFolders: db,
  useStatusLine: qb,
  useWorkspaceTabs: Bb,
  useZoom: Yb,
  version: Xg
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
const Io = {
  display: (n, i) => i === "hidden" ? n.hidden() : i === "flex" ? n.flex() : n.block(),
  flex_direction: (n, i) => n[{ row: "flex_row", col: "flex_col", row_reverse: "flex_row_reverse", col_reverse: "flex_col_reverse" }[i]](),
  flex_wrap: (n, i) => i === "wrap" ? n.flex_wrap() : n.flex_nowrap(),
  items: (n, i) => n[`items_${i}`](),
  justify: (n, i) => n[`justify_${i}`](),
  self: (n, i) => i === "auto" ? n : n[`self_${i}`](),
  flex_grow: (n, i) => n.flex_grow(i),
  flex_shrink: (n, i) => n.flex_shrink(i),
  flex_basis: (n, i) => n.flex_basis(i),
  position: (n, i) => i === "absolute" ? n.absolute() : n.relative(),
  overflow_x: (n, i) => i === "hidden" ? n.overflow_x_hidden() : i === "scroll" ? n.overflow_x_scroll() : n,
  overflow_y: (n, i) => i === "hidden" ? n.overflow_y_hidden() : i === "scroll" ? n.overflow_y_scroll() : n,
  visibility: (n, i) => i === "invisible" ? n.invisible() : n.visible(),
  bg: (n, i) => n.bg(i),
  opacity: (n, i) => n.opacity(i),
  shadow: (n, i) => i === "none" ? n.shadow_none() : n[`shadow_${i}`](),
  cursor: (n, i) => n[`cursor_${i}`](),
  border_color: (n, i) => n.border_color(i),
  text_ellipsis: (n, i) => i ? n.text_ellipsis() : n,
  underline: (n, i) => i ? n.underline() : n,
  text_color: (n, i) => n.text_color(i),
  text_size: (n, i) => n.text_size(i),
  font_weight: (n, i) => n.font_weight(i),
  font_family: (n, i) => n.font_family(i),
  font_features: (n, i) => n.font_features(i),
  line_height: (n, i) => n.line_height(i),
  italic: (n, i) => i ? n.italic() : n.not_italic(),
  whitespace: (n, i) => i === "nowrap" ? n.whitespace_nowrap() : n.whitespace_normal(),
  text_align: (n, i) => n[`text_${i}`](),
  rounded: (n, i) => n.rounded(i)
};
for (const n of ["w", "h", "min_w", "min_h", "max_w", "max_h", "top", "right", "bottom", "left", "pt", "pr", "pb", "pl", "mt", "mr", "mb", "ml", "gap_x", "gap_y", "border_t", "border_r", "border_b", "border_l", "rounded_tl", "rounded_tr", "rounded_br", "rounded_bl"])
  Io[n] = (i, o) => i[n](o);
const bv = Object.keys(Io);
function Hd(n, i) {
  for (const [o, c] of Object.entries(i)) {
    const s = Io[o];
    if (!s) throw new Error(`the description key ${o} has no GPUI builder`);
    c != null && (n = s(n, c));
  }
  return n;
}
const Ma = (n) => ({ clientX: n?.position?.x ?? 0, clientY: n?.position?.y ?? 0 }), Dd = /* @__PURE__ */ new WeakSet();
function Ud(n, i, o) {
  const c = n.pressed, s = Ma(o);
  return c && c.x === s.clientX && c.y === s.clientY ? c.id : i;
}
function av(n, i, o) {
  if (n.name) return n.name;
  if (!(i.size || n.hover || n.focus || n.active || n.track_hover || o)) return null;
  const c = n.meta?.attrs["data-testid"];
  return c ? `~${n.id}:${c}` : `~${n.id}`;
}
const Me = (n) => n.style?.display !== "hidden";
function Qo(n, i, o, c, s = !1, d = !1, p = null, m = {}, x = !1, w = /* @__PURE__ */ new Map()) {
  if (n.kind === "text") return w.get(n)?.text ?? n.text;
  const M = Dd.has(n);
  d ||= n.style.opacity === 0 || n.style.visibility === "invisible", d && (n.name || n.range_name) && (n = { ...n, name: void 0, range_name: void 0 }), p = n.style.text_color ?? p;
  const D = !!n.hover?.text_color && Om(n);
  D && o.hovered?.(n.id) && (p = n.hover.text_color), m = { ...m };
  for (const C of ["text_size", "line_height", "whitespace", "text_ellipsis"]) n.style[C] !== void 0 && (m[C] = n.style[C]);
  const k = new Set(n.events ?? []);
  let g;
  n.kind === "image" && !n.markup ? g = i.image(n.src) : g = i.div(), n.markup && (g = g.child(c.icon(`~icon-${n.id}`, n.markup, n.kind === "svg" ? p : "")));
  const S = av(n, k, s);
  S && (g = g.id(S)), g = Hd(g, { ...n.style, ...w.get(n) });
  const _ = m.whitespace !== "nowrap" && !m.text_ellipsis;
  x && _ && n.style.flex_shrink !== 0 && n.style.min_w === void 0 && (n.children ?? []).some((C) => C.kind === "text") && (g = g.min_w(0));
  for (const C of ["hover", "focus", "active"]) n[C] && (g = g[C]((b) => Hd(b, n[C])));
  if (i.scroll && (n.style.overflow_x === "scroll" || n.style.overflow_y === "scroll")) {
    const C = o.document?.scrollTarget, b = C ? (n.children ?? []).filter(Me).findIndex((h) => Am(h, C.id)) : -1;
    if (b >= 0 && (o.scroller ?? n.id) === n.id && (o.document.scrollTarget = null, o.scroller = n.id, i.scroll.scroll_to_item(b)), o.scroller ??= n.id, o.scroller === n.id && o.document) {
      g = g.track_scroll(i.scroll);
      const h = (n.children ?? []).filter(Me).map((G) => G.id);
      o.document.itemBounds = (G) => h.includes(G) ? i.scroll.item_bounds?.(h.indexOf(G)) ?? null : null;
    }
  }
  n.kind === "input" && !n.disabled && (g = g.on_mouse_down("left", (C, b) => {
    C.bounds && o.setBounds(n.id, C.bounds), o.focus(n.id), b.notify();
  }));
  const z = n.kind === "input" ? n : n.meta?.tag === "label" ? Mm(n) : null;
  z && !z.disabled && /^(checkbox|radio)$/.test(z.input_type) && (g = g.on_click((C, b) => {
    b.stop_propagation?.(), o.toggle(z.id), b.notify();
  }));
  const Y = ["click", "double_click", "context_menu", "mouse_down", "mouse_up"].some((C) => k.has(C));
  if (Y || M) for (const C of n.children ?? []) C.kind !== "text" && Dd.add(C);
  if (Y && (g = g.on_mouse_down("left", (C, b) => {
    b.stop_propagation?.(), C.bounds && o.setBounds(n.id, C.bounds);
    const h = { ...Ma(C), button: 0, buttons: 1, detail: C.click_count }, G = Ud(o, n.id, C);
    o.pressed = null, o.dispatch(G, "pointerdown", { ...h, pointerType: "mouse" }), o.dispatch(G, "mousedown", h) && o.pressFocus?.(G), b.notify();
  }), g = g.on_mouse_down("right", (C, b) => {
    b.stop_propagation?.(), C.bounds && o.setBounds(n.id, C.bounds);
    const h = Ud(o, n.id, C);
    o.pressed = null, o.dispatch(h, "contextmenu", { ...Ma(C), button: 2 }), b.notify();
  }), g = g.on_mouse_up("left", (C, b) => {
    b.stop_propagation?.();
    const h = { ...Ma(C), button: 0 };
    o.dispatch(n.id, "pointerup", { ...h, pointerType: "mouse" }), o.dispatch(n.id, "mouseup", h), b.notify();
  }), g = g.on_click((C, b) => {
    o.dispatch(n.id, C.click_count === 2 && k.has("double_click") ? "dblclick" : "click", { detail: C.click_count, button: 0 }), b.notify();
  })), n.blocks_pointer && !Y)
    for (const C of ["left", "right"]) g = g.on_mouse_down(C, (b, h) => h.stop_propagation?.());
  else if (M && !Y)
    for (const C of ["left", "right"])
      g = g.on_mouse_down(C, (b) => {
        const h = Ma(b);
        (o.pressed?.x !== h.clientX || o.pressed?.y !== h.clientY) && (o.pressed = { id: n.id, x: h.clientX, y: h.clientY });
      });
  if (k.has("mouse_move") && (g = g.on_mouse_move((C, b) => {
    o.dispatch(n.id, "pointermove", { ...Ma(C), pointerType: "mouse" }), b.notify();
  })), (n.track_hover || D) && (g = g.on_hover((C, b) => {
    o.hover(n.id, C), b.notify();
  })), s && (g = g.on_mouse_down_out((C, b) => {
    o.dispatch(o.document.body.id, "pointerdown", { ...Ma(C), pointerType: "mouse" }), o.dispatch(o.document.body.id, "mousedown", Ma(C)), b.notify();
  })), n.kind === "input" && !/^(checkbox|radio|range|color|file|select)$/.test(n.input_type)) {
    const C = n.value ? String(n.value) : String(n.placeholder ?? "");
    let b = i.div().whitespace_nowrap().overflow_x_hidden();
    const h = tn(m);
    h && (b = b.h(h)), !n.value && p && (b = b.text_color(lv(p))), C && (g = g.child(b.child(n.input_type === "password" && n.value ? "•".repeat([...C].length) : C))), n.field_w && (g = g.child(i.div().w(n.field_w).h(0)));
  }
  const E = m.whitespace === "nowrap" ? tn(m) : null, N = n.style.display === "flex" && !String(n.style.flex_direction ?? "row").startsWith("col");
  let A = !n.range_name;
  const H = n.style.display === "flex" && String(n.style.flex_direction ?? "row").startsWith("col") && (n.style.h === void 0 || n.style.h === "auto") && typeof n.style.max_h == "number";
  for (const C of (n.children ?? []).filter(Me)) {
    const b = C.style?.flex_basis;
    H && C.style.flex_grow > 0 && (b === 0 || typeof b == "string" && b.endsWith("%")) && w.set(C, { ...w.get(C), flex_basis: "auto" });
    let h = Qo(C, i, o, c, !1, d, p, m, N && C.style?.position !== "absolute", w);
    const G = !A && (C.kind === "text" || !C.meta), J = C.kind === "text" ? w.get(C)?.h ?? E : null, at = C.kind === "text" ? w.get(C)?.w : void 0;
    if (G || J || at !== void 0) {
      let ot = i.div();
      G && (ot = ot.id(n.range_name)), G && !N && n.style.display === "flex" && (ot = ot[`self_${nv[m.text_align] ?? "start"}`]().max_w("100%")), J && (ot = ot.h(J)), at !== void 0 && (ot = ot.w(at).flex_none().whitespace_nowrap()), h = ot.child(h), A ||= G;
    }
    g = g.child(h);
  }
  return g;
}
const nv = { center: "center", right: "end", end: "end" };
function lv(n) {
  const i = String(n);
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(i)) return n;
  const o = i.length === 9 ? Number.parseInt(i.slice(7), 16) : 255;
  return `${i.slice(0, 7)}${Math.round(o / 2).toString(16).padStart(2, "0")}`;
}
const jm = /^(?:[!-,.-~]+|\S)$/u, Mm = (n) => {
  for (const i of n.children ?? []) {
    if (i.kind === "input" && /^(checkbox|radio)$/.test(i.input_type)) return i;
    const o = i.kind === "text" ? null : Mm(i);
    if (o) return o;
  }
  return null;
}, Am = (n, i) => n.id === i || (n.children ?? []).some((o) => o.kind !== "text" && Am(o, i)), Om = (n) => !!n.markup || (n.children ?? []).some((i) => i.kind !== "text" && Om(i));
function tn(n) {
  const i = n.line_height;
  return typeof i == "string" && i.endsWith("px") ? Number.parseFloat(i) : typeof i == "number" && typeof n.text_size == "number" ? i * n.text_size : null;
}
function vv(n, i, o, c, s = 0, d = !1) {
  const p = [n.root, ...n.overlays], m = s > 0 ? dv(p, s) : /* @__PURE__ */ new Map();
  s > 0 && c.measure && iv(p, s, c.measure, m), cv(p, m), sv(p, m), c.measure && ov(p, c.measure, m);
  let x = i.div().relative().size_full().child(Qo(n.root, i, o, c, !1, !1, null, {}, !1, m)), w = d && n.overlays.length ? i.div().relative().size_full().window_layer() : x;
  for (const M of n.overlays) w = w.child(Qo(M, i, o, c, !0, !1, null, {}, !1, m));
  return w === x ? x : x.child(w);
}
function iv(n, i, o, c) {
  const s = (S, _) => c.set(S, { ...c.get(S), ..._ }), d = /* @__PURE__ */ new Map(), p = /* @__PURE__ */ new Map(), m = ["text_size", "font_weight", "font_family", "italic", "whitespace", "text_ellipsis"];
  function x(S, _, z) {
    if (S.kind === "text") {
      if (!(_.whitespace === "nowrap" || jm.test(S.text)) || _.text_ellipsis || z || typeof _.text_size != "number") return NaN;
      const b = o(S.text, { size: _.text_size, weight: _.font_weight ?? 400, family: _.font_family ?? ".SystemUIFont", italic: !!_.italic });
      return Number.isFinite(b) ? b : NaN;
    }
    if (!Me(S) || S.kind === "input" || S.markup) return w(S);
    const Y = { ..._ };
    for (const C of m) S.style[C] !== void 0 && (Y[C] = S.style[C]);
    p.set(S, Y);
    const E = S.style, N = (S.children ?? []).filter(Je), A = N.map((C) => x(C, Y, z || !!S.tabular));
    let H = w(S);
    if (!Number.isFinite(H) && E.w === void 0) {
      const C = N.map((h, G) => A[G] + (h.kind === "text" ? 0 : I(h.style.ml) + I(h.style.mr)));
      let b;
      N.length ? Ye(S) ? b = N.some((h) => h.kind !== "text" && h.style.flex_grow > 0) || E.flex_wrap === "wrap" ? NaN : C.reduce((h, G) => h + G, 0) + I(E.gap_x) * (N.length - 1) : b = Math.max(...C) : b = 0, H = b + I(E.pl) + I(E.pr) + I(E.border_l) + I(E.border_r), typeof E.min_w == "number" && (H = Math.max(H, E.min_w)), typeof E.max_w == "number" && (H = Math.min(H, E.max_w));
    }
    return d.set(S, H), H;
  }
  const w = (S) => typeof S.style?.w == "number" ? S.style.w : NaN, M = () => ({ exact: 0, laid: 0 }), D = (S, _) => {
    if (!Number.isFinite(_))
      return Object.assign(S, M()), NaN;
    S.exact += _;
    const z = Math.round(S.exact * i + 1e-9) / i, Y = z - S.laid;
    return S.laid = z, Y;
  }, k = (S) => Ye(S) && S.style.flex_wrap !== "wrap" && (S.style.justify ?? "start") === "start";
  function g(S) {
    if (!S || S.kind === "text" || !Me(S)) return;
    const _ = (S.children ?? []).filter(Je);
    if (k(S) && _.length > 1) {
      const z = I(S.style.gap_x), Y = M(), E = !(z && _.some((N) => N.kind === "text"));
      s(S, { border_l: D(Y, I(S.style.border_l)), pl: D(Y, I(S.style.pl)) }), E && z && s(S, { gap_x: 0 }), _.forEach((N, A) => {
        const H = (A && E ? z : 0) + (N.kind === "text" ? 0 : I(N.style.ml));
        if (N.kind === "text")
          H && Object.assign(Y, M());
        else {
          const G = D(Y, H);
          Number.isFinite(G) && s(N, { ml: G });
        }
        const C = N.kind === "text" ? p.get(S) ?? {} : null, b = N.kind === "text" ? x(N, C, !!S.tabular) : d.get(N);
        if ((N.kind === "text" || !(N.style.flex_grow > 0)) && Number.isFinite(b) ? s(N, { w: D(Y, b) }) : Object.assign(Y, M()), N.kind !== "text") {
          const G = D(Y, I(N.style.mr));
          Number.isFinite(G) && s(N, { mr: G });
        }
      });
    }
    for (const z of S.children ?? []) z.kind !== "text" && g(z);
  }
  for (const S of n)
    S && (x(S, {}, !1), g(S));
}
const rv = /(?<= +)(?=[^ ])|(?<=[\p{L}\p{N}]-)(?=[\p{L}\p{N}])/u;
function ov(n, i, o) {
  const c = ["text_size", "font_weight", "font_family", "italic", "line_height"], s = (m) => typeof m == "number" ? m : 0, d = (m, x) => x && ji(x) && !Ye(x) && m.style.position !== "absolute" && !["start", "center", "end"].includes(m.style.self) && !["start", "center", "end"].includes(x.style.items), p = (m, x, w, M) => {
    if (!m || m.kind === "text" || !Me(m)) return;
    const D = m.style;
    let k = typeof D.w == "number" ? D.w : D.w === "100%" ? w : d(m, x) ? w - s(D.ml) - s(D.mr) : NaN;
    typeof D.max_w == "number" && (k = Math.min(k, D.max_w));
    const g = k - s(D.pl) - s(D.pr) - s(D.border_l) - s(D.border_r), S = { ...M };
    for (const z of c) D[z] !== void 0 && (S[z] = D[z]);
    const _ = m.children ?? [];
    if (m.break_anywhere && Number.isFinite(g) && g > 0 && typeof S.text_size == "number" && _.length && _.every((z) => z.kind === "text")) {
      const z = { size: S.text_size, weight: S.font_weight ?? 400, family: S.font_family ?? ".SystemUIFont", italic: !!S.italic }, Y = (A) => i(A.trimEnd(), z) <= g + 0.01;
      let E = 0;
      for (const A of _) {
        const H = [];
        for (const b of A.text.split(`
`)) {
          let h = "";
          for (const G of b.split(rv)) {
            if (Y(h + G)) {
              h += G;
              continue;
            }
            h && H.push(h.trimEnd()), h = "";
            for (const J of G)
              h && !Y(h + J) && (H.push(h), h = ""), h += J;
          }
          H.push(h.trimEnd());
        }
        const C = H.join(`
`);
        H.every((b) => !b || Y(b)) ? C !== A.text && o.set(A, { ...o.get(A), text: C }) : E = NaN, E += H.length;
      }
      const N = tn(S);
      Number.isFinite(E) && N && D.h === void 0 && _.length === 1 && o.set(m, { ...o.get(m), h: E * N + s(D.pt) + s(D.pb) + s(D.border_t) + s(D.border_b) });
    }
    for (const z of _) p(z, m, Ye(m) ? NaN : g, S);
  };
  for (const m of n) p(m, null, NaN, {});
}
function sv(n, i) {
  const o = (c, s) => {
    if (!c || c.kind === "text" || !Me(c)) return;
    const d = c.style, p = d.position === "absolute" ? d.w === void 0 && (d.left === void 0 || d.right === void 0) : s && typeof d.w != "number";
    if (p && Ye(c))
      for (const m of c.children ?? []) {
        const x = m.kind === "text" ? void 0 : m.style.flex_basis;
        m.kind !== "text" && m.style.flex_grow > 0 && (x === 0 || typeof x == "string" && x.endsWith("%")) && i.set(m, { ...i.get(m), flex_basis: "auto" });
      }
    for (const m of c.children ?? []) o(m, p);
  };
  for (const c of n) o(c, !1);
}
function cv(n, i) {
  const o = i.heights ?? /* @__PURE__ */ new Map(), c = (m) => o.get(m), s = (m) => {
    const x = m.style, w = (m.children ?? []).filter(Je);
    if (!w.length || Ye(m)) return NaN;
    let M = 0;
    for (const D of w) {
      const k = c(D);
      if (!Number.isFinite(k)) return NaN;
      M += k + (D.kind === "text" ? 0 : I(D.style.mt) + I(D.style.mb));
    }
    return M + (x.display === "flex" ? I(x.gap_y) * (w.length - 1) : 0) + I(x.pt) + I(x.pb);
  }, d = (m, x) => {
    const w = m.style;
    if (typeof w.h == "number") return w.h;
    if (typeof w.max_h == "number") return w.max_h;
    if (!x || !ji(x) || Ye(x)) return NaN;
    const M = x.style, D = typeof M.h == "number" ? M.h : typeof M.max_h == "number" ? M.max_h : NaN, k = (x.children ?? []).filter(Je);
    let g = 0;
    for (const _ of k) {
      if (_ === m) continue;
      const z = c(_);
      if (!Number.isFinite(z)) return NaN;
      g += z + (_.kind === "text" ? 0 : I(_.style.mt) + I(_.style.mb));
    }
    const S = M.display === "flex" ? I(M.gap_y) * Math.max(0, k.length - 1) : 0;
    return D - I(M.pt) - I(M.pb) - I(M.border_t) - I(M.border_b) - g - S - I(w.mt) - I(w.mb);
  }, p = (m, x) => {
    if (!(!m || m.kind === "text" || !Me(m))) {
      if (m.scrollbar > 0 && m.style.overflow_y === "scroll") {
        const w = s(m), M = d(m, x);
        Number.isFinite(w) && Number.isFinite(M) && w > M + 0.01 && i.set(m, { ...i.get(m), pr: I(m.style.pr) + m.scrollbar });
      }
      for (const w of m.children ?? []) p(w, m);
    }
  };
  for (const m of n) p(m, null);
}
const uv = ["text_size", "line_height", "whitespace", "text_ellipsis"], I = (n) => n == null ? 0 : typeof n == "number" ? n : NaN, ji = (n) => n.style.display === "flex" ? n.style.flex_direction === "col" : !0, Ye = (n) => n.style.display === "flex" && (n.style.flex_direction ?? "row") === "row", Je = (n) => n.kind === "text" || Me(n) && n.style.position !== "absolute";
function dv(n, i) {
  const o = /* @__PURE__ */ new Map(), c = (_, z) => o.set(_, { ...o.get(_), ...Object.fromEntries(Object.entries(z).filter(([, Y]) => Number.isFinite(Y))) }), s = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map();
  function p(_, z) {
    if (_.kind === "text") return z.whitespace === "nowrap" || jm.test(_.text) ? tn(z) ?? NaN : NaN;
    const Y = { ...z };
    for (const C of uv) _.style[C] !== void 0 && (Y[C] = _.style[C]);
    d.set(_, Y);
    const E = _.style, N = (_.children ?? []).filter(Je), A = N.map((C) => p(C, Y));
    let H;
    if (E.h !== void 0 && E.h !== "auto") H = I(E.h);
    else if (_.kind === "input")
      H = (_.input_type === "textarea" || _.input_type === "select" ? NaN : tn(Y) ?? NaN) + I(E.pt) + I(E.pb) + I(E.border_t) + I(E.border_b), E.min_h !== void 0 && (H = Math.max(H, I(E.min_h)));
    else {
      const C = N.map((h, G) => (h.kind === "text" ? 0 : I(h.style.mt) + I(h.style.mb)) + A[G]);
      let b;
      if (Ye(_)) b = E.flex_wrap === "wrap" ? NaN : E.items === "baseline" ? x(N, A, Y) : Math.max(0, ...C);
      else if (ji(_)) {
        const h = N.some((J) => J.kind !== "text" && (J.style.flex_grow > 0 || J.style.flex_basis !== void 0)), G = E.display !== "flex" && N.some((J) => J.kind !== "text" && (I(J.style.mt) || I(J.style.mb)));
        b = h || G ? NaN : C.reduce((J, at) => J + at, 0) + (E.display === "flex" ? I(E.gap_y) * Math.max(0, N.length - 1) : 0);
      } else b = NaN;
      H = b + I(E.pt) + I(E.pb) + I(E.border_t) + I(E.border_b), E.min_h !== void 0 && (H = Math.max(H, I(E.min_h))), E.max_h !== void 0 && (H = Math.min(H, I(E.max_h)));
    }
    return s.set(_, H), H;
  }
  const m = (_) => (tn(_) - (Ni + tm) * _.text_size) / 2 + Ni * _.text_size;
  function x(_, z, Y) {
    let E = 0, N = 0;
    for (const [A, H] of _.entries()) {
      const C = H.kind === "text" ? Y : d.get(H);
      if (!(H.kind === "text" || (H.children ?? []).filter(Je).every((J) => J.kind === "text")) || !Number.isFinite(z[A]) || typeof C.text_size != "number") return NaN;
      const h = H.kind === "text" ? {} : H.style, G = I(h.mt) + I(h.border_t) + I(h.pt) + m(C);
      E = Math.max(E, G), N = Math.max(N, I(h.mt) + z[A] + I(h.mb) - G);
    }
    return E + N;
  }
  const w = () => ({ exact: 0, laid: 0 }), M = (_, z) => {
    if (!Number.isFinite(z))
      return Object.assign(_, w()), NaN;
    _.exact += z;
    const Y = Math.round(_.exact * i + 1e-9) / i, E = Y - _.laid;
    return _.laid = Y, E;
  };
  function D(_) {
    if (!(_.kind === "text" || !Me(_))) {
      for (const z of (_.children ?? []).filter((Y) => Y.kind !== "text" && Me(Y) && Y.style.position === "absolute")) D(z);
      if (ji(_) && !Ye(_)) {
        const z = w();
        c(_, { border_t: M(z, I(_.style.border_t)), pt: M(z, I(_.style.pt)) }), k(_, z);
      } else for (const z of (_.children ?? []).filter(Je)) z.kind !== "text" && D(z);
    }
  }
  function k(_, z) {
    const Y = (_.children ?? []).filter(Je), E = _.style.display === "flex" ? I(_.style.gap_y) : 0;
    if (E && Y.some((N) => N.kind === "text")) {
      for (const N of Y) N.kind !== "text" && D(N);
      return !1;
    }
    return E && c(_, { gap_y: 0 }), Y.forEach((N, A) => {
      if (N.kind === "text") {
        const H = s.get(N) ?? p(N, d.get(_) ?? {});
        Number.isFinite(H) ? c(N, { h: M(z, H) }) : Object.assign(z, w());
        return;
      }
      if (c(N, { mt: M(z, (A ? E : 0) + I(N.style.mt)) }), Number.isFinite(s.get(N))) S(N, z);
      else if (g(N)) {
        const H = N.style;
        c(N, { border_t: M(z, I(H.border_t)), pt: M(z, I(H.pt)) }), c(N, { pb: M(z, I(H.pb)), border_b: M(z, I(H.border_b)) });
      } else
        D(N), Object.assign(z, w());
      c(N, { mb: M(z, I(N.style.mb)) });
    }), !0;
  }
  function g(_) {
    const z = _.style, Y = (_.children ?? []).filter(Je), E = tn(d.get(_) ?? {});
    return _.kind === "div" && !Ye(_) && Y.length > 0 && Y.every((N) => N.kind === "text") && Number.isInteger(E) && [z.h, z.min_h, z.max_h].every((N) => N === void 0 || N === "auto");
  }
  function S(_, z) {
    const Y = _.style;
    for (const C of (_.children ?? []).filter((b) => b.kind !== "text" && Me(b) && b.style.position === "absolute")) D(C);
    const E = z.laid, N = z.exact;
    c(_, { border_t: M(z, I(Y.border_t)), pt: M(z, I(Y.pt)) });
    const A = Y.h !== void 0 && Y.h !== "auto", H = s.get(_) - I(Y.pt) - I(Y.pb) - I(Y.border_t) - I(Y.border_b);
    if (_.kind === "input")
      A || M(z, H);
    else if (Ye(_) || A && (Y.justify ?? "start") !== "start") {
      for (const C of (_.children ?? []).filter(Je)) C.kind !== "text" && D(C);
      A || M(z, H);
    } else !k(_, z) && !A && M(z, H);
    if (A) {
      z.exact = N + s.get(_), z.laid = Math.round(z.exact * i + 1e-9) / i, c(_, { h: z.laid - E });
      return;
    }
    c(_, { pb: M(z, I(Y.pb)), border_b: M(z, I(Y.border_b)) }), c(_, { h: z.laid - E });
  }
  for (const _ of n)
    p(_, {}), D(_);
  return Object.defineProperty(o, "heights", { value: s }), o;
}
const yv = { sidebar: [{ name: "sidebar-root", selector: "aside.sidebar" }, { name: "sidebar-content", selector: "aside.sidebar > div:first-child" }, { name: "host-switcher", selector: '[data-testid="host-switcher"]' }, { name: "host-chip", selector: '[data-testid="host-switcher"] > div' }, { name: "host-badge", selector: ".sidebar__env-badge" }, { name: "host-name", selector: ".sidebar__env-host" }, { name: "host-meta", selector: '[data-testid="host-switcher"] > div > div:first-child > span:nth-child(3)' }, { name: "host-line", selector: ".sidebar__env-cwd" }, { name: "host-caret", selector: '[data-testid="host-switcher"] > span[aria-hidden="true"]' }, { name: "new-session-button", selector: 'button[data-testid^="new-session-"]', key: { self: !0, attr: "data-testid", strip: "new-session-" } }, { name: "new-session-icon", selector: 'button[data-testid^="new-session-"] > svg' }, { name: "new-session-label", selector: 'button[data-testid^="new-session-"]', textRange: !0 }, { name: "new-session-shortcut", selector: 'button[data-testid^="new-session-"] > span' }, { name: "overview", selector: '[data-testid="workspace-overview"]' }, { name: "overview-header", selector: '[data-testid="workspace-overview"] > div:first-child' }, { name: "overview-title", selector: '[data-testid="workspace-overview"] > div:first-child > div:first-child > span:first-child' }, { name: "needs-you-button", selector: '[data-testid="workspace-needs-you"]' }, { name: "organize-button", selector: '[data-testid="workspace-organize"]' }, { name: "organize-icon", selector: '[data-testid="workspace-organize"] > svg' }, { name: "add-project-button", selector: '[data-testid="workspace-add-project"]' }, { name: "add-project-icon", selector: '[data-testid="workspace-add-project"] > svg' }, { name: "add-project-label", selector: '[data-testid="workspace-add-project"]', textRange: !0 }, { name: "project-list", selector: '[data-testid="project-list"]' }, { name: "project", selector: ".workspace-project", key: { self: !0, attr: "data-testid", strip: "workspace-project-" } }, { name: "project-header", selector: ".workspace-project > div:first-child", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-toggle", selector: '[data-testid^="project-toggle-"]', key: { self: !0, attr: "data-testid", strip: "project-toggle-" } }, { name: "project-chevron", selector: '[data-testid^="project-toggle-"] > svg:not([data-testid])', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-folder-icon", selector: '[data-testid="project-folder-icon"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-name", selector: '[data-testid^="project-toggle-"] strong', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-branch", selector: '[data-testid^="project-toggle-"] > span.whitespace-nowrap', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-dirty-mark", selector: '[data-testid^="project-toggle-"] > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="project-toggle-"]', attr: "data-testid", strip: "project-toggle-" } }, { name: "project-rollup", selector: '[data-testid^="project-rollup-"]', key: { self: !0, attr: "data-testid", strip: "project-rollup-" } }, { name: "project-rollup-badge", selector: '[data-testid^="project-rollup-"] > span', key: { closest: '[data-testid^="project-rollup-"]', attr: "data-testid", strip: "project-rollup-" } }, { name: "project-menu-button", selector: '[data-testid^="workspace-project-menu-"]', key: { self: !0, attr: "data-testid", strip: "workspace-project-menu-" } }, { name: "project-add-button", selector: ".workspace-project > div:first-child .worktree-menu__btn", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "project-workspaces", selector: ".workspace-project__workspaces", key: { closest: ".workspace-project", attr: "data-testid", strip: "workspace-project-" } }, { name: "workspace", selector: '[data-testid="workspace-tree-root"] [data-testid^="workspace-entry-"]', key: { self: !0, attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-button", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-icon", selector: '[data-testid="workspace-tree-root"] [data-testid="workspace-checkout-icon"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-name", selector: '[data-testid="workspace-tree-root"] strong[title="Double-click to rename"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-branch", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.items-baseline > span', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-dirty-mark", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span[title="Uncommitted changes"]', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "workspace-pinned-label", selector: '[data-testid="workspace-tree-root"] button.workspace-entry__button > span.shrink-0:not([title])', key: { closest: '[data-testid^="workspace-entry-"]', attr: "data-testid", strip: "workspace-entry-" } }, { name: "hidden-worktrees-button", selector: '[data-testid^="workspace-hidden-"]', key: { self: !0, attr: "data-testid", strip: "workspace-hidden-" } }, { name: "session-row", selector: 'div[class~="group/row"]', key: { find: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-button", selector: 'button[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])', key: { self: !0, attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark", selector: ".agent-mark", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-mark-icon", selector: ".agent-mark > span > *", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-title", selector: 'button[data-testid^="workspace-session-"] > span.whitespace-nowrap', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-title", selector: "button[data-session] span.truncate:not([data-testid])", key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "status-row-detail", selector: '[data-testid="status-row-detail"]', key: { closest: 'button[data-testid^="workspace-session-"]', attr: "data-testid", strip: "workspace-session-" } }, { name: "session-state-badge", selector: '[data-testid^="session-state-"]', key: { self: !0, attr: "data-testid", strip: "session-state-" } }, { name: "session-close-button", selector: '[data-testid^="workspace-session-close-"]', key: { self: !0, attr: "data-testid", strip: "workspace-session-close-" } }, { name: "chats", selector: '[data-testid="workspace-chats"]' }, { name: "chats-header", selector: '[data-testid="workspace-chats"] > div:first-child' }, { name: "chats-toggle", selector: '[data-testid="workspace-chats-collapse"]' }, { name: "chats-label", selector: '[data-testid="workspace-chats-collapse"]', textRange: !0 }, { name: "chats-chevron", selector: '[data-testid="workspace-chats-collapse"] > svg' }, { name: "chats-menu-button", selector: '[data-testid="workspace-chats-menu"]' }, { name: "chats-new-button", selector: '[data-testid="workspace-chats-new"]' }, { name: "chats-new-icon", selector: '[data-testid="workspace-chats-new"] > svg' }, { name: "status-view", selector: '[data-testid="workspace-status-view"]' }, { name: "status-section", selector: '[data-testid^="status-section-"]:not([data-testid^="status-section-title-"])', key: { self: !0, attr: "data-testid", strip: "status-section-" } }, { name: "status-heading", selector: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', key: { self: !0, attr: "data-testid" } }, { name: "status-heading-dot", selector: '[data-testid^="status-section-title-"] > span:first-child, [data-testid="status-no-sessions-title"] > span:first-child', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-label", selector: '[data-testid^="status-section-title-"] > span:nth-child(2), [data-testid="status-no-sessions-title"] > span:nth-child(2)', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-count", selector: '[data-testid^="status-section-title-"] > span[aria-label], [data-testid="status-no-sessions-title"] > span[aria-label]', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-heading-note", selector: '[data-testid^="status-section-title-"] > span.truncate, [data-testid="status-no-sessions-title"] > span.truncate', key: { closest: '[data-testid^="status-section-title-"], [data-testid="status-no-sessions-title"]', attr: "data-testid" } }, { name: "status-project", selector: 'div[data-testid^="status-project-"]', key: { self: !0, attr: "data-testid", strip: "status-project-" } }, { name: "status-project-header", selector: 'div[data-testid^="status-project-"] > div:first-child', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-icon", selector: 'div[data-testid^="status-project-"] > div:first-child > svg', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-project-title", selector: '[data-testid="status-project-title"]', key: { closest: 'div[data-testid^="status-project-"]', attr: "data-testid", strip: "status-project-" } }, { name: "status-empty-project", selector: '[data-testid^="status-empty-project-"]', key: { self: !0, attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-icon", selector: '[data-testid^="status-empty-project-"] > button:first-child > svg', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "status-empty-project-title", selector: '[data-testid^="status-empty-project-"] > button > span.whitespace-nowrap', key: { closest: '[data-testid^="status-empty-project-"]', attr: "data-testid", strip: "status-empty-project-" } }, { name: "settings-bar", selector: "aside.sidebar > div:last-child" }, { name: "settings-gear", selector: '[data-testid="settings-gear"]' }, { name: "settings-gear-icon", selector: '[data-testid="settings-gear"] > svg' }], tabs: [{ name: "tab-strip", selector: '[data-testid="tab-bar"]' }, { name: "tab-slot", selector: "[data-tab-entry]", key: { self: !0, attr: "data-tab-entry" } }, { name: "tab-separator", selector: '[data-testid="tab-separator"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab", selector: "button.tab-bar__tab", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon", selector: 'button.tab-bar__tab > span[aria-hidden="true"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-icon-glyph", selector: 'button.tab-bar__tab > span[aria-hidden="true"] > *', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-label", selector: "button.tab-bar__tab > span.truncate", key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-dirty", selector: 'button.tab-bar__tab > span[aria-label="unsaved changes"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close", selector: '[data-tab-entry] > button[aria-label^="Close"]', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-close-glyph", selector: '[data-tab-entry] > button[aria-label^="Close"] > svg', key: { closest: "[data-tab-entry]", attr: "data-tab-entry" } }, { name: "tab-new", selector: '[data-testid="tab-new"]' }, { name: "tab-new-glyph", selector: '[data-testid="tab-new"] > svg' }], status: [{ name: "status-bar", selector: "footer.status-bar" }, { name: "status-location", selector: ".status-bar__location" }, { name: "status-dot", selector: ".status-bar__location > span:first-child" }, { name: "status-host", selector: '[data-testid="status-host"]' }, { name: "status-cwd", selector: ".status-item--cwd" }, { name: "status-branch", selector: ".status-bar__branch" }, { name: "status-branch-icon", selector: ".status-bar__branch > svg" }, { name: "status-branch-name", selector: ".status-bar__branch > span" }, { name: "status-details", selector: ".status-bar__details" }, { name: "zoom-indicator", selector: '[data-testid="zoom-indicator"]' }, { name: "status-detail", selector: ".status-bar__details > span" }, { name: "status-usage", selector: ".status-bar__usage" }, { name: "usage-summary", selector: '[data-testid="usage-summary"]' }, { name: "usage-unavailable", selector: '[data-testid="usage-summary"] > span:only-child' }, { name: "usage-account", selector: '[data-testid="usage-summary"] > span.flex' }, { name: "usage-account-name", selector: '[data-testid="usage-summary"] > span.flex > span:first-child' }, { name: "usage-window", selector: '[data-testid="usage-summary"] > span.flex > span:not(:first-child)' }, { name: "status-connection", selector: '[data-testid="status-connection"]' }, { name: "status-connection-glyph", selector: '[data-testid="status-connection"] > svg' }], navigator: [{ name: "navigator-scrim", selector: "body > div.fixed.inset-0" }, { name: "navigator-panel", selector: '[data-testid="navigator"]' }, { name: "navigator-input", selector: '[data-testid="navigator-input"]' }, { name: "navigator-chips", selector: '[data-testid="navigator"] > div:nth-child(2)' }, { name: "navigator-chip", selector: '[data-testid^="navigator-filter-"]', key: { self: !0, attr: "data-testid", strip: "navigator-filter-" } }, { name: "navigator-list", selector: '[data-testid="navigator"] > div:nth-child(3)' }, { name: "navigator-notice", selector: '[data-testid="navigator"] > div:nth-child(3) > p[role]' }, { name: "navigator-empty", selector: '[data-testid="navigator"] div.text-center' }, { name: "navigator-command", selector: '[data-testid^="navigator-command-"]', key: { self: !0, attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-title", selector: '[data-testid^="navigator-command-"] > span:first-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-command-detail", selector: '[data-testid^="navigator-command-"] > span:last-child', key: { closest: '[data-testid^="navigator-command-"]', attr: "data-testid", strip: "navigator-command-" } }, { name: "navigator-row", selector: '[data-testid^="navigator-row-"]', key: { self: !0, attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-dot", selector: '[data-testid^="navigator-row-"] > :first-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-title", selector: '[data-testid^="navigator-row-"] > span:nth-child(2)', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-row-detail", selector: '[data-testid^="navigator-row-"] > span:last-child', key: { closest: '[data-testid^="navigator-row-"]', attr: "data-testid", strip: "navigator-row-" } }, { name: "navigator-note", selector: '[data-testid="navigator"] > p:last-child' }], "pane-menu": [{ name: "pane-menu", selector: '[data-testid="pane-context-menu"]' }, { name: "pane-menu-item", selector: '[data-testid="pane-context-menu"] > button', key: { self: !0, attr: "data-testid", strip: "pane-menu-" } }, { name: "pane-menu-divider", selector: '[data-testid="pane-context-menu"] > div.h-px' }, { name: "pane-menu-rename-row", selector: '[data-testid="pane-context-menu"] > div.flex' }, { name: "pane-menu-rename-input", selector: '[data-testid="pane-menu-rename-input"]' }, { name: "pane-menu-rename-confirm", selector: '[data-testid="pane-menu-rename-confirm"]' }], confirm: [{ name: "confirm-scrim", selector: "body > div.fixed.inset-0" }, { name: "confirm-panel", selector: '[data-testid="confirm-dialog"]' }, { name: "confirm-message", selector: ".confirm-dialog__message" }, { name: "confirm-extra", selector: '[data-testid="confirm-dialog"] > :not(.confirm-dialog__message):not(div.flex)' }, { name: "confirm-buttons", selector: '[data-testid="confirm-dialog"] > div.flex' }, { name: "confirm-cancel", selector: '[data-testid="confirm-cancel"]' }, { name: "confirm-accept", selector: '[data-testid="confirm-accept"]' }], dialog: [{ name: "dialog-scrim", selector: "body > div.fixed.inset-0" }, { name: "dialog-panel", selector: '[data-testid="file-name-dialog"]' }, { name: "dialog-title", selector: '[data-testid="file-name-dialog"] > h2' }, { name: "dialog-input", selector: '[data-testid="file-name-input"]' }, { name: "dialog-hint", selector: '[data-testid="file-name-dialog"] > p:not([role])' }, { name: "dialog-error", selector: '[data-testid="file-name-dialog"] > p[role="alert"]' }, { name: "dialog-buttons", selector: '[data-testid="file-name-dialog"] > div.flex' }, { name: "dialog-cancel", selector: '[data-testid="file-name-dialog"] > div.flex > button:first-child' }, { name: "dialog-confirm", selector: '[data-testid="file-name-confirm"]' }], toast: [{ name: "toast-stack", selector: '[data-testid="toast"]' }, { name: "toast-card", selector: '[data-testid="toast"] .animate-toast-in' }, { name: "toast-open", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"])' }, { name: "toast-mark", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > :first-child' }, { name: "toast-heading", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:first-child' }, { name: "toast-detail", selector: '[data-testid^="toast-"]:not([data-testid^="toast-dismiss-"]) > span.min-w-0 > span:nth-child(2)' }, { name: "toast-dismiss", selector: '[data-testid^="toast-dismiss-"]' }, { name: "toast-dismiss-glyph", selector: '[data-testid^="toast-dismiss-"] > svg' }], "pane-header": [{ name: "pane-header", selector: '[data-testid^="pane-header-"]', key: { self: !0, attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid])', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-icon-glyph", selector: '[data-testid^="pane-header-"] > span.shrink-0:not([data-testid]) > *', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-name", selector: '[data-testid^="pane-header-"] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state", selector: '[data-testid^="pane-header-"] > span.flex[title]', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-dot", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.rounded-full', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-header-state-word", selector: '[data-testid^="pane-header-"] > span.flex[title] > span.truncate', key: { closest: '[data-testid^="pane-header-"]', attr: "data-testid", strip: "pane-header-" } }, { name: "pane-controls", selector: '[data-testid^="tile-controls-"]', key: { self: !0, attr: "data-testid", strip: "tile-controls-" } }, { name: "pane-expand", selector: '[data-testid^="tile-expand-"]', key: { self: !0, attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-expand-glyph", selector: '[data-testid^="tile-expand-"] > svg', key: { closest: '[data-testid^="tile-expand-"]', attr: "data-testid", strip: "tile-expand-" } }, { name: "pane-close", selector: '[data-testid^="tile-close-"]', key: { self: !0, attr: "data-testid", strip: "tile-close-" } }, { name: "pane-close-glyph", selector: '[data-testid^="tile-close-"] > svg', key: { closest: '[data-testid^="tile-close-"]', attr: "data-testid", strip: "tile-close-" } }, { name: "pane-corner", selector: "div.pointer-events-auto.absolute" }], "new-session": [{ name: "launcher", selector: ".new-session-popover" }, { name: "launcher-filter", selector: '[data-testid="new-tab-filter"]' }, { name: "launcher-list", selector: "#new-tab-launcher-list" }, { name: "launcher-option", selector: '[role="option"]', key: { self: !0, attr: "data-testid" } }, { name: "launcher-option-icon", selector: '[role="option"] > :first-child:not(span.flex-1):not(kbd)', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-label", selector: '[role="option"] > span.flex-1', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-option-key", selector: '[role="option"] > kbd', key: { closest: '[role="option"]', attr: "data-testid" } }, { name: "launcher-note", selector: ".new-session-popover p[role]" }, { name: "agent-select", selector: '[data-testid="new-session-popover-agent"]' }, { name: "agent-manage", selector: ".new-session-popover > div:first-child > button:not([data-testid])" }, { name: "project-option", selector: '[data-testid^="project-option-"]', key: { self: !0, attr: "data-testid", strip: "project-option-" } }, { name: "project-option-name", selector: '[data-testid^="project-option-"]', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" }, textRange: !0 }, { name: "project-option-path", selector: '[data-testid^="project-option-"] > span', key: { closest: '[data-testid^="project-option-"]', attr: "data-testid", strip: "project-option-" } }], "tab-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }, { name: "tab-menu-rename-form", selector: '[data-testid="tab-split-menu"] > form' }, { name: "tab-menu-rename-input", selector: '[data-testid="tab-menu-rename-input"]' }, { name: "tab-menu-rename-save", selector: '[data-testid="tab-split-menu"] > form > button' }], select: [{ name: "select-field", selector: '[data-testid="select-demo"]' }, { name: "select-field-label", selector: '[data-testid="select-demo"] > span.truncate' }, { name: "select-chevron", selector: '[data-testid="select-demo"] > svg' }, { name: "select-list", selector: '[role="listbox"]' }, { name: "select-option", selector: '[role="listbox"] > [role="option"]', key: { self: !0, attr: "data-value" } }, { name: "select-option-label", selector: '[role="listbox"] > [role="option"] > span.truncate', key: { closest: '[role="option"]', attr: "data-value" } }, { name: "select-option-check", selector: '[role="listbox"] > [role="option"] > span[aria-hidden]', key: { closest: '[role="option"]', attr: "data-value" } }], "keybind-help": [{ name: "keybind-help-scrim", selector: "body > div.fixed.inset-0" }, { name: "keybind-help-panel", selector: '[data-testid="keybind-help"]' }, { name: "keybind-help-header", selector: '[data-testid="keybind-help"] > div:first-child' }, { name: "keybind-help-title", selector: '[data-testid="keybind-help"] h2' }, { name: "keybind-help-close", selector: '[aria-label="Close keybind help"]' }, { name: "keybind-help-close-glyph", selector: '[aria-label="Close keybind help"] > svg' }, { name: "keybind-help-search", selector: '[data-testid="keybind-help-search"]' }, { name: "keybind-help-list", selector: '[data-testid="keybind-help"] > div:last-child' }, { name: "keybind-help-empty", selector: '[data-testid="keybind-help"] div.text-center' }, { name: "keybind-help-group", selector: '[data-testid="keybind-help"] section' }, { name: "keybind-help-group-title", selector: '[data-testid="keybind-help"] section > h3' }, { name: "keybind-help-row", selector: '[data-testid="keybind-help"] li' }, { name: "keybind-help-keys", selector: '[data-testid="keybind-help"] li > kbd' }, { name: "keybind-help-description", selector: '[data-testid="keybind-help"] li > span' }], launcher: [{ name: "launcher-scrim", selector: "body > div.fixed.inset-0" }, { name: "launcher-panel", selector: '[data-testid="new-session-dialog"]' }, { name: "launcher-title", selector: '[data-testid="new-session-dialog"] > p' }, { name: "launcher-filter", selector: '[data-testid="new-session-filter"]' }, { name: "launcher-list", selector: "#new-session-list" }, { name: "launcher-row", selector: '[data-testid^="new-session-row-"]', key: { self: !0, attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-icon", selector: '[data-testid^="new-session-row-"] > :first-child:not(span):not(kbd)', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-label", selector: '[data-testid^="new-session-row-"] > span.shrink-0', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-detail", selector: '[data-testid^="new-session-row-"] > span.ml-auto', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-row-key", selector: '[data-testid^="new-session-row-"] > kbd', key: { closest: '[data-testid^="new-session-row-"]', attr: "data-testid", strip: "new-session-row-" } }, { name: "launcher-note", selector: "#new-session-list > p" }], "session-menu": [{ name: "tab-menu", selector: '[data-testid="tab-split-menu"]' }, { name: "tab-menu-item", selector: '[data-testid="tab-split-menu"] > button', key: { self: !0, attr: "data-testid" } }, { name: "tab-menu-item-label", selector: '[data-testid="tab-split-menu"] > button > span.block', key: { closest: '[data-testid="tab-split-menu"] > button', attr: "data-testid" } }, { name: "tab-menu-heading", selector: '[data-testid="tab-split-menu"] > p' }, { name: "tab-menu-empty", selector: '[data-testid="tab-split-menu"] > div:not(.h-px)' }, { name: "tab-menu-divider", selector: '[data-testid="tab-split-menu"] > div.h-px' }], "tab-drag": [{ name: "tab-drag-layer", selector: '[data-testid="tab-drag-layer"]' }, { name: "tab-drag-pane", selector: '[data-testid="tab-drag-layer"] > div.bg-surface-1\\/30' }, { name: "tab-drop-zone", selector: '[data-testid="tab-drop-zone"]', key: { self: !0, attr: "data-zone" } }, { name: "tab-drop-label", selector: '[data-testid="tab-drop-zone"] > span' }, { name: "tab-drag-ghost", selector: '[data-testid="tab-drag-ghost"]' }], start: [{ name: "start-panel", selector: '[data-testid="no-session-panel"], [data-testid="cli-start-panel"]' }, { name: "start-column", selector: '[data-testid$="-panel"] > div' }, { name: "start-logo", selector: '[data-testid="no-session-panel"] img' }, { name: "start-name", selector: '[data-testid$="-panel"] h1, [data-testid="no-session-panel"] h1, [data-testid="no-session-panel"] h2' }, { name: "start-hint", selector: '[data-testid$="-panel"] p' }, { name: "start-target", selector: '[data-testid="workspace-start-target"], [data-testid="cli-start-target"]' }, { name: "start-action", selector: '[data-testid="home-add-project"], [data-testid="no-session-create"], [data-testid^="workspace-start-"]:not([data-testid="workspace-start-target"]), [data-testid^="cli-start-agent-"]', key: { self: !0, attr: "data-testid" } }, { name: "start-status", selector: '[role="status"], [role="alert"]' }, { name: "start-status-action", selector: '[role="status"] > button, [role="alert"] > button' }, { name: "start-link", selector: '[data-testid$="-panel"] button.text-subtext-0' }, { name: "start-shortcut-row", selector: '[data-testid="no-session-panel"] dl > div' }, { name: "start-shortcut-label", selector: '[data-testid="no-session-panel"] dl dt' }, { name: "start-shortcut-key", selector: '[data-testid="no-session-panel"] dl kbd' }], "folder-browser": [{ name: "folder-browser", selector: '[data-testid="dir-browser"]' }, { name: "folder-browser-mode-toggle", selector: '[data-testid="dir-browser-mode-toggle"]' }, { name: "folder-browser-up", selector: '[data-testid="dir-browser-up"]' }, { name: "folder-browser-crumbs", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1' }, { name: "folder-browser-crumb", selector: '[data-testid="dir-browser"] span.min-w-0.flex-1 button' }, { name: "folder-browser-filter", selector: '[data-testid="dir-browser-filter"]' }, { name: "folder-browser-list", selector: '[data-testid="dir-browser"] div.overflow-y-auto' }, { name: "folder-browser-entry", selector: '[data-testid^="dir-browser-entry-"]', key: { self: !0, attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-entry-name", selector: '[data-testid^="dir-browser-entry-"] > span:first-child', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-git", selector: '[data-testid^="dir-browser-entry-"] > span:last-child:not(:first-child)', key: { closest: '[data-testid^="dir-browser-entry-"]', attr: "data-testid", strip: "dir-browser-entry-" } }, { name: "folder-browser-note", selector: '[data-testid="dir-browser"] div.overflow-y-auto > div' }, { name: "folder-browser-use", selector: '[data-testid="dir-browser-use"]' }, { name: "folder-browser-path-input", selector: '[data-testid="project-path-input"]' }], instructions: [{ name: "instructions-scrim", selector: "body > div.fixed.inset-0" }, { name: "instructions-panel", selector: '[data-testid="instructions-dialog"]' }, { name: "instructions-title", selector: '[data-testid="instructions-dialog"] > h2' }, { name: "instructions-intro", selector: '[data-testid="instructions-dialog"] > p' }, { name: "instructions-label", selector: '[data-testid="instructions-dialog"] > label > span:first-child' }, { name: "instructions-count", selector: '[data-testid="instructions-count"]' }, { name: "instructions-text", selector: '[data-testid="instructions-text"]' }, { name: "instructions-folders", selector: '[data-testid="instructions-folders"]' }, { name: "instructions-error", selector: '[data-testid="instructions-error"]' }, { name: "instructions-cancel", selector: '[data-testid="instructions-dialog"] > div.flex.justify-end > button:first-child' }, { name: "instructions-save", selector: '[data-testid="instructions-save"]' }], memory: [{ name: "memory-scrim", selector: "body > div.fixed.inset-0", key: { self: !0, attr: "data-testid" } }, { name: "memory-panel", selector: '[data-testid="memory-dialog"]' }, { name: "memory-title", selector: '[data-testid="memory-dialog"] > h2' }, { name: "memory-intro", selector: '[data-testid="memory-dialog"] > p' }, { name: "memory-caps", selector: '[data-testid="memory-caps"]' }, { name: "memory-new", selector: '[data-testid="memory-new"]' }, { name: "memory-enabled", selector: '[data-testid="memory-enabled"]' }, { name: "memory-enabled-label", selector: '[data-testid="memory-dialog"] > label.flex > span' }, { name: "memory-note", selector: '[data-testid="memory-dialog"] > span.text-subtext-0' }, { name: "memory-row", selector: '[data-testid^="memory-row-"]', key: { self: !0, attr: "data-testid", strip: "memory-row-" } }, { name: "memory-open", selector: '[data-testid^="memory-open-"]', key: { self: !0, attr: "data-testid", strip: "memory-open-" } }, { name: "memory-file-title", selector: '[data-testid^="memory-row-"] button > span:first-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-summary", selector: '[data-testid^="memory-row-"] button > span.truncate', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-file-meta", selector: '[data-testid^="memory-row-"] button > span:last-child', key: { closest: '[data-testid^="memory-row-"]', attr: "data-testid", strip: "memory-row-" } }, { name: "memory-delete", selector: '[data-testid^="memory-delete-"]', key: { self: !0, attr: "data-testid", strip: "memory-delete-" } }, { name: "memory-error", selector: '[data-testid="memory-error"]' }, { name: "memory-close", selector: '[data-testid="memory-dialog"] > div.flex.justify-end > button' }, { name: "memory-file-name", selector: '[data-testid="memory-file-name"]' }, { name: "memory-name", selector: '[data-testid="memory-name"]' }, { name: "memory-count", selector: '[data-testid="memory-count"]' }, { name: "memory-text", selector: '[data-testid="memory-text"]' }, { name: "memory-conflict", selector: '[data-testid="memory-conflict"]' }, { name: "memory-reload", selector: '[data-testid="memory-reload"]' }, { name: "memory-back", selector: '[data-testid="memory-back"]' }, { name: "memory-save", selector: '[data-testid="memory-save"]' }, { name: "memory-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "memory-confirm-message", selector: ".confirm-dialog__message" }], worktree: [{ name: "worktree-plus", selector: '[data-testid^="worktree-menu-"]' }, { name: "worktree-popover", selector: '[role="dialog"][aria-label="Git worktrees"]' }, { name: "worktree-heading", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:first-child' }, { name: "worktree-project", selector: '[role="dialog"][aria-label="Git worktrees"] > div:first-child > span:last-child' }, { name: "worktree-list", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto' }, { name: "worktree-note", selector: '[role="dialog"][aria-label="Git worktrees"] > div.overflow-y-auto > div:not(.worktree-menu__entry)' }, { name: "worktree-entry", selector: '[data-testid^="worktree-entry-"]', key: { self: !0, attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-branch", selector: ".worktree-menu__entry-branch", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-badge", selector: '[data-testid^="worktree-entry-"] .worktree-menu__entry-branch > span', key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-entry-path", selector: ".worktree-menu__entry-path", key: { closest: '[data-testid^="worktree-entry-"]', attr: "data-testid", strip: "worktree-entry-" } }, { name: "worktree-open", selector: '[data-testid^="worktree-open-"]', key: { self: !0, attr: "data-testid", strip: "worktree-open-" } }, { name: "worktree-remove", selector: '[data-testid^="worktree-remove-"]', key: { self: !0, attr: "data-testid", strip: "worktree-remove-" } }, { name: "worktree-error", selector: '[data-testid="worktree-error"]' }, { name: "worktree-new", selector: '[data-testid="worktree-new"]' }, { name: "worktree-name-input", selector: '[data-testid="worktree-name-input"]' }, { name: "worktree-start-input", selector: '[data-testid="worktree-start-input"]' }, { name: "worktree-branch-input", selector: '[data-testid="worktree-branch-input"]' }, { name: "worktree-parent-select", selector: '[data-testid="worktree-parent-select"]' }, { name: "worktree-new-branch", selector: '[data-testid="worktree-new-branch"]' }, { name: "worktree-path-input", selector: '[data-testid="worktree-path-input"]' }, { name: "worktree-agent-select", selector: '[data-testid="worktree-agent-select"]' }, { name: "worktree-create-cancel", selector: '[data-testid="worktree-create-cancel"]' }, { name: "worktree-create-submit", selector: '[data-testid="worktree-create-submit"]' }, { name: "worktree-confirm", selector: '[data-testid="confirm-dialog"]' }, { name: "worktree-confirm-message", selector: ".confirm-dialog__message" }, { name: "worktree-confirm-accept", selector: '[data-testid="confirm-accept"]' }, { name: "worktree-confirm-cancel", selector: '[data-testid="confirm-cancel"]' }], "terminal-search": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "term-search", selector: '[data-testid="term-search"]' }, { name: "term-search-input", selector: '[data-testid="term-search-input"]' }, { name: "term-search-button", selector: '[data-testid="term-search"] > button', key: { self: !0, attr: "title" } }], "agent-control": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "agent-control-chip", selector: '[data-testid="agent-control-chip"]' }, { name: "agent-control-label", selector: '[data-testid="agent-control-chip"] > span' }, { name: "agent-control-button", selector: '[data-testid="agent-control-chip"] > button' }, { name: "agent-control-error", selector: ".terminal__cli-error" }, { name: "agent-control-ended", selector: ".terminal__exited", key: { self: !0, attr: "data-testid" } }, { name: "agent-control-ended-text", selector: ".terminal__exited-text" }, { name: "agent-control-ended-button", selector: ".terminal__exited-actions > button", key: { self: !0, attr: "data-testid" } }], "phone-size": [{ name: "terminal-frame", selector: '[data-testid="persistent-agent-terminal"]' }, { name: "phone-size-notice", selector: '[data-testid="phone-size-notice"]' }, { name: "phone-size-chip", selector: '[data-testid="phone-size-chip"]' }, { name: "phone-size-heading", selector: '[data-testid="phone-size-notice"] span.font-semibold' }, { name: "phone-size-text", selector: '[data-testid="phone-size-notice"] span:not(.font-semibold)' }, { name: "phone-size-fold", selector: '[aria-label="Keep phone size and hide this"]' }, { name: "phone-size-button", selector: '[data-testid="phone-size-notice"] div.flex.flex-wrap > button, [data-testid="phone-size-chip"] > button' }] };
export {
  yv as NAMED_ELEMENTS,
  mv as React,
  Fh as SCHEMA,
  bv as STYLE_KEYS,
  vv as describeToGpui,
  fv as jsxRuntime,
  pv as mount,
  hv as reactDom,
  gv as sdk
};
