//! Renders each state of each screen in light and dark, headless WebKit at 2x, and writes the reference the native
//! client is checked against: `e2e/artifacts-native-parity/web/<screen>.<state>.<theme>.png` and `.json` (schema
//! `perch-native-parity/1`: every named element's box, text, colours with their theme tokens, and fonts). `compare.mjs`
//! checks a native rendering of the same schema against these.
import { expect, test, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const here = __dirname;
const OUT = path.resolve(here, "../artifacts-native-parity/web");
/** Every screen with a reference; `PARITY_SCREENS=tabs,status` renders only those while one is being worked on. */
const SCREENS = (process.env.PARITY_SCREENS ?? "sidebar,tabs,status,navigator,pane-header,pane-menu,confirm,dialog,toast,new-session,tab-menu").split(",");
const THEMES = ["light", "dark"] as const;
/** The semantic colour tokens (`--<name>` on `<html>`): `themes.ts` `TOKEN_CSS_VARS`, plus the two derived ones. */
const TOKENS = ["accent", "panel-bg", "surface-0", "surface-1", "surface-dim", "overlay-0", "overlay-1", "text", "subtext-0", "mauve", "green", "yellow", "red", "blue", "teal", "peach", "backdrop", "card-bg"];

interface KeySpec { self?: boolean; closest?: string; find?: string; attr: string; strip?: string }
interface ElementDef {
  name: string; selector: string; description: string; textSized?: boolean; text?: boolean; textRange?: boolean; hoverOnly?: boolean; key?: KeySpec;
}
/** `root`: the box boxes are measured against. `scope`: where elements are looked for when that is not inside the root
 * (a floating screen draws through a portal into `<body>`). `overflow`: boxes that must not scroll in the reference.
 * `minElements`: how many named elements a state must show at least. */
interface NamedScreen { root: string; scope?: string; overflow?: string[]; minElements?: number; elements: ElementDef[] }
const named = JSON.parse(fs.readFileSync(path.join(here, "named-elements.json"), "utf8")) as { screens: Record<string, NamedScreen> };

/** Runs in the page: boxes, text, colours with their tokens, and fonts of every named element instance. */
function measure({ rootSelector, scopeSelector, overflowSelectors, defs, tokens }: { rootSelector: string; scopeSelector: string; overflowSelectors: string[]; defs: ElementDef[]; tokens: string[] }) {
  const root = document.querySelector(rootSelector);
  if (!root) throw new Error(`no ${rootSelector}`);
  const scope = document.querySelector(scopeSelector);
  if (!scope) throw new Error(`no ${scopeSelector}`);
  const rootBox = root.getBoundingClientRect();
  const html = document.documentElement;
  const round = (n: number) => Math.round(n * 100) / 100;
  const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  const toHex = (css: string): string => {
    const value = css.trim().toLowerCase();
    if (value === "transparent") return "#00000000";
    const short = /^#([0-9a-f]{3})$/.exec(value);
    if (short) return `#${short[1]!.split("").map((c) => c + c).join("")}ff`;
    if (/^#[0-9a-f]{6}$/.test(value)) return `${value}ff`;
    if (/^#[0-9a-f]{8}$/.test(value)) return value;
    const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(value);
    if (rgb) {
      const a = rgb[4] === undefined ? 1 : rgb[4].endsWith("%") ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
      return `#${hex2(+rgb[1]!)}${hex2(+rgb[2]!)}${hex2(+rgb[3]!)}${hex2(a * 255)}`;
    }
    const srgb = /^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(value);
    if (srgb) {
      const a = srgb[4] === undefined ? 1 : srgb[4].endsWith("%") ? parseFloat(srgb[4]) / 100 : parseFloat(srgb[4]);
      return `#${hex2(+srgb[1]! * 255)}${hex2(+srgb[2]! * 255)}${hex2(+srgb[3]! * 255)}${hex2(a * 255)}`;
    }
    throw new Error(`cannot read the colour ${JSON.stringify(css)}`);
  };
  const hidden = (el: Element): boolean => {
    if (el.getClientRects().length === 0) return true;
    for (let n: Element | null = el; n && n !== root.parentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.opacity === "0" || cs.visibility === "hidden" || cs.display === "none") return true;
    }
    return false;
  };
  /** The element's own opacity times its ancestors' (a disabled row is 0.4); colours below are as computed, without it. */
  const opacityOf = (el: Element): number => {
    let product = 1;
    for (let n: Element | null = el; n && n !== root.parentElement; n = n.parentElement) product *= parseFloat(getComputedStyle(n).opacity);
    return round(product);
  };
  const keyOf = (el: Element, spec: ElementDef["key"]): string | null => {
    if (!spec) return null;
    const at = spec.self ? el : spec.closest ? el.closest(spec.closest) : spec.find ? el.querySelector(spec.find) : null;
    let value = at?.getAttribute(spec.attr) ?? null;
    if (value && spec.strip && value.startsWith(spec.strip)) value = value.slice(spec.strip.length);
    return value;
  };
  const collapse = (s: string) => s.replace(/\s+/g, " ").trim();
  const textNodes = (el: Element) => [...el.childNodes].filter((n): n is Text => n.nodeType === Node.TEXT_NODE && collapse(n.data) !== "");

  const COLOUR_PROPS = ["color", "backgroundColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"] as const;
  const BORDER_WIDTH = { borderTopColor: "borderTopWidth", borderRightColor: "borderRightWidth", borderBottomColor: "borderBottomWidth", borderLeftColor: "borderLeftWidth" } as const;
  const coloursOf = (el: Element, def: ElementDef): Record<string, string> => {
    const cs = getComputedStyle(el);
    const out: Record<string, string> = {};
    for (const prop of COLOUR_PROPS) {
      if (prop === "color" && !(def.text || el instanceof SVGElement)) continue;
      const hex = toHex(cs[prop]);
      if (prop !== "color" && hex.endsWith("00")) continue;
      if (prop in BORDER_WIDTH && !(parseFloat(cs[BORDER_WIDTH[prop as keyof typeof BORDER_WIDTH]]) > 0)) continue;
      out[prop] = hex;
    }
    return out;
  };

  // `line-height: normal` (buttons keep it) is the font's own metric: measure it with a probe in the same font.
  const normals = new Map<string, number>();
  const lineHeightOf = (cs: CSSStyleDeclaration): { value: number; normal: boolean } => {
    if (cs.lineHeight !== "normal") return { value: parseFloat(cs.lineHeight), normal: false };
    const id = `${cs.fontFamily}|${cs.fontSize}|${cs.fontWeight}|${cs.fontStyle}`;
    if (!normals.has(id)) {
      const probe = document.createElement("span");
      probe.textContent = "Hg";
      probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;line-height:normal;font:${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      root!.append(probe);
      normals.set(id, probe.getBoundingClientRect().height);
      probe.remove();
    }
    return { value: normals.get(id)!, normal: true };
  };

  const hiddenCounts: Record<string, number> = {};
  const found: { el: Element; def: ElementDef; index: number; key: string | null }[] = [];
  for (const def of defs) {
    let index = 0;
    for (const el of document.querySelectorAll(def.selector)) {
      if (!scope.contains(el)) continue;
      if (hidden(el)) { hiddenCounts[def.name] = (hiddenCounts[def.name] ?? 0) + 1; continue; }
      found.push({ el, def, index: index++, key: keyOf(el, def.key) });
    }
  }
  const real = found.map(({ el, def }) => coloursOf(el, def));

  // Which token a colour comes from: set every token to a colour of its own, read the same properties again, and
  // match by RGB (a mix with transparent keeps the token's RGB and changes only the alpha).
  const saved = tokens.map((name) => [name, html.style.getPropertyValue(`--${name}`)] as const);
  const realTokens: Record<string, string> = {};
  for (const name of tokens) realTokens[name] = toHex(getComputedStyle(html).getPropertyValue(`--${name}`));
  const sentinel = new Map<string, string>();
  tokens.forEach((name, i) => {
    const rgb = `${hex2(16 + i * 12)}${hex2(90)}${hex2(180)}`;
    sentinel.set(rgb, name);
    html.style.setProperty(`--${name}`, `#${rgb}`);
  });
  const provenance = found.map(({ el, def }) => {
    const out: Record<string, string | null> = {};
    for (const [prop, hex] of Object.entries(coloursOf(el, def))) out[prop] = sentinel.get(hex.slice(1, 7)) ?? null;
    return out;
  });
  for (const [name, value] of saved) {
    if (value) html.style.setProperty(`--${name}`, value);
    else html.style.removeProperty(`--${name}`);
  }

  const elements = found.map(({ el, def, index, key }, at) => {
    let box: DOMRect;
    let text: string | undefined;
    if (def.textRange) {
      const nodes = textNodes(el);
      const rects = nodes.map((n) => { const r = document.createRange(); r.selectNodeContents(n); return r.getBoundingClientRect(); });
      const left = Math.min(...rects.map((r) => r.left)), top = Math.min(...rects.map((r) => r.top));
      const right = Math.max(...rects.map((r) => r.right)), bottom = Math.max(...rects.map((r) => r.bottom));
      box = new DOMRect(left, top, right - left, bottom - top);
      text = collapse(nodes.map((n) => n.data).join(" "));
    } else {
      box = el.getBoundingClientRect();
      // A field's words are its value, not its (empty) content.
      if (def.text || def.textSized) text = collapse(el instanceof HTMLInputElement ? el.value : el.textContent ?? "");
    }
    const cs = getComputedStyle(el);
    const colors: Record<string, { value: string; token: string | null }> = {};
    for (const [prop, value] of Object.entries(real[at]!)) colors[prop] = { value, token: provenance[at]![prop] ?? null };
    const withText = def.text || def.textSized;
    const lineHeight = lineHeightOf(cs);
    return {
      name: def.name,
      key,
      index,
      box: { x: round(box.left - rootBox.left), y: round(box.top - rootBox.top), width: round(box.width), height: round(box.height) },
      textSized: !!def.textSized,
      ...(opacityOf(el) < 1 ? { opacity: opacityOf(el) } : {}),
      ...(text !== undefined ? { text } : {}),
      ...(el instanceof HTMLInputElement && el.placeholder ? { placeholder: el.placeholder } : {}),
      colors,
      ...(withText ? { font: { family: cs.fontFamily, size: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10), lineHeight: round(lineHeight.value), lineHeightNormal: lineHeight.normal } } : {}),
    };
  });
  const scroll = (selector: string) => { const el = document.querySelector(selector); return el ? el.scrollHeight > el.clientHeight : false; };
  return {
    rootBox: { width: round(rootBox.width), height: round(rootBox.height) },
    tokens: realTokens,
    elements,
    hiddenCounts,
    overflow: overflowSelectors.some(scroll),
    sdk: (window as unknown as { __PARITY_SDK__?: unknown }).__PARITY_SDK__ ?? null,
  };
}

async function open(page: Page, screen: string, state: string, theme: string) {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  page.on("console", (msg) => { if (msg.type() === "error") problems.push(`console error: ${msg.text()}`); });
  await page.goto(`/?screen=${screen}&state=${state}&theme=${theme}`);
  await page.waitForFunction(() => (window as unknown as { __PARITY_READY__?: boolean }).__PARITY_READY__ === true);
  // Nothing may move while it is measured or photographed.
  // The Mac draws scrollbars as overlays, only while scrolling: a resting screen has none.
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; } *::-webkit-scrollbar { display: none; }" });
  return problems;
}

for (const screen of SCREENS) {
  const fixture = JSON.parse(fs.readFileSync(path.join(here, "fixtures", `${screen}.json`), "utf8")) as { size: { width: number; height: number }; window: { width: number; height: number }; states: { id: string; size?: { width: number; height: number }; window?: { width: number; height: number } }[] };
  const def = named.screens[screen];
  if (!def) throw new Error(`named-elements.json has no entry for ${screen}`);
  for (const state of fixture.states) {
    for (const theme of THEMES) {
      test(`${screen} ${state.id} ${theme}`, async ({ page, browser }) => {
        fs.mkdirSync(OUT, { recursive: true });
        const size = state.size ?? fixture.size;
        const viewport = state.window ?? fixture.window;
        await page.setViewportSize(viewport);
        const problems = await open(page, screen, state.id, theme);
        const result = await page.evaluate(measure, { rootSelector: def.root, scopeSelector: def.scope ?? def.root, overflowSelectors: def.overflow ?? [], defs: def.elements, tokens: TOKENS });
        const base = path.join(OUT, `${screen}.${state.id}.${theme}`);
        await page.locator("[data-parity-card]").screenshot({ path: `${base}.png`, animations: "disabled", caret: "hide" });
        const doc = {
          schema: "perch-native-parity/1",
          screen,
          state: state.id,
          theme,
          renderer: `webkit ${browser.version()}`,
          size: { width: size.width, height: size.height, scale: 2 },
          window: viewport,
          tokens: result.tokens,
          elements: result.elements,
          hiddenCounts: result.hiddenCounts,
          sdk: result.sdk,
        };
        fs.writeFileSync(`${base}.json`, `${JSON.stringify(doc, null, 2)}\n`);

        expect(problems, "the page logged errors").toEqual([]);
        expect(result.rootBox).toEqual(size);
        expect(result.overflow, "the fixture is taller than the screen: it would scroll, which the reference does not show").toBe(false);
        expect(result.elements.length).toBeGreaterThanOrEqual(def.minElements ?? 1);
        for (const element of result.elements) {
          for (const v of Object.values(element.box)) expect(Number.isFinite(v), `${element.name} box`).toBe(true);
        }
      });
    }
  }
}
