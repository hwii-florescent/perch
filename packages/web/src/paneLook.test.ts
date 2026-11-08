import { afterEach, describe, expect, it } from "vitest";
import { getPaneLook, setPaneLook, STOCK_PANE_LOOK } from "./paneLook";

afterEach(() => setPaneLook(null));

describe("pane look", () => {
  it("takes what the layout sets, treats unset fields as stock, and goes back to stock", () => {
    expect(getPaneLook()).toEqual({ gap: 6, lone: false, headerAt: "top", headerReveal: "always", headerHeight: 28 });
    setPaneLook({ gap: 2, headerAt: "bottom", headerReveal: "hover", background: "#101010" });
    expect(getPaneLook()).toMatchObject({ gap: 2, headerAt: "bottom", headerReveal: "hover", background: "#101010", headerHeight: 28 });
    setPaneLook({ gap: undefined, lone: true }); // a layout that drops a field gets the stock value, not the old one
    expect(getPaneLook()).toEqual({ ...STOCK_PANE_LOOK, lone: true });
    setPaneLook(null);
    expect(getPaneLook()).toEqual(STOCK_PANE_LOOK);
  });
});
