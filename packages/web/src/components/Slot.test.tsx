// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claimSlot } from "../slots";
import { Slot } from "./Slot";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const show = (data: Record<string, unknown>, open = vi.fn()) =>
  act(async () => root.render(<Slot name="session-row" data={data} actions={{ open }}><b>stock</b></Slot>));

describe("a slot in Perch's own interface", () => {
  it("shows the stock part until a mod claims it, redraws on new data, and gives it back on release", async () => {
    const open = vi.fn();
    await show({ title: "one" }, open);
    expect(host.textContent).toBe("stock");

    const cleanup = vi.fn();
    let release = () => {};
    await act(async () => {
      release = claimSlot("session-row", "m", (el, { data, actions }) => {
        el.textContent = `mod ${String(data.title)}`;
        el.onclick = () => actions.open?.();
        return cleanup;
      });
    });
    expect(host.textContent).toBe("mod one");
    (host.querySelector("[data-slot]") as HTMLElement).click();
    expect(open).toHaveBeenCalledTimes(1);

    await show({ title: "two" }, open);
    expect(host.textContent).toBe("mod two");
    expect(cleanup).toHaveBeenCalledTimes(1); // the old draw is cleaned up before the new one

    await act(async () => release());
    expect(host.textContent).toBe("stock");
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it("falls back to the stock part when the mod throws, and tries again when the mod changes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await show({ title: "x" });
    let release = () => {};
    await act(async () => { release = claimSlot("session-row", "bad", () => { throw new Error("boom"); }); });
    expect(host.textContent).toBe("stock");
    let releaseGood = () => {};
    await act(async () => { releaseGood = claimSlot("session-row", "good", (el) => { el.textContent = "fixed"; }); });
    expect(host.textContent).toBe("fixed");
    release(); // a replaced claim cannot release the newer one
    await act(async () => {});
    expect(host.textContent).toBe("fixed");
    await act(async () => releaseGood());
  });

  it("refuses a slot that does not exist and lists the real ones", () => {
    expect(() => claimSlot("nope", "m", () => {})).toThrow(/session-row/);
  });
});
