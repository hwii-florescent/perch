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
import { parseComplex, splitList, specificity, matchesComplex, SelectorError, unescapeIdent } from "./selector.mjs";

/** The 18 theme tokens the parity reference names (`themes.ts` `TOKEN_CSS_VARS` and the two derived ones). */
export const THEME_TOKENS = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"];
const ROOT_FONT_SIZE = 16;
const INTERACTION = new Set(["hover", "focus", "focus-visible", "focus-within", "active"]);

/** WebKit's user-agent stylesheet for the tags a stock screen draws (`Source/WebCore/css/html.css`), trimmed to
 * them. `button` padding is WebKit's `2px 6px 3px` (the reference's host switcher shows it: chip at y 2, 5 px of
 * height around it). `-webkit-small-control` is 13.33 px in the system face. */
const UA_RULES = [
  ["html", { display: "block", "font-size": "16px", "font-family": "Times", color: "#000000", "line-height": "normal" }],
  ["body", { display: "block", margin: "8px" }],
  ["div, section, aside, p, nav, header, footer, main, ul, ol, li, form, label[hidden]", { display: "block" }],
  ["p", { "margin-top": "1em", "margin-bottom": "1em" }],
  ["strong, b", { "font-weight": "bold" }],
  ["em, i", { "font-style": "italic" }],
  ["kbd, code, samp, pre", { "font-family": "monospace" }],
  ["button, input, select, textarea", {
    display: "inline-block", "font-family": "system-ui", "font-size": "13.333333px", "font-weight": "400", "font-style": "normal",
    "line-height": "normal", "letter-spacing": "normal", "text-transform": "none", "text-indent": "0", "text-align": "start", margin: "0",
  }],
  ["button", {
    padding: "2px 6px 3px 6px", "border-width": "2px", "border-style": "outset", "border-color": "buttonborder", "background-color": "buttonface",
    color: "buttontext", "text-align": "center", cursor: "default", "box-sizing": "border-box",
  }],
  ["input", { padding: "1px 2px", "border-width": "2px", "border-style": "inset", "border-color": "buttonborder", "background-color": "field", color: "fieldtext" }],
  ["svg", { overflow: "hidden" }],
  ["[hidden]", { display: "none" }],
];
/** System colours as WebKit resolves them for `color-scheme: dark` (base.css sets it on `:root`). */
const SYSTEM_COLORS = {
  buttontext: [255, 255, 255, 1], buttonface: [107, 107, 107, 1], buttonborder: [107, 107, 107, 1], field: [59, 59, 59, 1], fieldtext: [255, 255, 255, 1],
  canvastext: [255, 255, 255, 1], canvas: [30, 30, 30, 1], black: [0, 0, 0, 1], white: [255, 255, 255, 1], red: [255, 0, 0, 1], transparent: [0, 0, 0, 0],
};

/** Properties that inherit (the ones a stock screen sets). */
export const INHERITED = new Set([
  "color", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "word-spacing", "text-transform", "text-align",
  "text-indent", "white-space", "visibility", "cursor", "font-variant-numeric", "overflow-wrap", "word-break", "pointer-events", "-webkit-touch-callout",
  "user-select", "-webkit-user-select", "color-scheme", "-webkit-tap-highlight-color", "accent-color",
]);
/** Initial values of the non-inherited properties the translator reads. */
export const INITIAL = {
  display: "inline", position: "static", top: "auto", right: "auto", bottom: "auto", left: "auto", "z-index": "auto",
  "flex-direction": "row", "flex-wrap": "nowrap", "align-items": "normal", "align-self": "auto", "justify-content": "normal", "justify-items": "legacy",
  "align-content": "normal", "flex-grow": "0", "flex-shrink": "1", "flex-basis": "auto", "row-gap": "normal", "column-gap": "normal",
  width: "auto", height: "auto", "min-width": "auto", "min-height": "auto", "max-width": "none", "max-height": "none",
  "margin-top": "0", "margin-right": "0", "margin-bottom": "0", "margin-left": "0",
  "padding-top": "0", "padding-right": "0", "padding-bottom": "0", "padding-left": "0",
  "border-top-width": "medium", "border-right-width": "medium", "border-bottom-width": "medium", "border-left-width": "medium",
  "border-top-style": "none", "border-right-style": "none", "border-bottom-style": "none", "border-left-style": "none",
  "border-top-color": "currentcolor", "border-right-color": "currentcolor", "border-bottom-color": "currentcolor", "border-left-color": "currentcolor",
  "border-top-left-radius": "0", "border-top-right-radius": "0", "border-bottom-right-radius": "0", "border-bottom-left-radius": "0",
  "background-color": "transparent", "background-image": "none", opacity: "1", "overflow-x": "visible", "overflow-y": "visible", "text-overflow": "clip",
  "box-shadow": "none", "outline-style": "none", "outline-width": "medium", "outline-color": "currentcolor", "outline-offset": "0",
  "transition-property": "all", "transition-duration": "0s", "box-sizing": "content-box", "text-decoration-line": "none",
  "-webkit-line-clamp": "none", "-webkit-box-orient": "horizontal", "container-type": "normal",
};
const INHERITED_INITIAL = {
  color: "canvastext", "font-family": "Times", "font-size": "16px", "font-weight": "400", "font-style": "normal", "line-height": "normal",
  "letter-spacing": "normal", "word-spacing": "normal", "text-transform": "none", "text-align": "start", "text-indent": "0", "white-space": "normal",
  visibility: "visible", cursor: "auto", "font-variant-numeric": "normal", "overflow-wrap": "normal", "word-break": "normal", "pointer-events": "auto",
  "-webkit-touch-callout": "default", "user-select": "auto", "-webkit-user-select": "auto", "color-scheme": "normal", "-webkit-tap-highlight-color": "transparent",
  "accent-color": "auto",
};
/** The order properties are computed in: font-size first (em, line-height), then color (currentcolor). */
const ORDER = ["font-size", "color", ...new Set([...Object.keys(INITIAL), ...Object.keys(INHERITED_INITIAL)].filter((p) => p !== "font-size" && p !== "color"))];
const ORDER_SET = new Set(ORDER);

