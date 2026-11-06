// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CopyButton } from "./CopyButton";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
const button = () => host.querySelector("button") as HTMLButtonElement;
beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

it("copies the text it was given, says Copied for a moment, then goes back", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  act(() => root.render(<CopyButton text={"line one\n\n```ts\ncode\n```"} />));
  expect(button().getAttribute("aria-label")).toBe("Copy message");
  await act(async () => button().click());
  expect(writeText).toHaveBeenCalledWith("line one\n\n```ts\ncode\n```");
  expect(button().getAttribute("aria-label")).toBe("Copied");
  await act(async () => { vi.advanceTimersByTime(1600); });
  expect(button().getAttribute("aria-label")).toBe("Copy message");
});

it("stays as it was when the clipboard refuses", async () => {
  Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("not focused")) }, configurable: true });
  act(() => root.render(<CopyButton text="x" />));
  await act(async () => button().click());
  expect(button().getAttribute("aria-label")).toBe("Copy message");
});
