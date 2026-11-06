// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Select, type SelectOption } from "./select";
import { openDropdown, optionLabels } from "./selectTesting";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const OPTIONS: SelectOption[] = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta", disabled: true },
  { value: "c", label: "Gamma" },
];
const key = (target: Element, name: string, init: KeyboardEventInit = {}) =>
  act(async () => { target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...init })); });
const listbox = () => document.querySelector('[role="listbox"]');

function Harness({ onChange = () => {}, onOuterKey = () => {}, freeText = false, onKeyDown }: { onChange?: (value: string) => void; onOuterKey?: () => void; freeText?: boolean; onKeyDown?: () => void }) {
  const [value, setValue] = useState(freeText ? "" : "a");
  return <div onKeyDown={onOuterKey}><label>Pick<Select ariaLabel="Pick" testId="pick" freeText={freeText} value={value} onChange={(next) => { setValue(next); onChange(next); }} options={OPTIONS} onKeyDown={onKeyDown} /></label><button type="button" data-testid="elsewhere">x</button></div>;
}

it("shows the selected label, opens a listbox tied to the trigger and picks by click", async () => {
  const onChange = vi.fn();
  act(() => root.render(<Harness onChange={onChange} />));
  const trigger = host.querySelector<HTMLElement>('[data-testid="pick"]')!;
  expect(trigger.textContent).toContain("Alpha");
  expect(optionLabels(await openDropdown(trigger))).toEqual(["Alpha", "Beta", "Gamma"]);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  await act(async () => document.querySelector<HTMLElement>('[role="option"][data-value="b"]')!.click());
  expect(onChange).not.toHaveBeenCalled(); // a disabled option cannot be picked
  expect(listbox()).not.toBeNull(); // and the list stays open
  await act(async () => document.querySelector<HTMLElement>('[role="option"][data-value="c"]')!.click());
  expect(onChange).toHaveBeenCalledWith("c");
  expect(listbox()).toBeNull();
  expect(trigger.textContent).toContain("Gamma");
});

it("opens from its label like a native select", async () => {
  act(() => root.render(<Harness />));
  await act(async () => { host.querySelector("label")!.click(); });
  expect(listbox()).not.toBeNull();
});

it("navigates with arrows past disabled options, Home/End and type-ahead; Enter picks", async () => {
  const onChange = vi.fn();
  act(() => root.render(<Harness onChange={onChange} />));
  const trigger = host.querySelector<HTMLElement>('[data-testid="pick"]')!;
  await key(trigger, "ArrowDown");
  expect(listbox()).not.toBeNull();
  await key(trigger, "ArrowDown"); // Beta is disabled
  await key(trigger, "Enter");
  expect(onChange).toHaveBeenLastCalledWith("c");
  await key(trigger, "ArrowDown");
  await key(trigger, "Home");
  await key(trigger, "Enter");
  expect(onChange).toHaveBeenLastCalledWith("a");
  await key(trigger, "ArrowUp");
  await key(trigger, "g");
  await key(trigger, "Enter");
  expect(onChange).toHaveBeenLastCalledWith("c");
});

it("Escape closes only the list; Tab and an outside press close it without choosing", async () => {
  const onChange = vi.fn();
  const outer = vi.fn();
  act(() => root.render(<Harness onChange={onChange} onOuterKey={outer} />));
  const trigger = host.querySelector<HTMLElement>('[data-testid="pick"]')!;
  await openDropdown(trigger);
  await key(trigger, "Escape");
  expect(listbox()).toBeNull();
  expect(outer).not.toHaveBeenCalled(); // an enclosing dialog must not see it
  await key(trigger, "Escape");
  expect(outer).toHaveBeenCalledTimes(1); // closed: Escape is the dialog's again
  await openDropdown(trigger);
  await key(trigger, "Tab");
  expect(listbox()).toBeNull();
  await openDropdown(trigger);
  await act(async () => { document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); });
  expect(listbox()).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
});

it("a press inside the list is not an outside press for a menu around the select", async () => {
  const outside = vi.fn();
  document.addEventListener("mousedown", outside);
  try {
    act(() => root.render(<Harness />));
    const trigger = host.querySelector<HTMLElement>('[data-testid="pick"]')!;
    await openDropdown(trigger);
    await act(async () => { document.querySelector('[role="option"]')!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })); });
    expect(outside).not.toHaveBeenCalled();
  } finally { document.removeEventListener("mousedown", outside); }
});

it("a click on an option does not reach the select's React ancestors through the portal", async () => {
  const ancestor = vi.fn();
  act(() => root.render(<div onClick={ancestor}><Harness /></div>));
  const trigger = host.querySelector<HTMLElement>('[data-testid="pick"]')!;
  await openDropdown(trigger);
  ancestor.mockClear();
  await act(async () => document.querySelector<HTMLElement>('[role="option"][data-value="c"]')!.click());
  expect(trigger.textContent).toContain("Gamma");
  expect(ancestor).not.toHaveBeenCalled();
});

it("slides a list wider than its trigger back inside the window", async () => {
  const innerWidth = Object.getOwnPropertyDescriptor(window, "innerWidth");
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 400 });
  const rects = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    // The trigger sits at the right edge; the list is 250px wide wherever it is placed.
    if (this.getAttribute("role") === "listbox") { const left = parseFloat(this.style.left); return { left, right: left + 250, width: 250, top: 0, bottom: 0, height: 0, x: left, y: 0, toJSON() {} } as DOMRect; }
    return { left: 330, right: 390, width: 60, top: 100, bottom: 130, height: 30, x: 330, y: 100, toJSON() {} } as DOMRect;
  });
  try {
    act(() => root.render(<Harness />));
    await openDropdown(host.querySelector('[data-testid="pick"]')!);
    const list = document.querySelector<HTMLElement>('[role="listbox"]')!;
    expect(list.style.width).toBe("max-content");
    expect(parseFloat(list.style.left) + 250).toBeLessThanOrEqual(400 - 8);
    expect(parseFloat(list.style.left)).toBeGreaterThanOrEqual(8);
  } finally {
    rects.mockRestore();
    if (innerWidth) Object.defineProperty(window, "innerWidth", innerWidth);
  }
});

it("free text accepts any value; Enter reaches the caller unless an arrow picked a suggestion", async () => {
  const onChange = vi.fn();
  const submit = vi.fn();
  act(() => root.render(<Harness freeText onChange={onChange} onKeyDown={submit} />));
  const input = host.querySelector<HTMLInputElement>('[data-testid="pick"]')!;
  const setText = (text: string) => act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await setText("deadbeef"); // not a suggestion: kept as typed
  expect(onChange).toHaveBeenLastCalledWith("deadbeef");
  expect(listbox()).toBeNull(); // nothing matches
  await key(input, "Enter");
  expect(submit).toHaveBeenCalledTimes(1);
  await setText("gam"); // narrows to Gamma
  expect(optionLabels([...document.querySelectorAll<HTMLElement>('[role="option"]')])).toEqual(["Gamma"]);
  await key(input, "Enter"); // nothing highlighted yet: still the caller's Enter
  expect(submit).toHaveBeenCalledTimes(2);
  await key(input, "ArrowDown");
  await key(input, "Enter");
  expect(onChange).toHaveBeenLastCalledWith("c");
  expect(submit).toHaveBeenCalledTimes(2); // accepting a suggestion does not also submit
  expect(input.value).toBe("c");
});