// --------------------------------------------------------------------------------------------------------------
// Values.

/** Splits `text` at top-level occurrences of `sep` (whitespace when `sep` is " "). */
export function splitTop(text, sep = " ") {
  const parts = [];
  let depth = 0, current = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    const split = depth === 0 && (sep === " " ? /\s/.test(c) : c === sep);
    if (split) { if (current.trim() || sep !== " ") parts.push(current.trim()); current = ""; continue; }
    current += c;
  }
  if (current.trim() || (sep !== " " && parts.length)) parts.push(current.trim());
  return parts;
}

/** `var()` substituted from `lookup(name)` (null: not defined); null when a reference without fallback is missing. */
export function substitute(text, lookup, depth = 0) {
  if (depth > 32) return null;
  let out = "";
  let at = 0;
  for (;;) {
    const start = text.indexOf("var(", at);
    if (start < 0) { out += text.slice(at); return out; }
    out += text.slice(at, start);
    let depthParen = 1, end = start + 4;
    for (; end < text.length && depthParen; end++) {
      if (text[end] === "(") depthParen++;
      else if (text[end] === ")") depthParen--;
    }
    const inner = text.slice(start + 4, end - 1);
    const comma = splitTop(inner, ",");
    const name = comma[0].trim();
    const fallback = comma.length > 1 ? inner.slice(inner.indexOf(",") + 1).trim() : null;
    let value = lookup(name);
    if (value === null || value === undefined || value === "initial") value = fallback;
    if (value === null || value === undefined) return null;
    const resolved = substitute(value, lookup, depth + 1);
    if (resolved === null) return null;
    out += resolved;
    at = end;
  }
}

// ---- lengths: a tiny calc() evaluator over { px, pct } terms --------------------------------------------------

function tokenizeExpr(text) {
  const tokens = [];
  const re = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|[a-z]+)?|([a-z-]+)\(|(infinity)|([()+*/,])|(-)(?=\s))/giy;
  let m;
  let at = 0;
  while (at < text.length) {
    re.lastIndex = at;
    m = re.exec(text);
    if (!m || m.index !== at) {
      if (/^\s+$/.test(text.slice(at))) break;
      return null;
    }
    at = re.lastIndex;
    if (m[1] !== undefined) tokens.push({ num: parseFloat(m[1]), unit: (m[2] ?? "").toLowerCase() });
    else if (m[3]) tokens.push({ fn: m[3].toLowerCase() });
    else if (m[4]) tokens.push({ num: Infinity, unit: "" });
    else tokens.push({ op: m[5] ?? m[6] });
  }
  return tokens;
}

/** Evaluates a length expression: `{ px, pct, num }` (a percentage stays apart), or null. */
export function evalLength(text, ctx) {
  const tokens = tokenizeExpr(text.trim());
  if (!tokens) return null;
  let i = 0;
  const unitValue = ({ num, unit }) => {
    switch (unit) {
      case "": return { px: 0, pct: 0, num, unitless: true };
      case "px": return { px: num, pct: 0, num: 0 };
      case "rem": return { px: num * ROOT_FONT_SIZE, pct: 0, num: 0 };
      case "em": return { px: num * (ctx.fontSize ?? ROOT_FONT_SIZE), pct: 0, num: 0 };
      case "%": return { px: 0, pct: num, num: 0 };
      case "vh": case "dvh": case "svh": case "lvh": return { px: (num / 100) * (ctx.viewport?.height ?? 800), pct: 0, num: 0 };
      case "vw": case "dvw": case "svw": case "lvw": return { px: (num / 100) * (ctx.viewport?.width ?? 1000), pct: 0, num: 0 };
      case "pt": return { px: num * (4 / 3), pct: 0, num: 0 };
      default: return null;
    }
  };
  const add = (a, b, sign) => (a && b ? { px: a.px + sign * b.px, pct: a.pct + sign * b.pct, num: a.num + sign * b.num, unitless: a.unitless && b.unitless } : null);
  const scale = (a, k) => (a ? { px: a.px * k, pct: a.pct * k, num: a.num * k, unitless: a.unitless } : null);
  const isNumber = (a) => a && a.unitless;
  function primary() {
    const t = tokens[i++];
    if (!t) return null;
    if (t.num !== undefined) return unitValue(t);
    if (t.op === "(") { const v = sum(); if (tokens[i]?.op !== ")") return null; i++; return v; }
    if (t.op === "-" || t.op === "+") { const v = primary(); return t.op === "-" ? scale(v, -1) : v; }
    if (t.fn) {
      const args = [];
      for (;;) {
        args.push(sum());
        const next = tokens[i++];
        if (!next) return null;
        if (next.op === ")") break;
        if (next.op !== ",") return null;
      }
      if (args.some((a) => !a)) return null;
      if (t.fn === "calc") return args[0];
      const comparable = args.every((a) => !a.pct) || args.every((a) => !a.px && !a.num);
      if (!comparable) return null;
      const key = (a) => a.px + a.pct + a.num;
      if (t.fn === "min") return args.reduce((a, b) => (key(b) < key(a) ? b : a));
      if (t.fn === "max") return args.reduce((a, b) => (key(b) > key(a) ? b : a));
      if (t.fn === "clamp" && args.length === 3) return key(args[1]) < key(args[0]) ? args[0] : key(args[1]) > key(args[2]) ? args[2] : args[1];
      return null;
    }
    return null;
  }
  function product() {
    let v = primary();
    while (tokens[i] && (tokens[i].op === "*" || tokens[i].op === "/")) {
      const op = tokens[i++].op;
      const r = primary();
      if (!v || !r) return null;
      if (op === "*") v = isNumber(r) ? scale(v, r.num) : isNumber(v) ? scale(r, v.num) : null;
      else v = isNumber(r) && r.num !== 0 ? scale(v, 1 / r.num) : null;
    }
    return v;
  }
  function sum() {
    let v = product();
    while (tokens[i] && (tokens[i].op === "+" || tokens[i].op === "-")) {
      const op = tokens[i++].op;
      v = add(v, product(), op === "-" ? -1 : 1);
    }
    return v;
  }
  const v = sum();
  if (i !== tokens.length || !v) return null;
  return v;
}

