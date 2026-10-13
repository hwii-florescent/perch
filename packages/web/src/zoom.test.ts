import { describe, expect, it } from "vitest";
import { setZoomLevel, zoomFactor, zoomIn, zoomOut, zoomReset } from "./zoom";

describe("zoom", () => {
  it("scales 1.2x per level and clamps", () => {
    zoomReset();
    expect(zoomFactor()).toBe(1);
    zoomIn();
    expect(zoomFactor()).toBe(1.2);
    zoomOut(); zoomOut();
    expect(zoomFactor()).toBe(0.833);
    setZoomLevel(99);
    expect(zoomFactor()).toBe(zoomFactor(8));
    setZoomLevel(-99);
    expect(zoomFactor()).toBe(zoomFactor(-5));
    zoomReset();
  });
});
