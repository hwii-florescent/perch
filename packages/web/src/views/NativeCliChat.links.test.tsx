// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { FsLink } from "@perch/shared";

const native = vi.hoisted(() => ({ available: true, invoke: vi.fn() }));
vi.mock("../links", async (original) => ({
  ...await original<typeof import("../links")>(),
  get tauriInvoke() { return native.available ? native.invoke : undefined; },
}));
vi.mock("./nativeChat/fileLinks", async (original) => ({
  ...await original<typeof import("./nativeChat/fileLinks")>(),
  requestFileLinks: vi.fn(),
}));
import { NativeMessage } from "./NativeCliChat";
import { requestFileLinks } from "./nativeChat/fileLinks";
import { usePerchStore } from "../store";
import { useFileTabs } from "../fileTabs";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
let external: ReturnType<typeof vi.spyOn>;
const scope = { workspaceId: "w", hostId: "local" };

beforeEach(() => {
  vi.clearAllMocks();
  native.available = true;
  native.invoke.mockReset().mockResolvedValue(undefined);
  vi.mocked(requestFileLinks).mockResolvedValue([]);
  useFileTabs.setState({ tabs: [], active: null });
  usePerchStore.setState({
    activeWorkspaceId: "w",
    workspaces: [{ id: "w", hostId: "local", path: "/repo with spaces/" }] as never,
  });
  external = vi.spyOn(window, "open").mockReturnValue(null);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });

async function render(href: string, fileScope: typeof scope | null = scope) {
  await act(async () => root.render(<NativeMessage
    message={{ id: "m", role: "assistant", text: `[Open](<${href}>)`, thinking: "", tools: [] }}
    streaming={false} turn="t" fileLinkScope={fileScope ?? undefined}
  />));
}
async function click(modifiers: MouseEventInit = {}) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, ...modifiers });
  await act(async () => { host.querySelector("a")!.dispatchEvent(event); });
  expect(event.defaultPrevented).toBe(true);
}

it.each(["https://example.com/", "https://example.com/image.png", "https://example.com/report.pdf?download=1"])("opens %s inside Perch, not the system browser", async (href) => {
  // Web navigation must not depend on the core's file-link capability.
  await render(href, null);
  await click();
  expect(useFileTabs.getState().tabs).toEqual([{ workspaceId: "w", path: href, kind: "browser" }]);
  expect(external).not.toHaveBeenCalled();
  expect(native.invoke).not.toHaveBeenCalled();
});

it.each([{ metaKey: true }, { ctrlKey: true }])("opens web links externally only with %j", async (modifiers) => {
  await render("https://example.com/report.pdf");
  await click(modifiers);
  expect(external).toHaveBeenCalledExactlyOnceWith("https://example.com/report.pdf", "_blank", "noopener");
  expect(useFileTabs.getState().tabs).toEqual([]);
});

it.each(["docs/report #1.pdf", "images/screenshot.png", "src/main.rs"])("previews a resolved %s internally, and opens its default app on Cmd-click", async (path) => {
  const href = encodeURI(path);
  vi.mocked(requestFileLinks).mockResolvedValue([{ href, path }]);
  await render(href);
  await click();
  expect(useFileTabs.getState().tabs).toEqual([{ workspaceId: "w", path }]);
  expect(native.invoke).not.toHaveBeenCalled();
  useFileTabs.setState({ tabs: [], active: null });
  await click({ metaKey: true });
  expect(native.invoke).toHaveBeenCalledExactlyOnceWith("open_in_default_app", { path: `/repo with spaces/${path}` });
  expect(useFileTabs.getState().tabs).toEqual([]);
  expect(external).not.toHaveBeenCalled();
});

it("uses the core-resolved path, not the agent's encoded absolute path or line suffix", async () => {
  const href = "/repo%20with%20spaces/docs/report.pdf#L3";
  vi.mocked(requestFileLinks).mockResolvedValue([{ href, path: "docs/report.pdf", line: 3 }]);
  await render(href);
  await click({ ctrlKey: true });
  expect(native.invoke).toHaveBeenCalledExactlyOnceWith("open_in_default_app", { path: "/repo with spaces/docs/report.pdf" });
});

it.each(["../outside.pdf", "/etc/passwd", "mailto:a@example.com"])("does not navigate unresolved or unsupported links: %s", async (href) => {
  await render(href);
  await click();
  await click({ metaKey: true });
  expect(useFileTabs.getState().tabs).toEqual([]);
  expect(native.invoke).not.toHaveBeenCalled();
  expect(external).not.toHaveBeenCalled();
});

it("blocks navigation while a file link is still being resolved", async () => {
  let resolve!: (links: FsLink[]) => void;
  vi.mocked(requestFileLinks).mockReturnValue(new Promise((done) => { resolve = done; }));
  await render("image.png");
  await click();
  expect(useFileTabs.getState().tabs).toEqual([]);
  await act(async () => resolve([{ href: "image.png", path: "image.png" }]));
  await click();
  expect(useFileTabs.getState().tabs).toEqual([{ workspaceId: "w", path: "image.png" }]);
});

it.each(["remote", "browser"])("never opens a local default app for a %s file click", async (mode) => {
  const fileScope = { ...scope, hostId: mode === "remote" ? "remote" : "local" };
  if (mode === "remote") usePerchStore.setState({ workspaces: [{ id: "w", hostId: "remote", path: "/repo" }] as never });
  else native.available = false;
  vi.mocked(requestFileLinks).mockResolvedValue([{ href: "image.png", path: "image.png" }]);
  await render("image.png", fileScope);
  await click({ metaKey: true });
  expect(native.invoke).not.toHaveBeenCalled();
  expect(external).not.toHaveBeenCalled();
  expect(useFileTabs.getState().tabs).toEqual([]);
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("only available for local files");
});

it("shows default-app failures without navigating or falling back", async () => {
  vi.mocked(requestFileLinks).mockResolvedValue([{ href: "report.pdf", path: "report.pdf" }]);
  native.invoke.mockRejectedValueOnce(new Error("No application is associated with this file."));
  await render("report.pdf");
  await click({ metaKey: true });
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("No application is associated");
  expect(useFileTabs.getState().tabs).toEqual([]);
  expect(external).not.toHaveBeenCalled();
});
