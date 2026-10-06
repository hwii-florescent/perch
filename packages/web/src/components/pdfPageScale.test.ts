import { describe, expect, it } from "vitest";
import { pageScale } from "./pdfPageScale";

const letter = { width: 612, height: 792 };

describe("pageScale", () => {
  it("fits the width minus the margin, and honours an explicit zoom", () => {
    expect(pageScale(letter, "fit", 636, 1)).toBeCloseTo(1);
    expect(pageScale(letter, "1.5", 1000, 1)).toBe(1.5);
    expect(pageScale(letter, "fit", 0, 1)).toBeCloseTo(1 / 612);
  });

  it("keeps the backing canvas within the pixel budget", () => {
    const poster = { width: 5000, height: 5000 };
    for (const ratio of [1, 2]) {
      const scale = pageScale(poster, "2", 800, ratio);
      const backingPixels = poster.width * scale * ratio * poster.height * scale * ratio;
      expect(backingPixels).toBeLessThanOrEqual(16_777_216 * (1 + 1e-9));
    }
  });

  it("applies the device ratio to the caps", () => {
    const poster = { width: 5000, height: 5000 };
    expect(pageScale(poster, "2", 800, 2)).toBeCloseTo(pageScale(poster, "2", 800, 1) / 2);
  });

  it("binds the per-side cap before the area cap on a tall narrow page", () => {
    const tall = { width: 100, height: 10_000 };
    expect(pageScale(tall, "2", 800, 1)).toBeCloseTo(8192 / 10_000);
  });
});
