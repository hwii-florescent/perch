// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePerchStore } from "./store";
import { useFileTabs } from "./fileTabs";
import { browserAddress, openTerminalLink, webUrl } from "./links";

describe("browser addresses", () => {
  it.each([
    ["example.com", "https://example.com/"],
    ["  example.com/path?q=1  ", "https://example.com/path?q=1"],
    ["example.com:8443/path", "https://example.com:8443/path"],
    ["https://localhost:3000", "https://localhost:3000/"],
    ["http://example.com", "http://example.com/"],
    ["localhost", "http://localhost/"],
    ["localhost:3000", "http://localhost:3000/"],
    ["localhost:443", "http://localhost:443/"],
    ["localhost:3000/path?q=1#x", "http://localhost:3000/path?q=1#x"],
    ["app.localhost:5173", "http://app.localhost:5173/"],
    ["server.local", "http://server.local/"],
    ["127.0.0.1:8080", "http://127.0.0.1:8080/"],
    ["0.0.0.0:5173", "http://0.0.0.0:5173/"],
    ["192.168.1.2:3000", "http://192.168.1.2:3000/"],
    ["[::1]:3000", "http://[::1]:3000/"],
    ["devbox:3000", "http://devbox:3000/"],
  ])("resolves %s to %s", (input, expected) => {
    expect(browserAddress(input)).toBe(expected);
    expect(webUrl(expected)).toBe(expected);
  });

  it.each(["hello", "hello world", "what is x?", "C++ & Rust", "你好", "  hello  "])("searches for %s", (input) => {
    const url = browserAddress(input)!;
    expect(new URL(url).origin).toBe("https://www.google.com");
    expect(new URL(url).searchParams.get("q")).toBe(input.trim());
    expect(webUrl(url)).toBe(url);
  });

  it.each(["", "  ", "javascript:alert(1)", "file:///etc/passwd", "mailto:x", "about:blank", "https://", "http://[bad"])("does not navigate to %s", (input) => {
    expect(browserAddress(input)).toBeNull();
  });
});

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
