/**
 * Driver for Perch's own dropdown (`components/ui/select.tsx`), which replaced the browser's `<select>`.
 * Its trigger is a `role=combobox` button carrying `data-value`; its list is a portal tied to the
 * trigger by `aria-controls`, so options are found through that id, never by an unscoped selector.
 */
import { expect, type Locator } from "@playwright/test";

/** Open the trigger's list (if it is not already open) and return its options. */
export async function openList(trigger: Locator): Promise<Locator> {
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const id = (await trigger.getAttribute("aria-controls"))!;
  return trigger.page().locator(`[role="listbox"][id="${id}"]`).locator('[role="option"]');
}

/** `selectOption`: open, click the option with this value (or position), expect the list to close.
 * Clicking waits for a disabled option to become enabled, as an option's `aria-disabled` is honoured. */
export async function choose(trigger: Locator, value: string | { index: number }): Promise<void> {
  const options = await openList(trigger);
  const index = typeof value === "string"
    ? await options.evaluateAll((elements, wanted) => elements.findIndex((element) => (element as HTMLElement).dataset.value === wanted), value)
    : value.index;
  if (index < 0) throw new Error(`no option ${JSON.stringify(value)} in ${await options.evaluateAll((elements) => JSON.stringify(elements.map((element) => (element as HTMLElement).dataset.value)))}`);
  await options.nth(index).click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
}

/** `toHaveValue` for a dropdown trigger. */
export const expectChoice = (trigger: Locator, value: string, options?: { timeout?: number }) => expect(trigger).toHaveAttribute("data-value", value, options);

export interface OptionState { value: string; text: string; disabled: boolean }

/** Each option's value, label and disabled state; leaves the list closed. */
export async function optionStates(trigger: Locator): Promise<OptionState[]> {
  const options = await openList(trigger);
  const states = await options.evaluateAll((elements) => elements.map((element) => ({
    value: (element as HTMLElement).dataset.value ?? "",
    text: element.querySelector("span")?.textContent ?? "",
    disabled: element.getAttribute("aria-disabled") === "true",
  })));
  await trigger.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  return states;
}

/** The option with this value, read fresh each call (for `expect.poll`). */
export async function optionState(trigger: Locator, value: string): Promise<OptionState | undefined> {
  return (await optionStates(trigger)).find((option) => option.value === value);
}
