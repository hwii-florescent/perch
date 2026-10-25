import { describe, expect, it } from "vitest";
import { TAB_PANE_CLASS, tabPaneStates } from "./tabPaneState";
import { resolveTheme, THEME_NAMES } from "./themes";
import type { SplitSet } from "./splitSets";

const pair: SplitSet = { ids: ["a", "b"], sizes: [0.5, 0.5], dir: "row" };
const states = (...args: Parameters<typeof tabPaneStates>) => Object.fromEntries(tabPaneStates(...args));

describe("tabPaneStates", () => {
  it("lights only the active tab when nothing is split", () => {
    expect(states([], ["a", "b", "c"], "b", null)).toEqual({ a: "hidden", b: "focused", c: "hidden" });
  });

  it("marks the other members of the visible split as visible, in either member's focus", () => {
    expect(states([pair], ["a", "b", "c"], "a", null)).toEqual({ a: "focused", b: "visible", c: "hidden" });
    expect(states([pair], ["a", "b", "c"], "b", null)).toEqual({ a: "visible", b: "focused", c: "hidden" });
  });

  it("ignores a split the active tab is not in, and members that left the strip", () => {
    expect(states([pair], ["a", "b", "c"], "c", null)).toEqual({ a: "hidden", b: "hidden", c: "focused" });
    expect(states([pair], ["a", "c"], "a", null)).toEqual({ a: "focused", c: "hidden" });
  });

  it("shows a zoomed pane alone", () => {
    expect(states([pair], ["a", "b"], "a", "a")).toEqual({ a: "focused", b: "hidden" });
    // A zoom left on another pane does not hide this split.
    expect(states([pair], ["a", "b"], "a", "b")).toEqual({ a: "focused", b: "visible" });
  });

  it("has no focus when no tab is active", () => {
    expect(states([pair], ["a", "b"], null, null)).toEqual({ a: "hidden", b: "hidden" });
  });
});

// Independent WCAG math, as in themes.test.ts.
const channel = (hex: string, i: number) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
const lum = (hex: string) => [0.2126, 0.7152, 0.0722].reduce((sum, weight, i) => {
  const v = channel(hex, i) / 255;
  return sum + weight * (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
}, 0);
const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const mix = (top: string, base: string, pct: number) =>
  `#${[0, 1, 2].map((i) => Math.round((channel(top, i) * pct + channel(base, i) * (100 - pct)) / 100).toString(16).padStart(2, "0")).join("")}`;
/** The text share of a tab state's `color-mix(in srgb, var(--text) N%, var(--panel-bg))` fill. */
const textShare = (state: "focused" | "visible") => Number(/color-mix\(in_srgb,var\(--text\)_(\d+)%,var\(--panel-bg\)\)/.exec(TAB_PANE_CLASS[state])?.[1]);

describe("tab fills", () => {
  it("uses a heavier weight for the focused tab only", () => {
    expect(TAB_PANE_CLASS.focused).toContain("font-semibold");
    expect(TAB_PANE_CLASS.visible).not.toContain("font-");
    expect(TAB_PANE_CLASS.hidden).not.toContain("font-");
    expect(textShare("focused")).toBeGreaterThan(textShare("visible"));
  });

  it.each(THEME_NAMES)("%s: stays readable and the visible/focused steps stay perceivable", (name) => {
    const p = resolveTheme(name);
    const visible = mix(p.text, p.panelBg, textShare("visible"));
    const focused = mix(p.text, p.panelBg, textShare("focused"));
    expect(contrast(p.subtext0, visible)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.text, focused)).toBeGreaterThanOrEqual(4.5);
    // Luminance ratios of fill against the shell; the weight change adds to the focus cue.
    expect(contrast(visible, p.panelBg)).toBeGreaterThanOrEqual(1.05);
    expect(contrast(focused, p.panelBg)).toBeGreaterThanOrEqual(1.1);
    expect(contrast(focused, visible)).toBeGreaterThanOrEqual(1.05);
  });
});
