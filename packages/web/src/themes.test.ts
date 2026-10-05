import { describe, expect, it } from "vitest";
import { THEMES } from "./themes";

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// TabBar/WorkspaceTools draw operational text in subtext-0 on surface-0/panel-bg
// and the active tab's x hovers fg-on-panel-bg.
describe.each(Object.entries(THEMES))("%s contrast", (_name, p) => {
  it("subtext0 is never dimmer than overlay1 (up to 4.5:1) where the chrome uses it", () => {
    for (const bg of [p.surface0, p.panelBg]) {
      expect(contrast(p.subtext0, bg)).toBeGreaterThanOrEqual(Math.min(contrast(p.overlay1, bg), 4.5) - 0.01);
    }
  });
  it("the active tab's hovered x stays visible", () => {
    expect(contrast(p.text, p.panelBg)).toBeGreaterThanOrEqual(3);
  });
});
