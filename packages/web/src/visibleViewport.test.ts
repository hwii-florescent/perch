// @vitest-environment jsdom
import { expect, it } from "vitest";
import { trackVisibleViewport } from "./visibleViewport";

it("follows the visual viewport as the keyboard opens and closes, and stops when told", () => {
  const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0 }) as unknown as VisualViewport;
  const root = document.createElement("div");
  Object.assign(window, { innerHeight: 844 });
  const stop = trackVisibleViewport(root, viewport);
  expect(root.style.getPropertyValue("--visible-height")).toBe("844px");

  // The keyboard opens: iOS shrinks the visual viewport and pans it down.
  Object.assign(viewport, { height: 520, offsetTop: 40 });
  viewport.dispatchEvent(new Event("resize"));
  expect(root.style.getPropertyValue("--visible-height")).toBe("520px");
  expect(root.style.getPropertyValue("--visible-top")).toBe("40px");
  expect(root.hasAttribute("data-keyboard")).toBe(true);

  // It pans without resizing (the user drags the page).
  Object.assign(viewport, { offsetTop: 0 });
  viewport.dispatchEvent(new Event("scroll"));
  expect(root.style.getPropertyValue("--visible-top")).toBe("0px");

  // A browser toolbar sliding away is not a keyboard.
  Object.assign(viewport, { height: 800 });
  viewport.dispatchEvent(new Event("resize"));
  expect(root.hasAttribute("data-keyboard")).toBe(false);

  stop();
  Object.assign(viewport, { height: 300 });
  viewport.dispatchEvent(new Event("resize"));
  expect(root.style.getPropertyValue("--visible-height")).toBe("");
});

it("does nothing where the browser has no visual viewport", () => {
  expect(trackVisibleViewport(document.createElement("div"), null)).toBeTypeOf("function");
});
