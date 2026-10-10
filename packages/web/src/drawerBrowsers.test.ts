// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { useDrawerBrowsers } from "./drawerBrowsers";
import { useFileTabs } from "./fileTabs";

describe("drawer browsers", () => {
  beforeEach(() => {
    useDrawerBrowsers.setState({ pages: [], active: {} });
    useFileTabs.setState({ tabs: [], active: null });
  });

  it("opens several pages per workspace and closes one", () => {
    const s = useDrawerBrowsers.getState();
    s.open("w1");
    s.open("w1");
    s.open("w2");
    const [a, b] = useDrawerBrowsers.getState().pages;
    expect(useDrawerBrowsers.getState().pages).toHaveLength(3);
    expect(useDrawerBrowsers.getState().active.w1).toBe(b!.id);
    useDrawerBrowsers.getState().close(a!.id);
    expect(useDrawerBrowsers.getState().pages.map((p) => p.workspaceId)).toEqual(["w1", "w2"]);
  });

  it("close all ends the workspace's pages and browser tabs, nothing else", () => {
    useDrawerBrowsers.getState().open("w1");
    useDrawerBrowsers.getState().open("w2");
    useFileTabs.getState().open("w1", "http://localhost:3000/", "browser");
    useFileTabs.getState().open("w1", "src/a.ts");
    useFileTabs.getState().open("w2", "http://localhost:4000/", "browser");
    useDrawerBrowsers.getState().closeAll("w1");
    expect(useDrawerBrowsers.getState().pages.map((p) => p.workspaceId)).toEqual(["w2"]);
    expect(useFileTabs.getState().tabs.map((t) => t.path)).toEqual(["src/a.ts", "http://localhost:4000/"]);
  });
});
