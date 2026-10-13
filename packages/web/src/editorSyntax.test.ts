// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { applyTheme, THEMES } from "./themes";
import { loadLanguage, SYNTAX_VARS, syntaxStyle } from "./editorSyntax";

const lum = (hex: string) => [0.2126, 0.7152, 0.0722].reduce((sum, weight, i) => {
  const c = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
  return sum + weight * (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
}, 0);
const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

describe("syntax colors", () => {
  it.each(Object.keys(THEMES))("%s: every syntax variable is a real token, readable on the editor surfaces", (theme) => {
    applyTheme(theme);
    const css = (name: string) => document.documentElement.style.getPropertyValue(`--${name}`);
    for (const name of SYNTAX_VARS) {
      expect(css(name), `--${name} is not written by applyTheme`).toMatch(/^#[0-9a-f]{6}$/);
      for (const bg of ["panel-bg", "surface-dim"]) {
        expect(contrast(css(name), css(bg)), `${theme}: --${name} on --${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("styles only with theme variables, never hex", () => {
    const colors = [...syntaxStyle.module!.getRules().matchAll(/color:\s*([^;]+)/g)].map((m) => m[1]!);
    expect(colors.length).toBeGreaterThan(0);
    for (const color of colors) expect(color).toMatch(/^var\(--/);
  });

  it("picks a language by filename; unknown or large files stay plain", async () => {
    expect((await loadLanguage("src/a.ts", false))?.language.name).toBe("typescript");
    expect((await loadLanguage("Cargo.toml", false))?.language.name).toBe("toml");
    expect(await loadLanguage("notes.txt", false)).toBeNull();
    expect(await loadLanguage("src/a.ts", true)).toBeNull();
  });
});