/** A length as the translator reads it: `{ px }`, `{ pct }`, a keyword, or `{ expr }` when it cannot be reduced to
 * one of those (a percentage plus pixels, `fit-content`, ...). */
export function parseLength(text, ctx) {
  const t = text.trim().toLowerCase();
  if (/^(auto|none|normal|fit-content|max-content|min-content|medium|thin|thick)$/.test(t)) {
    if (t === "thin") return { px: 1 };
    if (t === "medium") return { px: 3 };
    if (t === "thick") return { px: 5 };
    return t;
  }
  const v = evalLength(t, ctx);
  if (!v) return { expr: text.trim() };
  if (v.unitless) return v.num === 0 ? { px: 0 } : { expr: text.trim() };
  if (v.pct && (v.px || v.num)) return { expr: text.trim() };
  if (v.pct) return { pct: v.pct };
  return { px: clampPx(v.px) };
}
const clampPx = (px) => (Number.isFinite(px) ? px : px > 0 ? 3.4e38 : -3.4e38);

// ---- colours ----------------------------------------------------------------------------------------------------

const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
/** `#rrggbbaa`, lower case, alpha as `round(a * 255)` (the reference's serialisation). */
export const toHex = ([r, g, b, a]) => `#${hex2(r)}${hex2(g)}${hex2(b)}${hex2(a * 255)}`;

function parseHex(hex) {
  const h = hex.slice(1);
  const full = h.length <= 4 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(full)) return null;
  const n = (i) => parseInt(full.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), full.length === 8 ? n(6) / 255 : 1];
}

/** A colour: `{ rgba: [r, g, b, a], token }` (`token`: the theme token it came from, or null), `"currentcolor"`, or
 * null when unreadable. `theme(name)` is a token's hex. */
export function parseColor(text, theme) {
  const t = text.trim().toLowerCase();
  if (t === "currentcolor") return "currentcolor";
  const token = /^perchtoken\(([a-z0-9-]+)\)$/.exec(t);
  if (token) {
    const hex = theme(token[1]);
    const rgba = hex && parseHex(hex);
    return rgba ? { rgba, token: token[1] } : null;
  }
  if (t.startsWith("#")) { const rgba = parseHex(t); return rgba ? { rgba, token: null } : null; }
  if (SYSTEM_COLORS[t]) return { rgba: [...SYSTEM_COLORS[t]], token: null };
  const fn = /^(rgba?|color-mix)\((.*)\)$/s.exec(t);
  if (!fn) return null;
  if (fn[1] === "color-mix") {
    const parts = splitTop(fn[2], ",");
    if (parts.length !== 3 || !/^in\s+(srgb|srgb-linear|oklab|lab|oklch|lch|hsl|xyz)/.test(parts[0])) return null;
    const read = (part) => {
      const pieces = splitTop(part);
      const pctAt = pieces.findIndex((p) => /%$/.test(p));
      const pct = pctAt >= 0 ? parseFloat(pieces[pctAt]) / 100 : null;
      const color = parseColor(pieces.filter((_, k) => k !== pctAt).join(" "), theme);
      return { color, pct };
    };
    const a = read(parts[1]), b = read(parts[2]);
    if (!a.color || !b.color || a.color === "currentcolor" || b.color === "currentcolor") return null;
    let p1 = a.pct, p2 = b.pct;
    if (p1 === null && p2 === null) { p1 = 0.5; p2 = 0.5; } else if (p1 === null) p1 = 1 - p2; else if (p2 === null) p2 = 1 - p1;
    const sum = p1 + p2;
    const scaleAlpha = sum < 1 ? sum : 1;
    p1 /= sum; p2 /= sum;
    const [r1, g1, b1, a1] = a.color.rgba, [r2, g2, b2, a2] = b.color.rgba;
    const alpha = a1 * p1 + a2 * p2;
    // Premultiplied interpolation: mixing with transparent keeps the other colour's channels.
    const ch = (c1, c2) => (alpha === 0 ? 0 : (c1 * a1 * p1 + c2 * a2 * p2) / alpha);
    const rgba = [ch(r1, r2), ch(g1, g2), ch(b1, b2), alpha * scaleAlpha];
    const tokenOf = a2 === 0 ? a.color.token : a1 === 0 ? b.color.token : null;
    return { rgba, token: tokenOf };
  }
  const args = fn[2].includes(",") ? splitTop(fn[2], ",") : splitTop(fn[2].replace("/", " / ")).filter((p) => p !== "/");
  if (args.length < 3) return null;
  const channel = (v) => (v.endsWith("%") ? (parseFloat(v) / 100) * 255 : parseFloat(v));
  const alpha = args[3] === undefined ? 1 : args[3].endsWith("%") ? parseFloat(args[3]) / 100 : parseFloat(args[3]);
  const rgba = [channel(args[0]), channel(args[1]), channel(args[2]), alpha];
  return rgba.some((n) => Number.isNaN(n)) ? null : { rgba, token: null };
}

