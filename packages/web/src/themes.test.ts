// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { applyTheme, PERCH_DEFAULT, resolveTheme, THEMES } from "./themes";

// Independent WCAG calculation: test the resolved colors, not the adapter's
// own contrast function (nor a relative comparison that lets both be dim).
const lum = (hex: string) => [0.2126, 0.7152, 0.0722].reduce((sum, weight, i) => {
  const v = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
  return sum + weight * (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
}, 0);
const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const lightThemes = ["catppuccin-latte", "tokyo-night-day", "gruvbox-light", "one-light", "solarized-light", "kanagawa-lotus", "rose-pine-dawn"];

describe.each(Object.keys(THEMES))("%s theme", (name) => {
  it("keeps text, icons, statuses and links readable on every chrome surface", () => {
    const p = resolveTheme(name);
    for (const fg of [p.text, p.subtext0, p.overlay1, p.accent, p.mauve, p.green, p.yellow, p.red, p.blue, p.teal, p.peach]) {
      for (const bg of [p.panelBg, p.surface0, p.surface1, p.surfaceDim]) {
        expect(contrast(fg, bg), `${name}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    // The same pair is used in reverse by filled buttons and checked switches.
    for (const fill of [p.accent, p.red, p.green]) {
      expect(contrast(p.panelBg, fill)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("preserves source colors and never changes backgrounds to fix text", () => {
    const source = THEMES[name]!;
    const before = { ...source };
    const p = resolveTheme(name);
    expect(source).toEqual(before);
    for (const key of ["panelBg", "surface0", "surface1", "surfaceDim", "overlay0"] as const) {
      expect(p[key]).toBe(source[key]);
    }
    for (const value of Object.values(source)) expect(value).toMatch(/^#[0-9a-f]{6}$/);
    // Colors already meeting the floor must stay exactly upstream.
    if ([source.panelBg, source.surface0, source.surface1, source.surfaceDim].every((bg) => contrast(source.accent, bg) >= 4.5)) {
      expect(p.accent).toBe(source.accent);
    }
  });

  it("applies all tokens and native control appearance without stale colors", () => {
    applyTheme(name);
    const p = resolveTheme(name);
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--panel-bg")).toBe(p.panelBg);
    expect(style.getPropertyValue("--text")).toBe(p.text);
    expect(style.getPropertyValue("--green")).toBe(p.green);
    expect(style.getPropertyValue("--accent")).toBe(p.accent);
    expect(style.getPropertyValue("color-scheme")).toBe(lightThemes.includes(name) ? "light" : "dark");
  });
});

it("retains upstream identity colors and correct UI background/foreground mappings", () => {
  expect(THEMES.catppuccin?.accent).toBe("#89b4fa");
  expect(THEMES.dracula?.surface1).toBe("#44475a"); // selection, not comment blue
  expect(THEMES.solarized?.surface1).toBe("#004454"); // UI hover, not base01 text
  expect(THEMES.vesper?.panelBg).toBe("#101010");
  expect(THEMES["rose-pine-dawn"]?.text).toBe("#575279");
  expect(THEMES["rose-pine"]?.peach).toBe("#ebbcba");
  expect(THEMES["tokyo-night-day"]?.text).toBe("#343b59");
});

it("unknown names (including inherited object keys) fall back and reset light appearance", () => {
  for (const name of ["", "missing", "__proto__", "toString"]) {
    applyTheme("one-light");
    applyTheme(name);
    expect(resolveTheme(name)).toEqual(resolveTheme("perch"));
    expect(document.documentElement.style.getPropertyValue("color-scheme")).toBe("dark");
  }
});

it("the CSS defaults agree with the resolved neutral palette", () => {
  const { colorScheme, ...resolved } = resolveTheme("perch");
  expect(colorScheme).toBe("dark");
  expect(resolved).toEqual(PERCH_DEFAULT);
  const css = readFileSync("src/styles/base.css", "utf8");
  for (const [key, value] of Object.entries(PERCH_DEFAULT)) {
    const token = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`).replace(/([a-z])(\d)/g, "$1-$2");
    expect(css).toContain(`--${token}: ${value};`);
  }
});
