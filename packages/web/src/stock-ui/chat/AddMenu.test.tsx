// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { NativeUiOptions } from "@perch/shared";
import { AddMenu } from "./AddMenu";
import { OptionLabels } from "./OptionLabels";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(node: React.ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(node));
  return { host, done: () => { act(() => root.unmount()); host.remove(); } };
}

it("opens from the plus, runs an entry and closes; a disabled entry does nothing", () => {
  const attach = vi.fn(), slash = vi.fn();
  const view = mount(<AddMenu disabled={false} entries={[{ id: "a", label: "Add files or photos", run: attach }, { id: "s", label: "Slash commands", disabled: true, run: slash }]} />);
  const items = () => Array.from(document.body.querySelectorAll<HTMLButtonElement>("[role=menuitem]"));
  expect(items()).toHaveLength(0);
  act(() => view.host.querySelector<HTMLButtonElement>("[data-testid=native-cli-add]")!.click());
  expect(items().map((item) => item.textContent)).toEqual(["Add files or photos", "Slash commands"]);
  act(() => items()[1]!.click());
  expect(slash).not.toHaveBeenCalled();
  act(() => items()[0]!.click());
  expect(attach).toHaveBeenCalledOnce();
  expect(items()).toHaveLength(0);
  view.done();
});

it("splits permissions from effort so the composer can place them apart", () => {
  const options: NativeUiOptions = { effort: "High", permissionMode: "Full access" };
  const text = (only: "effort" | "mode") => { const view = mount(<OptionLabels options={options} only={only} />); const out = view.host.textContent; view.done(); return out; };
  expect(text("mode")).toBe("Full access");
  expect(text("effort")).toBe("High");
});
