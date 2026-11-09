// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AgentManifestSummary } from "@perch/shared";

vi.mock("../ws", () => ({ socket: { connect: vi.fn(), send: vi.fn(), onMessage: vi.fn(() => () => {}), onConnectionChange: vi.fn(() => () => {}) } }));
vi.mock("../links", async (importOriginal) => ({ ...(await importOriginal<object>()), openExternal: vi.fn() }));
const { usePerchStore } = await import("../store");
const { openExternal } = await import("../links");
const { AgentCatalog } = await import("./AgentCatalog");
const { AgentPicker } = await import("../stock-ui/new-session/agent-picker");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const fetch = vi.fn();
const capabilities = ["agent.manifest.list", "agent.provider.configure"];
const missing: AgentManifestSummary = {
  id: "opencode", displayName: "OpenCode", available: false, enabled: false,
  supportedModes: ["cli"], capabilities: ["interactiveTerminal"],
  resumability: "providerSession", statusDetection: "exitStatus",
  homepageUrl: "https://opencode.ai/docs/cli/",
};
let root: Root;
let container: HTMLDivElement;

function setCatalog(entry: AgentManifestSummary, hostId = "local") {
  usePerchStore.setState({ agentManifestsByHost: { [hostId]: { state: "ready", manifests: [entry] } } });
}
function button(label: string, scope: ParentNode = document) {
  const found = [...scope.querySelectorAll<HTMLButtonElement>("button")].find((node) => node.textContent === label);
  expect(found).toBeDefined();
  return found!;
}
function click(node: Element) { act(() => { (node as HTMLElement).click(); }); }
function render(picker = false) {
  act(() => root.render(<><AgentCatalog />{picker && <AgentPicker hostId="local" testIdPrefix="new-session-agent" value="" onChange={() => {}} />}</>));
  fetch.mockClear(); // Ignore the initial discovery request.
}

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  usePerchStore.setState({
    connected: true, activeHostId: "local",
    hosts: [{ id: "remote", name: "Build host", sshHost: "build.example.invalid", remotePort: 7788, enabled: true, mode: "perch" }],
    serverInfo: { capabilities } as NonNullable<ReturnType<typeof usePerchStore.getState>["serverInfo"]>,
    workspaceCapabilitiesByHost: { remote: capabilities },
    fetchAgentManifests: fetch,
  });
  setCatalog(missing);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

it.each([false, undefined])("prompts for a missing harness (enabled=%s) and can cancel without changing preferences", (enabled) => {
  setCatalog({ ...missing, enabled });
  render();
  click(button("Enabled"));
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("OpenCode isn’t installed on this host");
  expect(fetch).not.toHaveBeenCalled();
  expect(openExternal).not.toHaveBeenCalled();
  click(button("Cancel"));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
  expect(openExternal).not.toHaveBeenCalled();
});

it("opens setup only on confirmation; enabling cannot put a missing harness in the picker", () => {
  render(true);
  click(button("Enabled"));
  click(button("Enable & open setup"));
  expect(openExternal).toHaveBeenCalledExactlyOnceWith(missing.homepageUrl);
  expect(fetch).toHaveBeenCalledExactlyOnceWith("local", { providerId: "opencode", enabled: true });
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  act(() => setCatalog({ ...missing, enabled: true }));
  const picker = () => document.querySelector('[data-testid="new-session-agent"]')!;
  const opencode = () => document.querySelector('[role="option"][data-value="opencode"]');
  click(picker());
  expect(opencode()).toBeNull();
  click(button("Refresh"));
  expect(fetch).toHaveBeenLastCalledWith("local");
  act(() => setCatalog({ ...missing, enabled: true, available: true }));
  click(picker());
  expect(opencode()?.querySelector("span")?.textContent).toBe("OpenCode");
});

it("enables installed harnesses and disables missing ones without an installation prompt", () => {
  setCatalog({ ...missing, available: true });
  render();
  click(button("Enabled"));
  expect(fetch).toHaveBeenLastCalledWith("local", { providerId: "opencode", enabled: true });
  act(() => setCatalog({ ...missing, enabled: true }));
  click(button("Disabled"));
  expect(fetch).toHaveBeenLastCalledWith("local", { providerId: "opencode", enabled: false });
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(openExternal).not.toHaveBeenCalled();
});

it.each([undefined, "javascript:alert(1)"])("offers manual installation when there is no safe setup URL (%s)", (homepageUrl) => {
  setCatalog({ ...missing, homepageUrl });
  render();
  click(button("Enabled"));
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("then choose Refresh");
  click(button("Enable anyway"));
  expect(fetch).toHaveBeenCalledExactlyOnceWith("local", { providerId: "opencode", enabled: true });
  expect(openExternal).not.toHaveBeenCalled();
});

it("names the selected remote host and never enables the local harness instead", () => {
  usePerchStore.setState({ activeHostId: "remote" });
  setCatalog(missing, "remote");
  render();
  click(button("Enabled"));
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("OpenCode isn’t installed on Build host");
  click(button("Enable & open setup"));
  expect(fetch).toHaveBeenCalledExactlyOnceWith("remote", { providerId: "opencode", enabled: true });
});

it("dismisses an unconfirmed installation request on disconnect or host change", () => {
  render();
  click(button("Enabled"));
  act(() => usePerchStore.setState({ connected: false }));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  act(() => usePerchStore.setState({ connected: true }));
  fetch.mockClear();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  click(button("Enabled"));
  const select = document.querySelector('[role="combobox"][aria-label="Agent host"]')!;
  act(() => { (select as HTMLElement).click(); });
  act(() => { document.querySelector<HTMLElement>('[role="option"][data-value="remote"]')!.click(); });
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(fetch.mock.calls.every((args) => args.length === 1)).toBe(true);
  expect(openExternal).not.toHaveBeenCalled();
});
