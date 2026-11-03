// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
const room = "R".repeat(43);
const key = btoa(String.fromCharCode(...new Uint8Array(32).fill(7))).replace(/=+$/, "");
const secretToken = "private-device-token";
const secretPair = "PRIVATEPAIR";

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("crypto", { subtle: { digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer) } });
  vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal("WebSocket", window.WebSocket);
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (name: string) => storage.get(name) ?? null,
    setItem: (name: string, value: string) => storage.set(name, value),
    clear: () => storage.clear(),
  });
  window.history.replaceState(null, "", `/#r=${room}.${key}&pair=${secretPair}`);
  localStorage.setItem(`perch.relay.token.${room}`, secretToken);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove();
  localStorage.clear(); window.history.replaceState(null, "", "/");
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it("copies only safe connection evidence, not the relay link or stored secrets", async () => {
  const { installRelayTransport } = await import("../relay/transport");
  const { ConnectionDetails } = await import("./ConnectionDetails");
  expect(installRelayTransport()).toBe(true);
  await act(async () => root.render(<ConnectionDetails />));
  await act(async () => host.querySelector("button")!.click());
  const copied = vi.mocked(navigator.clipboard.writeText).mock.calls[0]![0];
  expect(JSON.parse(copied)).toMatchObject({ mode: "relay", stage: "link-ready", linkPresent: true, roomFingerprint: "000000000000", tokenPresent: true, storageAvailable: true });
  for (const secret of [room, key, secretToken, secretPair, "#r=", "perch.relay.token"]) expect(copied).not.toContain(secret);
  expect(host.textContent).toContain("Diagnostic report copied.");
});

it("keeps the last failure visible across retries and provides a manual-copy fallback", async () => {
  const { reportConnection } = await import("../relay/diagnostics");
  const { ConnectionDetails } = await import("./ConnectionDetails");
  reportConnection({ mode: "relay", stage: "waiting-for-computer" });
  reportConnection({ stage: "failed", error: "the computer did not answer", closeCode: 4004 });
  await act(async () => root.render(<ConnectionDetails />));
  await act(async () => reportConnection({ stage: "connecting-relay", attempts: 2 }));
  expect(host.textContent).toContain("the computer did not answer");
  expect(host.textContent).toContain("close code 4004");
  vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error("denied"));
  await act(async () => host.querySelector("button")!.click());
  expect(host.textContent).toContain("Select and copy the report below.");
  expect(host.querySelector("pre")?.getAttribute("tabindex")).toBe("0");
});

it("identifies a missing relay link instead of implying that a tunnel exists", async () => {
  window.history.replaceState(null, "", "/");
  const { installRelayTransport } = await import("../relay/transport");
  const { ConnectionDetails } = await import("./ConnectionDetails");
  expect(installRelayTransport()).toBe(false);
  await act(async () => root.render(<ConnectionDetails />));
  expect(host.textContent).toContain("no usable relay link found");
});

it("shows storage failures instead of aborting app startup with the secret link in an exception", async () => {
  vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new Error("private-storage-error"); });
  const { installRelayTransport } = await import("../relay/transport");
  const { ConnectionDetails } = await import("./ConnectionDetails");
  expect(installRelayTransport()).toBe(false);
  await act(async () => root.render(<ConnectionDetails />));
  expect(host.textContent).toContain("the browser could not save the relay link");
  expect(host.textContent).not.toContain("private-storage-error");
});

it("explains unavailable browser encryption while retaining relay-mode evidence", async () => {
  vi.stubGlobal("crypto", {});
  const { installRelayTransport } = await import("../relay/transport");
  const { getRelayDiagnostics } = await import("../relay/diagnostics");
  const { ConnectionDetails } = await import("./ConnectionDetails");
  expect(installRelayTransport()).toBe(false);
  await act(async () => root.render(<ConnectionDetails />));
  expect(getRelayDiagnostics()).toMatchObject({ mode: "relay", linkPresent: true, webCrypto: false, stage: "failed" });
  expect(host.textContent).toContain("browser encryption is unavailable");
});
