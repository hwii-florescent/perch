// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { useDrawerBrowsers } from "./drawerBrowsers";
import { useFileTabs } from "./fileTabs";
import { usePerchStore } from "./store";
import "./workspaceCleanup";

const ws = (id: string, state: "active" | "archived" = "active") => ({ id, hostId: "local", projectId: "p", path: `/${id}`, state }) as never;

describe("workspace cleanup", () => {
  beforeEach(() => {
    usePerchStore.setState({ workspaces: [ws("w1"), ws("w2")] });
    useDrawerBrowsers.setState({ pages: [], active: {} });
    useFileTabs.setState({ tabs: [], active: null });
    for (const id of ["w1", "w2"]) {
      useDrawerBrowsers.getState().open(id);
      useFileTabs.getState().open(id, "src/a.ts");
      useFileTabs.getState().open(id, "http://localhost:3000/", "browser");
    }
  });

  const left = () => ({
    pages: useDrawerBrowsers.getState().pages.map((p) => p.workspaceId),
    tabs: useFileTabs.getState().tabs.map((t) => t.workspaceId),
  });

  it("an archived workspace loses its pages and tabs", () => {
    usePerchStore.setState({ workspaces: [ws("w1", "archived"), ws("w2")] });
    expect(left()).toEqual({ pages: ["w2"], tabs: ["w2", "w2"] });
  });

  it("a workspace dropped from the list loses them too, and the open tab is deselected", () => {
    useFileTabs.getState().open("w1", "src/a.ts");
    usePerchStore.setState({ workspaces: [ws("w2")] });
    expect(left()).toEqual({ pages: ["w2"], tabs: ["w2", "w2"] });
    expect(useFileTabs.getState().active).toBeNull();
  });

  it("a workspace never listed here is left alone", () => {
    useDrawerBrowsers.getState().open("remote");
    usePerchStore.setState({ workspaces: [ws("w1"), ws("w2"), ws("w3")] });
    expect(useDrawerBrowsers.getState().pages.map((p) => p.workspaceId)).toContain("remote");
  });
});
