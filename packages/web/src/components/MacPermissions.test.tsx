// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { invoke, updateSettings } = vi.hoisted(() => ({ invoke: vi.fn(), updateSettings: vi.fn() }));
vi.mock("../links", () => ({ tauriInvoke: invoke }));
// The page is drawn from its stock source with the SDK's Settings parts; the rest of the app is not needed here.
vi.mock("./mod-root", async () => ({ StockRoute: ({ props, stock: Stock }: { props: object; stock: (props: never) => unknown }) => (Stock as (props: object) => unknown)(props) }));
vi.mock("@perch/sdk", async () => await import("../sdkSettings"));
vi.mock("../store", () => ({ usePerchStore: (select: (state: unknown) => unknown) => select({ settings: { permissionsSetupDismissed: false }, updateSettings }) }));
Object.defineProperty(navigator, "platform", { configurable: true, value: "MacIntel" });
const { MacPermissions, MacPermissionSetup } = await import("./MacPermissions");
import type { PermissionReport } from "./MacPermissions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
let root: Root;
let host: HTMLDivElement;
const report: PermissionReport = {
  supported: true,
  app: { pid: 1, checks: [
    { id: "fullDiskAccess", title: "Full Disk Access", description: "Protected personal data", state: "notGranted" },
    { id: "accessibility", title: "Accessibility", description: "Control windows", state: "granted" },
    { id: "automationSystemEvents", title: "Automation · System Events", description: "Open the app to check", state: "unknown" },
  ] },
  daemon: null, terminal: null, comparison: "unknown", note: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  invoke.mockResolvedValue(structuredClone(report));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
async function render(node: React.ReactNode) { await act(async () => root.render(node)); }
async function click(text: string) {
  const button = [...document.querySelectorAll("button")].find((b) => b.textContent === text);
  expect(button).toBeDefined();
  await act(async () => button!.click());
}

it("checks without prompting and distinguishes denied, granted, and unknown", async () => {
  await render(<MacPermissions />);
  expect(invoke.mock.calls).toEqual([["permissions_status"]]);
  expect(document.querySelector('[aria-label="Full Disk Access · App: Not granted"]')).not.toBeNull();
  expect(document.querySelector('[aria-label="Accessibility · App: Granted"]')).not.toBeNull();
  expect(document.querySelector('[aria-label="Automation · System Events · App: Unable to verify"]')).not.toBeNull();
  await click("Allow");
  expect(invoke).toHaveBeenCalledWith("permissions_allow", { id: "fullDiskAccess" });
  // Opening Settings is not a grant.
  expect(document.querySelector('[aria-label="Full Disk Access · App: Not granted"]')).not.toBeNull();
});

it("refreshes on returning to the app, verifies terminals only on request, and clears stale ticks on errors", async () => {
  await render(<MacPermissions />);
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(invoke.mock.calls.filter(([name]) => name === "permissions_status")).toHaveLength(2);
  invoke.mockResolvedValueOnce({ ...report, terminal: { ...report.app, pid: 2 }, comparison: "match" });
  await click("Verify terminals");
  expect(document.querySelector('[data-testid="permission-comparison"]')?.textContent).toContain("can include permissions that are not granted");
  expect(document.querySelector('[aria-label="Full Disk Access · Terminal: Not granted"]')).not.toBeNull();
  invoke.mockRejectedValueOnce("Native check unavailable");
  await click("Refresh");
  expect(document.querySelector('[aria-label="Accessibility · App: Granted"]')).toBeNull();
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("Native check unavailable");
});

it("offers a host restart only for a severed host, names the sessions it ends, and sends exactly what was shown", async () => {
  await render(<MacPermissions />);
  expect(document.querySelector('[data-testid="host-severed"]')).toBeNull();
  for (const attribution of ["intact", "unknown"] as const) {
    invoke.mockResolvedValueOnce({ ...report, host: { pid: 7, attribution, liveSessions: 2 } });
    await click("Refresh");
    expect(document.querySelector('[data-testid="host-severed"]')).toBeNull();
  }
  invoke.mockResolvedValue({ ...report, host: { pid: 7, attribution: "severed", liveSessions: 2 } });
  await click("Refresh");
  // First click only asks; nothing is sent until the warning is confirmed.
  await click("Restart terminal host…");
  expect(invoke.mock.calls.some(([name]) => name === "permissions_restart_host")).toBe(false);
  expect(document.querySelector('[data-testid="host-severed"]')?.textContent).toContain("ends 2 running terminals");
  await click("Cancel");
  expect(invoke.mock.calls.some(([name]) => name === "permissions_restart_host")).toBe(false);
  await click("Restart terminal host…");
  await click("Restart terminal host");
  expect(invoke).toHaveBeenCalledWith("permissions_restart_host", { pid: 7, liveSessions: 2 });
});

it("surfaces a refused restart and leaves the host untouched", async () => {
  invoke.mockResolvedValue({ ...report, host: { pid: 7, attribution: "severed", liveSessions: 1 } });
  await render(<MacPermissions />);
  await click("Restart terminal host…");
  invoke.mockRejectedValueOnce("The running sessions changed since you were shown them; nothing was restarted.");
  await click("Restart terminal host");
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("nothing was restarted");
});

it("surfaces a busy native request and releases its loading state", async () => {
  await render(<MacPermissions />);
  invoke.mockRejectedValueOnce("A permission request is already open. Finish it before trying again.");
  await click("Allow");
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("already open");
  expect(document.body.textContent).not.toContain("Opening…");
  const refresh = [...document.querySelectorAll("button")].find((button) => button.textContent === "Refresh")!;
  expect(refresh.disabled).toBe(false);
});

it("keeps keyboard focus in optional setup and Escape persists dismissal", async () => {
  await render(<MacPermissionSetup enabled />);
  const dialog = document.querySelector('[data-testid="permission-setup"]')!;
  const buttons = dialog.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
  const last = buttons.item(buttons.length - 1);
  act(() => { last.focus(); last.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true })); });
  expect(dialog.contains(document.activeElement)).toBe(true);
  expect(document.activeElement).not.toBe(last);
  await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(updateSettings).toHaveBeenCalledWith({ permissionsSetupDismissed: true });
  expect(document.querySelector('[data-testid="permission-setup"]')).toBeNull();
});

it("offers an explicit Not now action without requesting consent", async () => {
  await render(<MacPermissionSetup enabled />);
  await click("Not now");
  expect(updateSettings).toHaveBeenCalledWith({ permissionsSetupDismissed: true });
  expect(invoke.mock.calls.every(([name]) => name === "permissions_status")).toBe(true);
});

it("offers optional setup after welcome and persists only dismissal", async () => {
  await render(<MacPermissionSetup enabled={false} />);
  expect(document.querySelector('[data-testid="permission-setup"]')).toBeNull();
  expect(invoke).not.toHaveBeenCalled();
  await render(<MacPermissionSetup enabled />);
  expect(document.querySelector('[data-testid="permission-setup"]')).not.toBeNull();
  await click("Continue to perch");
  expect(updateSettings).toHaveBeenCalledWith({ permissionsSetupDismissed: true });
  expect(document.querySelector('[data-testid="permission-setup"]')).toBeNull();
  expect(invoke.mock.calls.every(([name]) => name === "permissions_status")).toBe(true);
});
