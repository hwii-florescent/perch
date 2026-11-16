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

export class SelectorError extends Error {}

const STATES = new Set(["hover", "focus", "focus-visible", "focus-within", "active", "disabled", "enabled", "checked"]);
const FUNCTIONAL = new Set(["not", "is", "where", "has", "nth-child"]);
const SIMPLE = new Set(["first-child", "last-child", "only-child", "root", ...STATES]);

/** `text` without CSS escapes (`\:` is `:`, `\31 ` is `1`). */
export function unescapeIdent(text) {
  return text.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g, (_, hex, char) => (hex ? String.fromCodePoint(parseInt(hex, 16)) : char));
}

function readIdent(text, at) {
  let end = at;
  while (end < text.length) {
    const c = text[end];
    if (c === "\\") { end += 2; continue; }
    if (/[A-Za-z0-9_\- -￿]/.test(c)) { end++; continue; }
    break;
  }
  if (end === at) throw new SelectorError(`expected a name at ${at} in ${JSON.stringify(text)}`);
  return [unescapeIdent(text.slice(at, end)), end];
}

/** The index of the `)` closing the `(` at `at - 1`, honouring nesting and strings. */
function closeParen(text, at) {
  let depth = 1;
  for (let i = at; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") { i++; continue; }
    if (c === '"' || c === "'") { i = text.indexOf(c, i + 1); if (i < 0) break; continue; }
    if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return i;
  }
  throw new SelectorError(`unbalanced parenthesis in ${JSON.stringify(text)}`);
}

