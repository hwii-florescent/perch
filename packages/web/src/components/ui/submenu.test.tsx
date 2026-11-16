// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Submenu } from "./submenu";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const key = (target: Element, name: string) =>
  act(() => { target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true })); });
const row = () => host.querySelector<HTMLButtonElement>('[data-testid="beside"]')!;
const list = () => host.querySelector<HTMLElement>('[role="menu"]')!;
const shown = () => list().className.split(/\s+/).includes("block");

it("opens beside its row from the keyboard, moves with the arrows and closes back to the row", () => {
  const picked = vi.fn();
  const outer = vi.fn();
  act(() => root.render(
    <div onKeyDown={outer}>
      <Submenu label="Show beside" testId="beside" items={[
        { key: "a", label: "Alpha", testId: "item-a", onSelect: () => picked("a") },
        { key: "b", label: "Beta", testId: "item-b", onSelect: () => picked("b") },
      ]} />
    </div>,
  ));
  // At rest only a hover shows the list; the row says it has one.
  expect(row().getAttribute("aria-haspopup")).toBe("menu");
  expect(row().getAttribute("aria-expanded")).toBe("false");
  expect(list().className).toContain("group-hover/submenu:block");
  expect(list().getAttribute("aria-label")).toBe("Show beside");

  row().focus();
  key(row(), "ArrowRight");
  expect(shown()).toBe(true);
  expect(row().getAttribute("aria-expanded")).toBe("true");
  expect(document.activeElement?.getAttribute("data-testid")).toBe("item-a");
  key(document.activeElement!, "ArrowDown");
  expect(document.activeElement?.getAttribute("data-testid")).toBe("item-b");
  key(document.activeElement!, "ArrowDown");
  expect(document.activeElement?.getAttribute("data-testid")).toBe("item-a");
  key(document.activeElement!, "ArrowUp");
  expect(document.activeElement?.getAttribute("data-testid")).toBe("item-b");

  // Escape closes only the list, not the menu around it.
  outer.mockClear();
  key(document.activeElement!, "Escape");
  expect(shown()).toBe(false);
  expect(document.activeElement).toBe(row());
  expect(outer).not.toHaveBeenCalled();

  // A click opens it too; a choice runs.
  act(() => row().click());
  expect(shown()).toBe(true);
  act(() => host.querySelector<HTMLButtonElement>('[data-testid="item-b"]')!.click());
  expect(picked).toHaveBeenCalledWith("b");
  key(host.querySelector('[data-testid="item-a"]')!, "ArrowLeft");
  expect(shown()).toBe(false);
});
