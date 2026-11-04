// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("./AgentPicker", () => ({
  AgentPicker: () => null,
  useAgentChoices: () => ({
    connected: true, discovery: false, catalog: undefined,
    choices: [{ id: "terminal", label: "Terminal" }, { id: "claude", label: "Claude" }, { id: "codex", label: "Codex" }],
  }),
}));
vi.mock("./AgentIcon", () => ({ AgentIcon: () => null }));
vi.mock("./StatusDot", () => ({ StatusDot: () => null }));
vi.mock("./WorktreeMenu", () => ({ WorktreeMenu: () => null }));
vi.mock("./ConfirmDialog", () => ({ ConfirmDialog: () => null }));
import { NewSessionPopover } from "../Sidebar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
const onSelect = vi.fn(), onClose = vi.fn(), browser = vi.fn();
const input = () => document.querySelector<HTMLInputElement>('[data-testid="new-tab-filter"]')!;
// React tracks the input value, so set it through the native setter.
async function type(text: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), text);
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function key(k: string) {
  await act(async () => { input().dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); });
}

beforeEach(async () => {
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(
    <NewSessionPopover hostId="local" projectCwds={[]} fixedCwd="/repo" anchorRect={new DOMRect(0, 0, 10, 10)}
      onClose={onClose} onSelect={onSelect} extras={[{ id: "browser", label: "New browser", icon: null, onSelect: browser }]} />,
  ));
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

it("focuses the filter and opens the highlighted entry with arrows + Enter", async () => {
  expect(document.activeElement).toBe(input());
  await key("ArrowDown");
  await key("ArrowDown");
  await key("Enter");
  expect(onSelect).toHaveBeenCalledWith("/repo", "codex");
  expect(onClose).toHaveBeenCalled();
});

it("wraps upward from the first entry", async () => {
  await key("ArrowUp");
  await key("Enter");
  expect(browser).toHaveBeenCalled();
});

it("picks by number when the filter is empty", async () => {
  await key("2");
  expect(onSelect).toHaveBeenCalledWith("/repo", "claude");
});

it("filters by typed text; digits then type into the filter", async () => {
  await type("co");
  await key("Enter");
  expect(onSelect).toHaveBeenCalledWith("/repo", "codex");
  onSelect.mockClear();
  await type("1");
  await key("1");
  expect(onSelect).not.toHaveBeenCalled();
});
