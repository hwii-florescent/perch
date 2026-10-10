// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePerchStore } from "./store";
import { useFileTabs } from "./fileTabs";
import { openTerminalLink, webUrl } from "./links";

describe("terminal links", () => {
  beforeEach(() => {
    useFileTabs.setState({ tabs: [], active: null });
    vi.restoreAllMocks();
  });

  it("only accepts http(s)", () => {
    expect(webUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(webUrl("file:///etc/passwd")).toBeNull();
    expect(webUrl("javascript:alert(1)")).toBeNull();
    expect(webUrl("not a url")).toBeNull();
  });

  it("click opens a browser tab, Cmd+click the OS browser", () => {
    usePerchStore.setState({
      activeWorkspaceId: "w1",
      workspaces: [{ id: "w1", hostId: "local", path: "/p" }] as never,
    });
    const open = vi.spyOn(window, "open").mockReturnValue(null);

    openTerminalLink({ metaKey: false, ctrlKey: false }, "http://localhost:3000/");
    expect(useFileTabs.getState().tabs).toEqual([{ workspaceId: "w1", path: "http://localhost:3000/", kind: "browser" }]);
    expect(open).not.toHaveBeenCalled();

    openTerminalLink({ metaKey: true, ctrlKey: false }, "https://example.com/");
    expect(open).toHaveBeenCalledWith("https://example.com/", "_blank", "noopener");
    expect(useFileTabs.getState().tabs).toHaveLength(1);

    openTerminalLink({ metaKey: false, ctrlKey: true }, "https://example.org/");
    expect(open).toHaveBeenCalledTimes(2);
    expect(useFileTabs.getState().tabs).toHaveLength(1);
  });

  it("ignores non-web links", () => {
    usePerchStore.setState({
      activeWorkspaceId: "w2",
      workspaces: [{ id: "w2", hostId: "dev", path: "/p" }] as never,
    });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    openTerminalLink({ metaKey: true, ctrlKey: false }, "file:///etc/passwd");
    expect(useFileTabs.getState().tabs).toEqual([]);
    expect(open).not.toHaveBeenCalled();
  });
});