// ---- shorthands ----------------------------------------------------------------------------------------------------

const SIDES = ["top", "right", "bottom", "left"];
const CORNERS = ["top-left", "top-right", "bottom-right", "bottom-left"];
const four = (parts) => [parts[0], parts[1] ?? parts[0], parts[2] ?? parts[0], parts[3] ?? parts[1] ?? parts[0]];
const BORDER_STYLES = new Set(["none", "hidden", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]);

/** The longhands a declaration sets, as `[property, value]` pairs; a property this engine does not expand is kept. */
export function expand(prop, value) {
  const v = value.trim();
  const parts = () => splitTop(v);
  switch (prop) {
    case "padding": case "margin": { const p = four(parts()); return SIDES.map((s, k) => [`${prop}-${s}`, p[k]]); }
    case "padding-inline": case "margin-inline": { const p = parts(); const base = prop.split("-")[0]; return [[`${base}-left`, p[0]], [`${base}-right`, p[1] ?? p[0]]]; }
    case "padding-block": case "margin-block": { const p = parts(); const base = prop.split("-")[0]; return [[`${base}-top`, p[0]], [`${base}-bottom`, p[1] ?? p[0]]]; }
    case "padding-inline-start": case "margin-inline-start": return [[`${prop.split("-")[0]}-left`, v]];
    case "padding-inline-end": case "margin-inline-end": return [[`${prop.split("-")[0]}-right`, v]];
    case "padding-block-start": case "margin-block-start": return [[`${prop.split("-")[0]}-top`, v]];
    case "padding-block-end": case "margin-block-end": return [[`${prop.split("-")[0]}-bottom`, v]];
    case "inset": { const p = four(parts()); return SIDES.map((s, k) => [s, p[k]]); }
    case "inset-inline": { const p = parts(); return [["left", p[0]], ["right", p[1] ?? p[0]]]; }
    case "inset-block": { const p = parts(); return [["top", p[0]], ["bottom", p[1] ?? p[0]]]; }
    case "inset-inline-start": return [["left", v]];
    case "inset-inline-end": return [["right", v]];
    case "border-width": case "border-style": case "border-color": {
      const kind = prop.split("-")[1];
      const p = four(parts());
      return SIDES.map((s, k) => [`border-${s}-${kind}`, p[k]]);
    }
    case "border": case "border-top": case "border-right": case "border-bottom": case "border-left":
    case "border-inline": case "border-block": case "border-inline-start": case "border-inline-end": {
      const sides = prop === "border" ? SIDES : prop === "border-inline" ? ["left", "right"] : prop === "border-block" ? ["top", "bottom"]
        : prop === "border-inline-start" ? ["left"] : prop === "border-inline-end" ? ["right"] : [prop.slice(7)];
      let width = "medium", style = "none", color = "currentcolor";
      if (v !== "none" && v !== "0") {
        for (const p of parts()) {
          if (BORDER_STYLES.has(p)) style = p;
          else if (/^(thin|medium|thick|-?[\d.]|calc\()/.test(p)) width = p;
          else color = p;
        }
      } else if (v === "0") width = "0";
      return sides.flatMap((s) => [[`border-${s}-width`, width], [`border-${s}-style`, style], [`border-${s}-color`, color]]);
    }
    case "border-inline-width": { const p = parts(); return [["border-left-width", p[0]], ["border-right-width", p[1] ?? p[0]]]; }
    case "border-block-width": { const p = parts(); return [["border-top-width", p[0]], ["border-bottom-width", p[1] ?? p[0]]]; }
    case "border-inline-style": { const p = parts(); return [["border-left-style", p[0]], ["border-right-style", p[1] ?? p[0]]]; }
    case "border-inline-color": { const p = parts(); return [["border-left-color", p[0]], ["border-right-color", p[1] ?? p[0]]]; }
    case "border-radius": { const p = four(splitTop(v.split("/")[0])); return CORNERS.map((c, k) => [`border-${c}-radius`, p[k]]); }
    case "border-start-start-radius": return [["border-top-left-radius", v]];
    case "border-start-end-radius": return [["border-top-right-radius", v]];
    case "border-end-start-radius": return [["border-bottom-left-radius", v]];
    case "border-end-end-radius": return [["border-bottom-right-radius", v]];
    case "background": {
      if (v === "none") return [["background-color", "transparent"], ["background-image", "none"]];
      const color = parseColor(v, () => "#000000");
      return color ? [["background-color", v], ["background-image", "none"]] : [["background-color", "transparent"], ["background-image", v]];
    }
    case "overflow": { const p = parts(); return [["overflow-x", p[0]], ["overflow-y", p[1] ?? p[0]]]; }
    case "gap": { const p = parts(); return [["row-gap", p[0]], ["column-gap", p[1] ?? p[0]]]; }
    case "grid-gap": return expand("gap", v);
    case "place-items": { const p = parts(); return [["align-items", p[0]], ["justify-items", p[1] ?? p[0]]]; }
    case "place-self": { const p = parts(); return [["align-self", p[0]], ["justify-self", p[1] ?? p[0]]]; }
    case "place-content": { const p = parts(); return [["align-content", p[0]], ["justify-content", p[1] ?? p[0]]]; }
    case "flex": {
      if (v === "none") return [["flex-grow", "0"], ["flex-shrink", "0"], ["flex-basis", "auto"]];
      if (v === "auto") return [["flex-grow", "1"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      if (v === "initial") return [["flex-grow", "0"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
      const p = parts();
      const nums = p.filter((x) => /^[\d.]+$/.test(x));
      const basis = p.find((x) => !/^[\d.]+$/.test(x));
      return [["flex-grow", nums[0] ?? "1"], ["flex-shrink", nums[1] ?? "1"], ["flex-basis", basis ?? (nums.length ? "0%" : "auto")]];
    }
    case "flex-flow": {
      const out = [];
      for (const p of parts()) out.push(/wrap/.test(p) ? ["flex-wrap", p] : ["flex-direction", p]);
      return out;
    }
    case "outline": {
      if (v === "none" || v === "0") return [["outline-style", "none"], ["outline-width", "medium"], ["outline-color", "currentcolor"]];
      let width = "medium", style = "none", color = "currentcolor";
      for (const p of parts()) {
        if (BORDER_STYLES.has(p) || p === "auto") style = p;
        else if (/^(thin|medium|thick|-?[\d.]|calc\()/.test(p)) width = p;
        else color = p;
      }
      return [["outline-width", width], ["outline-style", style], ["outline-color", color]];
    }
    case "transition": {
      if (v === "none") return [["transition-property", "none"], ["transition-duration", "0s"]];
      const items = splitTop(v, ",");
      const props = items.map((item) => splitTop(item).find((p) => !/^[\d.]+m?s$/.test(p) && !/^(ease|linear|step|cubic)/.test(p)) ?? "all");
      const durations = items.map((item) => splitTop(item).find((p) => /^[\d.]+m?s$/.test(p)) ?? "0s");
      return [["transition-property", props.join(", ")], ["transition-duration", durations.join(", ")]];
    }
    case "text-decoration": return [["text-decoration-line", parts()[0] ?? "none"]];
    case "-webkit-user-select": return [["user-select", v]];
    case "word-wrap": return [["overflow-wrap", v]];
    default: return [[prop, v]];
  }
}

// --------------------------------------------------------------------------------------------------------------
// Media and the stylesheet.

/** Whether a media query list holds for `viewport` (a desktop pointer: `hover: hover`, `pointer: fine`, screen). */
export function mediaMatches(query, viewport) {
  if (!query) return true;
  return splitTop(query, ",").some((one) => {
    let text = one.trim().toLowerCase();
    let negate = false;
    if (text.startsWith("not ")) { negate = true; text = text.slice(4); }
    if (text.startsWith("only ")) text = text.slice(5);
    const result = text.split(/\s+and\s+/).every((part) => {
      part = part.trim();
      if (part === "all" || part === "screen") return true;
      if (part === "print") return false;
      const m = /^\((.+)\)$/.exec(part);
      if (!m) return false;
      const inner = m[1].trim();
      const feature = /^([a-z-]+)\s*:\s*(.+)$/.exec(inner);
      if (feature) {
        const [, name, raw] = feature;
        const px = (x) => { const l = parseLength(x, { viewport }); return typeof l === "object" && "px" in l ? l.px : NaN; };
        switch (name) {
          case "min-width": return viewport.width >= px(raw);
          case "max-width": return viewport.width <= px(raw);
          case "min-height": return viewport.height >= px(raw);
          case "max-height": return viewport.height <= px(raw);
          case "hover": case "any-hover": return raw.trim() === "hover";
          case "pointer": case "any-pointer": return raw.trim() === "fine";
          case "prefers-reduced-motion": return raw.trim() === "no-preference";
          case "prefers-color-scheme": return raw.trim() === (viewport.dark === false ? "light" : "dark");
          default: return false;
        }
      }
      const range = /^(width|height)\s*(>=|<=|>|<|=)\s*(.+)$/.exec(inner);
      if (range) {
        const size = range[1] === "width" ? viewport.width : viewport.height;
        const limit = parseLength(range[3], { viewport });
        const n = typeof limit === "object" && "px" in limit ? limit.px : NaN;
        switch (range[2]) {
          case ">=": return size >= n;
          case "<=": return size <= n;
          case ">": return size > n;
          case "<": return size < n;
          default: return size === n;
        }
      }
      return false;
    });
    return negate ? !result : result;
  });
}

/** The class a selector's subject names first, for the unsupported list (`hover:bg-surface-1`), or the selector. */
function sourceName(selectorText, steps) {
  const subject = steps[steps.length - 1].compound;
  return compoundClasses(subject)[0] ?? selectorText;
}

/** Interaction pseudo-classes a complex selector uses, on its subject and on an ancestor. */
function statesOf(steps) {
  const subject = new Set(), ancestor = new Set();
  const visit = (list, isSubjectCompound) => {
    list.forEach(({ compound }, k) => {
      const subjectHere = isSubjectCompound && k === list.length - 1;
      for (const pseudo of compound.pseudos) {
        if (INTERACTION.has(pseudo.name)) (subjectHere ? subject : ancestor).add(pseudo.name);
        if (pseudo.list && pseudo.name !== "not") for (const inner of pseudo.list) visit(inner, subjectHere);
      }
    });
  };
  visit(steps, true);
  return { subject, ancestor };
}

/** A compound's classes, with those of a one-compound `:is()`/`:where()` inside it (`:where(.group\/ph):hover`). */
function compoundClasses(compound) {
  const out = [...compound.classes];
  for (const pseudo of compound.pseudos) {
    if (pseudo.name !== "is" && pseudo.name !== "where") continue;
    for (const inner of pseudo.list) if (inner.length === 1) out.push(...compoundClasses(inner[0].compound));
  }
  return out;
}

/** `state:class` for every compound that carries an ancestor interaction state (`.group\/row:hover *` gives
 * `hover:group/row`). */
function ancestorStateClasses(steps, out) {
  const visit = (list, isSubjectCompound) => {
    list.forEach(({ compound }, k) => {
      const subjectHere = isSubjectCompound && k === list.length - 1;
      const own = compound.pseudos.filter((p) => INTERACTION.has(p.name)).map((p) => p.name);
      if (!subjectHere) for (const state of own) for (const cls of compoundClasses(compound)) out.add(`${state}:${cls}`);
      for (const pseudo of compound.pseudos) if (pseudo.list && pseudo.name !== "not") for (const inner of pseudo.list) visit(inner, subjectHere);
    });
  };
  visit(steps, true);
}

/**
 * The compiled stylesheet, ready to match. `table` is what `build.mjs` writes: `rules` as `[selector, media, layer,
 * decls]` (`media`: the media query lists the rule sits in, all of which must hold, or null; `layer`: the cascade
 * layer's rank, higher wins, unlayered rules above every layer; `decls`: `[property, value, important]`),
 * `properties` (`@property` initial values) and `layers` (names, for diagnostics). A selector list is matched one
 * complex selector at a time, so one this engine cannot read (`::before`, `:host`) costs only itself (`skipped`).
 */
export class StyleSheet {
  constructor(table) {
    this.properties = table.properties ?? {};
    this.rules = [];
    this.skipped = 0;
    this.index = new Map();
    /** `state:class` pairs whose element's interaction state a descendant's rule reads (`hover:group/row`). */
    this.trackedStates = new Set();
    const add = (entry, steps) => {
      const subject = steps[steps.length - 1].compound;
      const key = subject.classes.length ? `.${subject.classes[0]}` : subject.tag && subject.tag !== "*" ? subject.tag : "*";
      if (!this.index.has(key)) this.index.set(key, []);
      this.index.get(key).push(entry);
    };
    let order = 0;
    const ingest = (rules, origin) => {
      for (const [selectorText, media, layer, decls] of rules) {
        for (const part of splitList(selectorText)) {
          let steps;
          try { steps = parseComplex(part); } catch (error) {
            if (error instanceof SelectorError) { this.skipped++; continue; }
            throw error;
          }
          const states = statesOf(steps);
          ancestorStateClasses(steps, this.trackedStates);
          const entry = { steps, media, layer, origin, order: order++, specificity: specificity(steps), decls, states, source: origin === 0 ? `ua:${steps[steps.length - 1].compound.tag ?? "*"}` : sourceName(part, steps) };
          this.rules.push(entry);
          add(entry, steps);
        }
      }
    };
    ingest(UA_RULES.map(([selector, decls]) => [selector, null, 0, Object.entries(decls)]), 0);
    ingest(table.rules, 1);
  }

  /** Rules that may match `element` (by its classes, its tag, and the universal ones). */
  candidates(element) {
    const out = [];
    const seen = new Set();
    const push = (list) => { if (list) for (const rule of list) if (!seen.has(rule)) { seen.add(rule); out.push(rule); } };
    for (const cls of element.classList) push(this.index.get(`.${cls}`));
    push(this.index.get(element.tagName));
    push(this.index.get("*"));
    return out;
  }

  /** Whether `element` carries a class whose interaction state some rule reads on an ancestor. */
  tracks(element, state) {
    for (const cls of element.classList) if (this.trackedStates.has(`${state}:${cls}`)) return true;
    return false;
  }
}

// --------------------------------------------------------------------------------------------------------------
// Computing a style.

const UNITLESS = new Set(["opacity", "z-index", "flex-grow", "flex-shrink", "font-weight", "line-height", "flex", "order", "-webkit-line-clamp", "zoom"]);
/** React's inline `style` object as declarations (`minWidth: 200` is `min-width: 200px`). */
export function inlineDeclarations(style) {
  if (!style || typeof style !== "object") return [];
  const out = [];
  for (const [key, raw] of Object.entries(style)) {
    if (raw === null || raw === undefined || raw === "" || typeof raw === "boolean") continue;
    const prop = key.startsWith("--") ? key : key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-");
    const value = typeof raw === "number" && raw !== 0 && !UNITLESS.has(prop) && !prop.startsWith("--") ? `${raw}px` : String(raw);
    out.push([prop, value]);
  }
  return out;
}

/** SVG presentation attributes that size an `<svg>` (below every author rule). */
function presentational(element) {
  if (element.tagName !== "svg") return [];
  const out = [];
  for (const name of ["width", "height"]) {
    const value = element.getAttribute(name);
    if (value !== null) out.push([name, /^[\d.]+$/.test(value) ? `${value}px` : value]);
  }
  return out;
}

const compareRank = (a, b) => (a.important - b.important) || (a.origin - b.origin) || (a.layer - b.layer)
  || (a.specificity[0] - b.specificity[0]) || (a.specificity[1] - b.specificity[1]) || (a.specificity[2] - b.specificity[2]) || (a.order - b.order);

/**
 * Computes element styles against one sheet, theme and viewport. `compute(element, parentStyle, states)` gives the
 * element's computed style: `values` (property -> parsed value), `sources` (property -> where the winning declaration
 * came from: a class, `style`, or `ua:<tag>`), `own` (properties the element declares itself), `customs` (custom
 * properties) and `rules` (every rule that matched, with the interaction states it needed).
 */
export class Cascade {
  constructor(sheet, { theme, viewport }) {
    this.sheet = sheet;
    this.theme = theme;
    this.viewport = viewport;
    this.parsed = new Map();
  }

  themeHex(name) { return this.theme?.[name] ?? null; }

  /** Rules matching `element`; `assume` is the set of interaction states assumed on the element itself
   * (`"*"`: any, for finding variant rules). Ancestors use their real state. */
  matching(element, assume) {
    const state = (el, name, isSubject) => {
      if (name === "disabled") return !!el.props?.disabled && ["button", "input", "select", "textarea", "fieldset"].includes(el.tagName);
      if (name === "enabled") return !el.props?.disabled && ["button", "input", "select", "textarea"].includes(el.tagName);
      if (name === "checked") return !!el.props?.checked;
      if (assume === "*") return true;
      if (name === "focus-within") {
        // From the focused element, on the subject too: the engine has no focus-within style.
        const active = el.ownerDocument?.activeElement;
        return !!active && active !== el.ownerDocument.body && typeof el.contains === "function" && el.contains(active);
      }
      if (isSubject) return assume.has(name);
      if (name === "focus-visible") return !!el.state?.focus;
      return !!el.state?.[name];
    };
    return this.sheet.candidates(element).filter((rule) => (!rule.media || rule.media.every((query) => mediaMatches(query, this.viewport))) && matchesComplex(element, rule.steps, { state }));
  }

  compute(element, parent, assume = new Set()) {
    const rules = this.matching(element, assume);
    const declared = [];
    for (const rule of rules) {
      for (const [prop, value, important] of rule.decls) declared.push({ prop, value, important: important ? 1 : 0, origin: rule.origin === 0 ? 0 : 2, layer: rule.layer, specificity: rule.specificity, order: rule.order, source: rule.source });
    }
    for (const [prop, value] of presentational(element)) declared.push({ prop, value, important: 0, origin: 1, layer: 0, specificity: [0, 0, 0], order: 0, source: `attr:${prop}` });
    for (const [prop, value] of inlineDeclarations(element.props?.style)) declared.push({ prop, value, important: 0, origin: 3, layer: 0, specificity: [1, 0, 0], order: 0, source: "style" });
    declared.sort(compareRank);

    // Custom properties. Inheriting ones chain to the parent's (a prototype chain, so nothing is copied); a
    // registered non-inheriting one (`@property ... inherits: false`, Tailwind's `--tw-*`) is the element's own
    // value or its initial value, never the parent's.
    const registered = this.sheet.properties;
    const customs = Object.create(parent?.customs ?? null);
    const local = new Map();
    const rawCustoms = new Map();
    for (const d of declared) if (d.prop.startsWith("--")) rawCustoms.set(d.prop, d.value);
    // The theme is set on the root's inline style (applyTheme), above any rule.
    if (!parent && this.theme) for (const name of THEME_TOKENS) if (this.theme[name]) rawCustoms.set(`--${name}`, `perchtoken(${name})`);
    const lookup = (name) => {
      if (local.has(name)) return local.get(name);
      const def = registered[name];
      if (def && !def.inherits) return def.initial ?? null;
      return name in customs ? customs[name] : (def?.initial ?? null);
    };
    const resolving = new Set();
    const resolveCustom = (name) => {
      if (!rawCustoms.has(name)) return lookup(name);
      if (resolving.has(name)) return null;
      resolving.add(name);
      const out = substitute(rawCustoms.get(name), resolveCustom);
      resolving.delete(name);
      rawCustoms.delete(name);
      local.set(name, out);
      if (!registered[name] || registered[name].inherits) customs[name] = out;
      return out;
    };
    for (const name of [...rawCustoms.keys()]) resolveCustom(name);

    // Longhands, in cascade order: later wins.
    const specified = new Map();
    for (const d of declared) {
      if (d.prop.startsWith("--")) continue;
      const value = substitute(d.value, lookup);
      if (value === null) {
        for (const [prop] of expand(d.prop, "unset")) specified.set(prop, { value: "unset", source: d.source, origin: d.origin });
        continue;
      }
      for (const [prop, v] of expand(d.prop, value)) specified.set(prop, { value: v, source: d.source, origin: d.origin });
    }

    const values = {};
    const sources = {};
    const own = new Set();
    const inherited = new Set();
    const parentValues = parent?.values;
    // font-size first: em and line-height depend on it.
    const ctx = { fontSize: parentValues?.["font-size"] ?? ROOT_FONT_SIZE, viewport: this.viewport };
    const parse = (prop, text) => {
      // Most values repeat (`0`, `auto`, a utility's length): parse each once per font size. A colour that reads
      // `currentcolor` depends on the element, so it is parsed every time.
      if (/currentcolor/i.test(text)) return this.parseValue(prop, text, ctx, values, parentValues);
      const key = `${prop}\u0000${text}\u0000${ctx.fontSize}`;
      let value = this.parsed.get(key);
      if (value === undefined) this.parsed.set(key, (value = this.parseValue(prop, text, ctx, values, parentValues)));
      return value;
    };
    const ordered = specified.size ? [...ORDER, ...[...specified.keys()].filter((p) => !ORDER_SET.has(p))] : ORDER;
    for (const prop of ordered) {
      const spec = specified.get(prop);
      let text = spec?.value;
      const inherits = INHERITED.has(prop);
      if (text === undefined || text === "unset" || text === "revert" || text === "revert-layer") text = inherits ? "inherit" : "initial";
      if (spec) { sources[prop] = spec.source; if (spec.origin !== 0) own.add(prop); }
      if (text === "inherit" && parentValues && prop in parentValues) {
        values[prop] = parentValues[prop];
        inherited.add(prop);
        continue;
      }
      if (text === "inherit" || text === "initial") text = inherits ? INHERITED_INITIAL[prop] : INITIAL[prop];
      values[prop] = parse(prop, text);
      if (prop === "font-size") ctx.fontSize = values["font-size"];
    }
    // Used values that depend on others.
    for (const side of SIDES) {
      const style = values[`border-${side}-style`];
      if (style === "none" || style === "hidden") values[`border-${side}-width`] = { px: 0 };
    }
    if (values["outline-style"] === "none") values["outline-width"] = { px: 0 };
    const parentDisplay = parentValues?.display;
    if ((parentDisplay === "flex" || parentDisplay === "inline-flex" || parentDisplay === "grid" || parentDisplay === "inline-grid") && values.position !== "absolute" && values.position !== "fixed") {
      values.display = blockify(values.display);
    }
    if (values.position === "absolute" || values.position === "fixed") values.display = blockify(values.display);
    return { values, sources, own, inherited, customs, rules, element };
  }

  parseValue(prop, text, ctx, values, parentValues) {
    const t = String(text).trim();
    switch (prop) {
      case "font-size": {
        const lower = t.toLowerCase();
        const keywords = { "xx-small": 9, "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
        if (keywords[lower]) return keywords[lower];
        if (lower === "smaller") return ctx.fontSize / 1.2;
        if (lower === "larger") return ctx.fontSize * 1.2;
        const v = evalLength(lower, { fontSize: ctx.fontSize, viewport: ctx.viewport });
        if (!v || v.num) return ctx.fontSize;
        return v.px + (v.pct / 100) * ctx.fontSize;
      }
      case "font-weight": {
        const lower = t.toLowerCase();
        if (lower === "normal") return 400;
        if (lower === "bold") return 700;
        if (lower === "bolder") return (parentValues?.["font-weight"] ?? 400) >= 600 ? 900 : 700;
        if (lower === "lighter") return (parentValues?.["font-weight"] ?? 400) >= 600 ? 400 : 100;
        const n = parseFloat(lower);
        return Number.isFinite(n) ? n : 400;
      }
      case "line-height": {
        const lower = t.toLowerCase();
        if (lower === "normal") return { normal: true };
        const v = evalLength(lower, { fontSize: ctx.fontSize, viewport: ctx.viewport });
        if (!v) return { normal: true };
        if (v.unitless) return { factor: v.num };
        return { px: v.px + (v.pct / 100) * ctx.fontSize };
      }
      case "font-family": return t;
      case "opacity": case "flex-grow": case "flex-shrink": {
        const n = t.endsWith("%") ? parseFloat(t) / 100 : parseFloat(t);
        return Number.isFinite(n) ? n : parseFloat(prop === "flex-shrink" ? 1 : prop === "opacity" ? 1 : 0);
      }
      case "color": {
        const c = parseColor(t, (name) => this.themeHex(name));
        if (c === "currentcolor" || !c) return parentValues?.color ?? { rgba: [0, 0, 0, 1], token: null };
        return c;
      }
      case "background-color": case "border-top-color": case "border-right-color": case "border-bottom-color": case "border-left-color":
      case "outline-color": {
        const c = parseColor(t, (name) => this.themeHex(name));
        if (c === "currentcolor") return values.color;
        return c ?? { rgba: [0, 0, 0, 0], token: null, unreadable: t };
      }
      case "width": case "height": case "min-width": case "min-height": case "max-width": case "max-height":
      case "flex-basis": case "row-gap": case "column-gap": case "top": case "right": case "bottom": case "left":
      case "margin-top": case "margin-right": case "margin-bottom": case "margin-left":
      case "padding-top": case "padding-right": case "padding-bottom": case "padding-left":
      case "border-top-width": case "border-right-width": case "border-bottom-width": case "border-left-width":
      case "border-top-left-radius": case "border-top-right-radius": case "border-bottom-right-radius": case "border-bottom-left-radius":
      case "outline-width": case "outline-offset": case "letter-spacing": case "word-spacing": case "text-indent":
        return parseLength(t, ctx);
      default: return t.toLowerCase().startsWith("var(") ? t : (/^[a-z-]+$/i.test(t) ? t.toLowerCase() : t);
    }
  }
}

function blockify(display) {
  if (display === "inline" || display === "inline-block" || display === "contents") return "block";
  if (display === "inline-flex") return "flex";
  if (display === "inline-grid") return "grid";
  return display;
}

/** A computed colour as the reference writes it: `{ value: "#rrggbbaa", token }`. */
export const colorOut = (c) => (c && c.rgba ? { value: toHex(c.rgba), token: c.token ?? null } : null);

/** WebKit's `line-height: normal` for the system UI face, measured in the reference (font size -> px). Other sizes
 * use 1.2x; the engine measures the real face (`perch` reports it) once it draws text. */
const NORMAL_LINE_HEIGHT = { 9.28: 11, 9.92: 12, 10.4: 12, 10.88: 13, 11: 13, 11.2: 13, 11.52: 13, 12: 15, 12.5: 15, 13: 16, 14: 17, 16: 19 };
export function normalLineHeight(size, measure) {
  const measured = measure?.(size);
  if (Number.isFinite(measured)) return measured;
  const key = Math.round(size * 100) / 100;
  return NORMAL_LINE_HEIGHT[key] ?? Math.round(size * 1.2);
}

/** The used line height in px. */
export function lineHeightPx(values, measure) {
  const lh = values["line-height"];
  const size = values["font-size"];
  if (lh.normal) return normalLineHeight(size, measure);
  if (lh.factor !== undefined) return lh.factor * size;
  return lh.px;
}

/** The family list as WebKit serialises it (quotes dropped). */
export const familyOut = (family) => splitTop(family, ",").map((f) => f.trim().replace(/^["']|["']$/g, "")).join(", ");

export { unescapeIdent };
