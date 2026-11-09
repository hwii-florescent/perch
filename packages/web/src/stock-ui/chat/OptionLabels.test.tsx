// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { NativeUiOptions } from "@perch/shared";
import { expect, it, vi } from "vitest";
import { ModelPicker, OptionLabels, type OptionChange } from "./OptionLabels";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(node: React.ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(node));
  return { host, done: () => { act(() => root.unmount()); host.remove(); } };
}
function render(options?: NativeUiOptions, change?: OptionChange) {
  const view = mount(<OptionLabels options={options} change={change} />);
  const text = view.host.textContent;
  view.done();
  return text;
}

const pickers: NativeUiOptions = {
  model: "Opus 5.5",
  pickers: [
    { id: "model", label: "Model", current: "claude-opus-5-5", settable: true, choices: [{ value: "haiku", label: "Haiku" }, { value: "claude-opus-5-5", label: "Opus 5.5" }] },
    { id: "effort", label: "Effort", current: "high", settable: true, choices: [{ value: "low", label: "Low" }, { value: "high", label: "High" }] },
    { id: "mode", label: "Permissions", current: "ask", settable: true, choices: [{ value: "ask", label: "Ask for approval" }, { value: "plan", label: "Plan mode" }] },
  ],
};
const free: OptionChange = { enabled: true, busy: false, apply: () => {} };

it("says nothing when the CLI reported neither", () => {
  expect(render(undefined)).toBe("");
  expect(render({ model: "Haiku 4.5" })).toBe("");
});

it("shows the effort and mode the core worded, as plain text", () => {
  expect(render({ effort: "High", permissionMode: "Accept edits" })).toBe("HighAccept edits");
  expect(render({ permissionMode: "Full access" })).toBe("Full access");
});

it("stays plain text when the core does not offer the pickers", () => {
  // An older core or a remote host without `agent.ui.options` passes no change handler.
  expect(render({ ...pickers, effort: "High", permissionMode: "Ask for approval" })).toBe("HighAsk for approval");
});

it("shows a picker only for an option the core read back, each naming its current value", () => {
  const view = mount(<><ModelPicker options={pickers} change={free} /><OptionLabels options={pickers} change={free} /></>);
  const trigger = (id: string) => view.host.querySelector<HTMLButtonElement>(`[data-testid="native-cli-pick-${id}"]`);
  expect(trigger("model")?.textContent).toBe("Opus 5.5");
  expect(trigger("effort")?.textContent).toBe("High");
  expect(trigger("mode")?.textContent).toBe("Ask for approval");
  // No picker for an option the core did not offer: plain text.
  const partial = mount(<OptionLabels options={{ effort: "High", permissionMode: "Plan mode", pickers: [pickers.pickers![2]!] }} change={free} />);
  expect(partial.host.querySelector("[data-testid=native-cli-pick-effort]")).toBeNull();
  expect(partial.host.querySelector("[data-testid=native-cli-effort]")?.textContent).toBe("High");
  expect(partial.host.querySelector("[data-testid=native-cli-pick-mode]")).not.toBeNull();
  partial.done(); view.done();
});

it("applies a choice through the handler and never for the value already shown", () => {
  const apply = vi.fn();
  const view = mount(<OptionLabels options={pickers} change={{ ...free, apply }} />);
  const open = () => act(() => { view.host.querySelector<HTMLButtonElement>("[data-testid=native-cli-pick-effort]")!.click(); });
  open();
  const rows = () => Array.from(document.body.querySelectorAll<HTMLElement>("[role=option]"));
  act(() => { rows().find((row) => row.textContent?.startsWith("High"))!.click(); });
  expect(apply).not.toHaveBeenCalled();
  open();
  act(() => { rows().find((row) => row.textContent?.startsWith("Low"))!.click(); });
  expect(apply).toHaveBeenCalledExactlyOnceWith("effort", "low");
  view.done();
});

it("locks a picker while a turn runs, without control, or while a change is in flight", () => {
  const locked = (options: NativeUiOptions, change: OptionChange) => {
    const view = mount(<OptionLabels options={options} change={change} />);
    const disabled = Array.from(view.host.querySelectorAll<HTMLButtonElement>("button")).map((button) => button.disabled);
    view.done();
    return disabled;
  };
  expect(locked(pickers, free)).toEqual([false, false]);
  expect(locked(pickers, { ...free, enabled: false })).toEqual([true, true]);
  expect(locked(pickers, { ...free, busy: true })).toEqual([true, true]);
  const running: NativeUiOptions = { ...pickers, pickers: pickers.pickers!.map((picker) => ({ ...picker, settable: false })) };
  expect(locked(running, free)).toEqual([true, true]);
});
