// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("./AgentPicker", () => ({
  useAgentChoices: () => ({
    connected: true, discovery: false, catalog: undefined,
    choices: [{ id: "terminal", label: "Terminal" }, { id: "claude", label: "Claude" }],
  }),
}));
vi.mock("./AgentIcon", () => ({ AgentIcon: () => null }));
vi.mock("./FileEntryMenu", () => ({ FileEntryMenu: () => null }));
vi.mock("../stock-ui/tabs/icons", () => ({ BrowserIcon: () => null, FileIcon: () => null }));
import { ADD_PROJECT_EVENT, requestNewSession } from "../appEvents";
import { usePerchStore } from "../store";
import { NewSessionDialog } from "./NewSessionDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
const createSessionOnHost = vi.fn();
const input = () => document.querySelector<HTMLInputElement>('[data-testid="new-session-filter"]')!;
const key = (k: string) => act(async () => { input().dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); });

beforeEach(async () => {
  usePerchStore.setState({
    activeHostId: "local", createSessionOnHost,
    workspaceProjects: [
      { id: "p1", hostId: "local", name: "alpha", path: "/a" },
      { id: "p2", hostId: "local", name: "beta", path: "/b" },
      { id: "chats", hostId: "local", name: "Chats", path: "/home/me/.perch/scratch" },
    ],
  } as never);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<NewSessionDialog />));
  await act(async () => requestNewSession());
});
afterEach(() => { act(() => root.unmount()); host.remove(); createSessionOnHost.mockClear(); });

it("picks a project, then a harness, from the keyboard alone", async () => {
  expect(document.activeElement).toBe(input());
  await key("ArrowDown");
  await key("Enter"); // beta
  await key("2"); // Claude
  expect(createSessionOnHost).toHaveBeenCalledWith("local", "/b", "claude");
  expect(document.querySelector('[data-testid="new-session-dialog"]')).toBeNull();
});

it("Backspace on an empty filter goes back to the projects; Escape closes", async () => {
  await key("1");
  expect(document.body.textContent).toContain("Terminal");
  await key("Backspace");
  expect(document.body.textContent).toContain("beta");
  await key("Escape");
  expect(document.querySelector('[data-testid="new-session-dialog"]')).toBeNull();
});

it("hides the scratch Chats project behind No project (home), and offers Add project", async () => {
  expect(document.body.textContent).not.toContain("scratch");
  await key("4"); // alpha, beta, Add project…, No project
  expect(document.body.textContent).toContain("Terminal");
  await key("Backspace");
  const added = vi.fn();
  window.addEventListener(ADD_PROJECT_EVENT, added);
  await key("3");
  window.removeEventListener(ADD_PROJECT_EVENT, added);
  expect(added).toHaveBeenCalled();
  expect(document.querySelector('[data-testid="new-session-dialog"]')).toBeNull();
});
