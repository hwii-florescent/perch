// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// The page itself is Perch's engine (a native webview in the desktop app); here it only says which page it draws.
vi.mock("../../components/WorkspaceBrowser", () => ({
  WorkspaceBrowser: ({ tabId, initialUrl }: { tabId: string; initialUrl: string }) => <div data-testid="engine" data-tab={tabId} data-url={initialUrl} />,
}));
import Browser from "./main";
import { useDrawerBrowsers } from "../../drawerBrowsers";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  useDrawerBrowsers.setState({ pages: [], active: {} });
  host = document.body.appendChild(document.createElement("div"));
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

const q = (id: string) => [...host.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)];
const draw = () => act(() => root.render(<Browser workspaceId="w" />));

it("opens, switches and closes the workspace's pages in Perch's store, and a replaced view shows the same pages", () => {
  draw();
  expect(q("engine")).toHaveLength(0);
  act(() => q("drawer-browser-open")[0]!.click());
  act(() => q("drawer-browser-new")[0]!.click());
  const pages = useDrawerBrowsers.getState().pages.filter((page) => page.workspaceId === "w");
  expect(pages).toHaveLength(2);
  expect(q("drawer-browser-page").map((b) => b.textContent)).toEqual(["New page", "New page"]);
  // The newest is shown, through Perch's engine keyed by the page.
  expect(q("engine")[0]!.dataset.tab).toBe(`drawer\n${pages[1]!.id}`);
  act(() => useDrawerBrowsers.getState().setUrl(pages[0]!.id, "https://example.com/a"));
  act(() => q("drawer-browser-page")[0]!.click());
  expect(q("engine")[0]!.dataset.url).toBe("https://example.com/a");
  expect(q("drawer-browser-page")[0]!.textContent).toBe("example.com");

  // A clone swap or reload is a remount: the pages and the shown one are Perch's, not the view's.
  act(() => root.unmount());
  root = createRoot(host);
  draw();
  expect(q("drawer-browser-page")).toHaveLength(2);
  expect(q("engine")[0]!.dataset.tab).toBe(`drawer\n${pages[0]!.id}`);

  act(() => q("drawer-browser-page-close")[0]!.click());
  expect(useDrawerBrowsers.getState().pages.map((page) => page.id)).toEqual([pages[1]!.id]);
  expect(q("drawer-browser-close-all")[0]!.textContent).toBe("Close all (1)");
});
