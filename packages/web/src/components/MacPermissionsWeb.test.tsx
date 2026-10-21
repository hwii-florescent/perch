// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("../links", () => ({ tauriInvoke: undefined }));
vi.mock("../store", () => ({ usePerchStore: (select: (s: unknown) => unknown) => select({ settings: {}, updateSettings: vi.fn() }) }));
const { MacPermissions, MacPermissionSetup, macPermissionsAvailable } = await import("./MacPermissions");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("never offers local Mac permissions to a browser or paired phone", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() => root.render(<><MacPermissions /><MacPermissionSetup enabled /></>));
    expect(macPermissionsAvailable).toBe(false);
    expect(host.textContent).toBe("");
    expect(document.querySelector('[data-testid="permission-setup"]')).toBeNull();
  } finally { act(() => root.unmount()); host.remove(); }
});
