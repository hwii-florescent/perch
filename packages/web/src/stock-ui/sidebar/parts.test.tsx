// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { longPress, RowMenu } from "./parts";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("a hold opens the menu, the click that ends it chooses nothing wherever it lands, and the next tap is the person's", () => {
  vi.useFakeTimers();
  try {
    const item = document.createElement("button");
    document.body.append(item);
    const chosen = vi.fn();
    item.addEventListener("click", chosen);
    const opened = vi.fn();
    const hold = longPress(opened);
    hold.onPointerDown({ pointerType: "touch", clientX: 5, clientY: 5 } as never);
    vi.advanceTimersByTime(450);
    expect(opened).toHaveBeenCalledWith(5, 5);
    // The browser's click for the lifted finger lands on the menu item now under it.
    item.click();
    expect(chosen).not.toHaveBeenCalled();
    // A real tap later: a new press, then its click.
    window.dispatchEvent(new Event("pointerdown"));
    item.click();
    expect(chosen).toHaveBeenCalledTimes(1);
    // A browser that sends no click after a hold: the next tap is still the person's.
    hold.onPointerDown({ pointerType: "touch", clientX: 5, clientY: 5 } as never);
    vi.advanceTimersByTime(450);
    window.dispatchEvent(new Event("pointerdown"));
    item.click();
    expect(chosen).toHaveBeenCalledTimes(2);
    // A mouse never holds.
    hold.onPointerDown({ pointerType: "mouse", clientX: 5, clientY: 5 } as never);
    vi.advanceTimersByTime(1000);
    expect(opened).toHaveBeenCalledTimes(2);
    item.remove();
  } finally {
    vi.useRealTimers();
  }
});

it("a row menu opened by a hold stays open when the finger lifts, and a new press outside closes it", () => {
  const row = document.createElement("div");
  document.body.append(row);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onClose = vi.fn();
  const onSelect = vi.fn();
  act(() => root.render(<RowMenu x={10} y={10} label="Workspace actions" items={[{ label: "Files", testId: "menu-files", onSelect }]} onClose={onClose} />));
  const press = (target: Element, type: string) => act(() => void target.dispatchEvent(new Event(type, { bubbles: true })));

  // Lifting the finger that held the row open: the browser's compatibility mousedown lands on the row.
  press(row, "mousedown");
  expect(onClose).not.toHaveBeenCalled();
  // A press inside the menu is the menu's own.
  press(document.querySelector("[data-testid=menu-files]")!, "pointerdown");
  expect(onClose).not.toHaveBeenCalled();
  // A new press anywhere else closes it.
  press(row, "pointerdown");
  expect(onClose).toHaveBeenCalledTimes(1);

  act(() => root.unmount());
  host.remove();
  row.remove();
});
