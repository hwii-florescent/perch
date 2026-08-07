import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { computeAnchoredPopoverStyle } from "./popoverPosition";

// No jsdom here: the function only touches `window.innerWidth/innerHeight`
// and an anchor's `getBoundingClientRect()`, so a plain object stub is
// enough — cheaper than pulling in a full DOM for one arithmetic helper.
function fakeAnchor(rect: Partial<DOMRect>): HTMLElement {
  const full: DOMRect = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    toJSON() {
      return this;
    },
    ...rect,
  };
  return { getBoundingClientRect: () => full } as unknown as HTMLElement;
}

describe("computeAnchoredPopoverStyle", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;

  beforeEach(() => {
    (globalThis as { window?: unknown }).window = { innerWidth: 1000, innerHeight: 800 };
  });

  afterEach(() => {
    (globalThis as { window?: unknown }).window = originalWindow;
  });

  it("places the popover above the anchor when there's enough room", () => {
    const anchor = fakeAnchor({ top: 400, bottom: 420, left: 100, right: 200 });
    const style = computeAnchoredPopoverStyle(anchor);
    expect(style.position).toBe("fixed");
    expect(style.bottom).toBe(800 - 400 + 6); // vh - rect.top + GAP
    expect(style.top).toBeUndefined();
  });

  it("flips below the anchor when there's not enough room above", () => {
    // Anchor near the top of the viewport — spaceAbove < default minSpaceAbove (100).
    const anchor = fakeAnchor({ top: 20, bottom: 40, left: 100, right: 200 });
    const style = computeAnchoredPopoverStyle(anchor);
    expect(style.top).toBe(40 + 6); // rect.bottom + GAP
    expect(style.bottom).toBeUndefined();
  });

  it("respects a custom minSpaceAbove threshold", () => {
    const anchor = fakeAnchor({ top: 150, bottom: 170, left: 0, right: 100 });
    // Space above is 150 - 6 - 8 = 136, which clears the default 100 but not
    // a caller-supplied 200.
    const above = computeAnchoredPopoverStyle(anchor, { minSpaceAbove: 100 });
    expect(above.top).toBeUndefined();
    const below = computeAnchoredPopoverStyle(anchor, { minSpaceAbove: 200 });
    expect(below.bottom).toBeUndefined();
  });

  it("aligns to the right edge by default, measuring from the viewport's right side", () => {
    const anchor = fakeAnchor({ top: 400, bottom: 420, left: 700, right: 900 });
    const style = computeAnchoredPopoverStyle(anchor);
    expect(style.right).toBe(1000 - 900);
    expect(style.left).toBeUndefined();
  });

  it("aligns to the left edge when align: 'left' is passed", () => {
    const anchor = fakeAnchor({ top: 400, bottom: 420, left: 50, right: 150 });
    const style = computeAnchoredPopoverStyle(anchor, { align: "left" });
    expect(style.left).toBe(50);
    expect(style.right).toBeUndefined();
  });

  it("clamps the edge offset to zero rather than going negative", () => {
    // right edge past the viewport width
    const anchor = fakeAnchor({ top: 400, bottom: 420, left: 950, right: 1200 });
    const style = computeAnchoredPopoverStyle(anchor);
    expect(style.right).toBe(0);
  });

  it("uses the provided minWidth, defaulting to 220", () => {
    const anchor = fakeAnchor({ top: 400, bottom: 420, left: 100, right: 200 });
    expect(computeAnchoredPopoverStyle(anchor).minWidth).toBe(220);
    expect(computeAnchoredPopoverStyle(anchor, { minWidth: 300 }).minWidth).toBe(300);
  });

  it("caps maxHeight at 75% of the viewport even with generous space", () => {
    const anchor = fakeAnchor({ top: 10000, bottom: 10020, left: 0, right: 100 });
    const style = computeAnchoredPopoverStyle(anchor);
    expect(style.maxHeight).toBe(800 * 0.75);
  });
});
