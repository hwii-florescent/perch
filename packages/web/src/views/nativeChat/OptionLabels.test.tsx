// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { OptionLabels } from "./OptionLabels";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(options?: Parameters<typeof OptionLabels>[0]["options"]) {
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<OptionLabels options={options} />));
  const text = host.textContent;
  act(() => root.unmount());
  return text;
}

it("says nothing when the CLI reported neither", () => {
  expect(render(undefined)).toBe("");
  expect(render({ model: "Haiku 4.5" })).toBe("");
});

it("shows the effort and mode the core worded, as plain text", () => {
  expect(render({ effort: "High", permissionMode: "Accept edits" })).toBe("HighAccept edits");
  expect(render({ permissionMode: "Full access" })).toBe("Full access");
});
