// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionSummary } from "@perch/shared";
import { useFileTabs } from "./fileTabs";
import { OPEN_EVENT, parseOpenRequest } from "./openRequest";
import { usePerchStore } from "./store";

const session = (id: string, workspaceId?: string) => ({ id, title: id, cwd: "/p", createdAt: 1, status: "idle", workspaceId }) as SessionSummary;
const open = (detail: unknown) => window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail }));

const actions = {
  switchSession: vi.fn(),
  openWorkspaceFiles: vi.fn(),
  openWorkspaceGitReview: vi.fn(),
  setSettingsOpen: vi.fn(),
};

beforeEach(() => {
  Object.values(actions).forEach((action) => action.mockReset());
  usePerchStore.setState({ ...actions, sessions: [session("s1", "w1"), session("loose")] });
  useFileTabs.setState({ tabs: [] });
});
afterEach(() => usePerchStore.setState({ sessions: [] }));

describe("perch:open", () => {
  it("reads only a known place and a well-formed session", () => {
    expect(parseOpenRequest({ place: "files", session: "host:3f2a-b.9_x" })).toEqual({ place: "files", session: "host:3f2a-b.9_x" });
    expect(parseOpenRequest({ place: "settings", session: null })).toEqual({ place: "settings" });
    for (const detail of [null, "files", 3, {}, { place: "terminal" }, { place: "files", session: "" }, { place: "files", session: "a b" },
      { place: "files", session: "a/b" }, { place: "files", session: 4 }, { place: "files", session: "x".repeat(129) }]) {
      expect(parseOpenRequest(detail), JSON.stringify(detail)).toBeUndefined();
    }
  });

  it("shows files, changes and the browser on the session's workspace", () => {
    open({ place: "files", session: "s1" });
    expect(actions.switchSession).toHaveBeenCalledWith("s1");
    expect(actions.openWorkspaceFiles).toHaveBeenCalledWith("w1");
    open({ place: "changes", session: "s1" });
    expect(actions.openWorkspaceGitReview).toHaveBeenCalledWith("w1");
    open({ place: "browser", session: "s1" });
    expect(useFileTabs.getState().tabs.map((tab) => [tab.workspaceId, tab.kind])).toEqual([["w1", "browser"]]);
  });

  it("opens the session for chat, and settings without one", () => {
    open({ place: "chat", session: "s1" });
    expect(actions.switchSession).toHaveBeenCalledWith("s1");
    expect(actions.openWorkspaceFiles).not.toHaveBeenCalled();
    open({ place: "settings" });
    expect(actions.setSettingsOpen).toHaveBeenCalledWith(true);
  });

  it("ignores a session it does not know, and a place with no workspace", () => {
    open({ place: "files", session: "unknown" });
    open({ place: "files" });
    expect(actions.switchSession).not.toHaveBeenCalled();
    open({ place: "files", session: "loose" });
    expect(actions.switchSession).toHaveBeenCalledWith("loose");
    expect(actions.openWorkspaceFiles).not.toHaveBeenCalled();
    open({ place: "bogus", session: "s1" });
    expect(actions.switchSession).toHaveBeenCalledTimes(1);
  });
});
