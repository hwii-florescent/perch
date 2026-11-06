import { act } from "react";

/** Test driver for `Select`: its list is a portal, found through the trigger's `aria-controls`. */
export async function openDropdown(trigger: Element): Promise<HTMLElement[]> {
  await act(async () => { (trigger as HTMLElement).click(); });
  const id = trigger.getAttribute("aria-controls");
  return id ? [...document.querySelectorAll<HTMLElement>("[role=option]")].filter((option) => option.parentElement?.id === id) : [];
}

export const optionLabels = (options: HTMLElement[]) => options.map((option) => option.querySelector("span")?.textContent ?? "");

export async function chooseDropdown(trigger: Element, value: string): Promise<void> {
  const option = (await openDropdown(trigger)).find((candidate) => candidate.dataset.value === value);
  if (!option) throw new Error(`no option ${value}`);
  await act(async () => { option.click(); });
}