/** Splits `text` at top-level commas. */
export function splitList(text) {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") { i++; continue; }
    if (c === '"' || c === "'") { i = text.indexOf(c, i + 1); if (i < 0) break; continue; }
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === "," && depth === 0) { parts.push(text.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(text.slice(start).trim());
  return parts.filter(Boolean);
}

function parseCompound(text, at) {
  const compound = { tag: null, id: null, classes: [], attrs: [], pseudos: [] };
  let any = false;
  while (at < text.length) {
    const c = text[at];
    if (c === "*") { compound.tag = "*"; at++; any = true; continue; }
    if (c === ".") { const [name, end] = readIdent(text, at + 1); compound.classes.push(name); at = end; any = true; continue; }
    if (c === "#") { const [name, end] = readIdent(text, at + 1); compound.id = name; at = end; any = true; continue; }
    if (c === "[") {
      const end = text.indexOf("]", at);
      if (end < 0) throw new SelectorError(`unclosed [ in ${JSON.stringify(text)}`);
      const body = text.slice(at + 1, end).trim();
      const m = /^([^\s~^$*|=]+)\s*(?:([~^$*|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'\]]+)))?\s*(i)?$/.exec(body);
      if (!m) throw new SelectorError(`cannot read the attribute selector [${body}]`);
      const value = m[3] ?? m[4] ?? m[5];
      compound.attrs.push({ name: unescapeIdent(m[1]).toLowerCase(), op: m[2] ?? null, value: value === undefined ? null : unescapeIdent(value) });
      at = end + 1; any = true; continue;
    }
    if (c === ":") {
      if (text[at + 1] === ":") throw new SelectorError(`pseudo-elements are not supported (${JSON.stringify(text)})`);
      const [name, end] = readIdent(text, at + 1);
      at = end;
      const lower = name.toLowerCase();
      if (text[at] === "(") {
        if (!FUNCTIONAL.has(lower)) throw new SelectorError(`:${lower}() is not supported`);
        const close = closeParen(text, at + 1);
        const arg = text.slice(at + 1, close).trim();
        at = close + 1;
        if (lower === "nth-child") {
          if (!/^\d+$/.test(arg)) throw new SelectorError(`:nth-child(${arg}) is not supported (only a number)`);
          compound.pseudos.push({ name: lower, n: Number(arg) });
        } else {
          const list = splitList(arg).map(parseComplex);
          if (lower === "has" && list.some((steps) => steps.length !== 1)) throw new SelectorError(`:has(${arg}) is not supported (only a compound selector)`);
          compound.pseudos.push({ name: lower, list });
        }
      } else {
        if (!SIMPLE.has(lower)) throw new SelectorError(`:${lower} is not supported`);
        compound.pseudos.push({ name: lower });
      }
      any = true; continue;
    }
    if (/[A-Za-z_\-\\]/.test(c) && !any) { const [name, end] = readIdent(text, at); compound.tag = name.toLowerCase(); at = end; any = true; continue; }
    break;
  }
  if (!any) throw new SelectorError(`empty compound selector at ${at} in ${JSON.stringify(text)}`);
  return [compound, at];
}

/** One complex selector: compounds left to right, each with the combinator that joins it to the previous one. */
export function parseComplex(text) {
  const steps = [];
  let at = 0;
  let combinator = null;
  text = text.trim();
  while (at < text.length) {
    const [compound, end] = parseCompound(text, at);
    steps.push({ compound, combinator });
    at = end;
    let sawSpace = false;
    while (text[at] === " " || text[at] === "\n" || text[at] === "\t") { at++; sawSpace = true; }
    if (at >= text.length) break;
    const c = text[at];
    if (c === ">") { combinator = ">"; at++; while (text[at] === " ") at++; }
    else if (c === "+" || c === "~") throw new SelectorError(`the ${c} combinator is not supported`);
    else if (sawSpace) combinator = " ";
    else throw new SelectorError(`unexpected ${JSON.stringify(c)} in ${JSON.stringify(text)}`);
  }
  if (!steps.length) throw new SelectorError("empty selector");
  return steps;
}

const cache = new Map();
/** The parsed selector list for `text` (cached). */
export function parseSelector(text) {
  let parsed = cache.get(text);
  if (!parsed) {
    parsed = splitList(text).map(parseComplex);
    cache.set(text, parsed);
  }
  return parsed;
}

/** `[a, b, c]` specificity of one complex selector. */
export function specificity(steps) {
  const total = [0, 0, 0];
  const add = (s) => { total[0] += s[0]; total[1] += s[1]; total[2] += s[2]; };
  for (const { compound } of steps) {
    if (compound.id) total[0]++;
    total[1] += compound.classes.length + compound.attrs.length;
    if (compound.tag && compound.tag !== "*") total[2]++;
    for (const pseudo of compound.pseudos) {
      if (pseudo.name === "where") continue;
      if (pseudo.list) {
        const best = pseudo.list.map(specificity).sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])[0];
        add(best);
      } else total[1]++;
    }
  }
  return total;
}

function attrMatches(element, { name, op, value }) {
  const actual = element.getAttribute(name);
  if (actual === null || actual === undefined) return false;
  if (op === null) return true;
  switch (op) {
    case "=": return actual === value;
    case "^=": return value !== "" && actual.startsWith(value);
    case "$=": return value !== "" && actual.endsWith(value);
    case "*=": return value !== "" && actual.includes(value);
    case "~=": return actual.split(/\s+/).includes(value);
    case "|=": return actual === value || actual.startsWith(`${value}-`);
    default: return false;
  }
}

function siblingsOf(element) {
  return element.parentElement ? element.parentElement.children : [element];
}

/** Whether any element below `element` (its children, theirs, ...) satisfies `test`. */
function hasDescendant(element, test) {
  for (const child of element.children) if (test(child) || hasDescendant(child, test)) return true;
  return false;
}

function compoundMatches(element, compound, options, isSubject) {
  if (compound.tag && compound.tag !== "*" && element.tagName !== compound.tag) return false;
  if (compound.id && element.getAttribute("id") !== compound.id) return false;
  if (compound.classes.length) {
    const classes = element.classList ?? [];
    for (const name of compound.classes) if (!classes.includes(name)) return false;
  }
  for (const attr of compound.attrs) if (!attrMatches(element, attr)) return false;
  for (const pseudo of compound.pseudos) {
    switch (pseudo.name) {
      case "first-child": if (siblingsOf(element)[0] !== element) return false; break;
      case "only-child": if (siblingsOf(element).length !== 1) return false; break;
      case "last-child": { const list = siblingsOf(element); if (list[list.length - 1] !== element) return false; break; }
      case "nth-child": if (siblingsOf(element).indexOf(element) !== pseudo.n - 1) return false; break;
      case "root": if (!element.isDocumentRoot) return false; break;
      case "not": if (pseudo.list.some((steps) => complexMatches(element, steps, options, isSubject))) return false; break;
      case "has":
        // Its answer depends on the descendants: the element is marked so that adding or removing one below it bumps its
        // version (`dom.mjs`), and the style computed from it is computed again.
        element.watchesDescendants = true;
        if (!pseudo.list.some(([{ compound: inner }]) => hasDescendant(element, (d) => compoundMatches(d, inner, options, false)))) return false; break;
      case "is": case "where": if (!pseudo.list.some((steps) => complexMatches(element, steps, options, isSubject))) return false; break;
      default:
        if (!options.state || !options.state(element, pseudo.name, isSubject)) return false;
    }
  }
  return true;
}

function complexMatches(element, steps, options, isSubject = true) {
  const match = (el, index, subject) => {
    const { compound, combinator } = steps[index];
    if (!compoundMatches(el, compound, options, subject)) return false;
    if (index === 0) return true;
    if (combinator === ">") return !!el.parentElement && match(el.parentElement, index - 1, false);
    for (let up = el.parentElement; up; up = up.parentElement) if (match(up, index - 1, false)) return true;
    return false;
  };
  return match(element, steps.length - 1, isSubject);
}

/** Whether `element` matches `selector` (text or parsed list). */
export function matches(element, selector, options = {}) {
  const list = typeof selector === "string" ? parseSelector(selector) : selector;
  return list.some((steps) => complexMatches(element, steps, options));
}

/** Whether one parsed complex selector matches. */
export function matchesComplex(element, steps, options = {}) {
  return complexMatches(element, steps, options);
}

/** Every element under `root` (not `root` itself) matching `selector`, in document order. */
export function querySelectorAll(root, selector, options = {}) {
  const list = parseSelector(selector);
  const out = [];
  const walk = (el) => {
    for (const child of el.children) {
      if (list.some((steps) => complexMatches(child, steps, options))) out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}

/** The nearest of `element` and its ancestors matching `selector`, or null. */
export function closest(element, selector, options = {}) {
  const list = parseSelector(selector);
  for (let el = element; el; el = el.parentElement) if (list.some((steps) => complexMatches(el, steps, options))) return el;
  return null;
}
