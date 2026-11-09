// @vitest-environment jsdom
import { expect, it } from "vitest";
import { installContextMenuGuard } from "./contextMenuGuard";

it("swallows a pointer-less contextmenu only while a terminal has focus", () => {
  document.body.innerHTML = `<div class="xterm"><textarea id="t"></textarea></div><button id="b"></button>`;
  const seen: boolean[] = [];
  const onMenu = (e: Event) => seen.push(e.defaultPrevented);
  const button = document.getElementById("b")!;
  button.addEventListener("contextmenu", onMenu);
  const stop = installContextMenuGuard();
  const fire = () => button.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));

  document.getElementById("t")!.focus();
  fire(); // Ctrl+Enter in the terminal, pointer parked over the button
  expect(seen).toEqual([]);

  document.dispatchEvent(new Event("pointerdown")); // a real right-click
  fire();
  expect(seen).toEqual([false]);
  document.dispatchEvent(new Event("pointerup"));

  button.focus(); // keyboard menu key outside a terminal stays accessible
  document.dispatchEvent(new Event("pointerup"));
  seen.length = 0;
  fire();
  expect(seen).toEqual([false]);
  stop();
});
