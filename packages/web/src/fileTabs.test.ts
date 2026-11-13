// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { fileTabKey, tabDirectory, useFileTabs } from "./fileTabs";
import { dirScopeId } from "./terminalScope";
import { usePerchStore } from "./store";
import { useWorkspaceFilesStore, type WorkspaceDocumentState } from "./filesystemStore";

const key = (path: string) => fileTabKey({ workspaceId: "w", path });
const paths = () => useFileTabs.getState().tabs.map((tab) => tab.path);

describe("preview tabs", () => {
  beforeEach(() => useFileTabs.setState({ tabs: [], active: null }));

  it("a second preview replaces the first in its slot", () => {
    const files = useFileTabs.getState();
    files.openPreview("w", "a.ts");
    files.open("w", "kept.ts");
    useFileTabs.getState().openPreview("w", "b.ts", key("a.ts"));
    expect(paths()).toEqual(["b.ts", "kept.ts"]);
    expect(useFileTabs.getState().active).toBe(key("b.ts"));
  });

  it("an already open file is only shown, and a pinned tab is never replaced", () => {
    const files = useFileTabs.getState();
    files.openPreview("w", "a.ts");
    useFileTabs.getState().pin(key("a.ts"));
    useFileTabs.getState().openPreview("w", "b.ts", key("a.ts"));
    expect(paths()).toEqual(["a.ts", "b.ts"]);
    useFileTabs.getState().openPreview("w", "a.ts");
    expect(paths()).toEqual(["a.ts", "b.ts"]);
    expect(useFileTabs.getState().active).toBe(key("a.ts"));
  });

  it("editing a previewed file makes its tab permanent", () => {
    useFileTabs.getState().openPreview("w", "a.ts");
    const document = { content: "changed", savedContent: "" } as WorkspaceDocumentState;
    useWorkspaceFilesStore.setState({ documents: { w: { "a.ts": document } } });
    expect(useFileTabs.getState().tabs[0].preview).toBe(false);
  });
});

describe("leaving a session for a workspace's start screen", () => {
  const ws = (id: string) => ({ id, projectId: id, hostId: "local", path: `/${id}`, name: id, dirty: false, state: "active" as const, createdAt: 1, updatedAt: 1 });
  const scoped = { workspaceId: "chats", scope: "term:gone:L1VzZXJzL2h3aWlpL0Rvd25sb2Fkcw", path: "cop4020test.java" };
  beforeEach(() => {
    useFileTabs.setState({ tabs: [scoped], active: null });
    usePerchStore.setState({ workspaces: [ws("proj"), ws("chats")], activeWorkspaceId: "proj", sessionId: "a", sessions: [{ id: "a", workspaceId: "proj" } as never] });
  });

  it("Quickchat's + (focus the workspace, then clear the session) shows the start screen, not a file", () => {
    usePerchStore.setState({ activeWorkspaceId: "chats" });
    usePerchStore.setState({ sessionId: null });
    expect(useFileTabs.getState().tabs).toEqual([scoped]);
    expect(useFileTabs.getState().active).toBeNull();
  });

  it("closing a workspace's last session shows its newest file through the file's own scope", () => {
    usePerchStore.setState({ activeWorkspaceId: "chats", sessionId: "b", sessions: [{ id: "b", workspaceId: "chats" } as never] });
    usePerchStore.setState({ sessionId: null, sessions: [] });
    expect(useFileTabs.getState().tabs).toEqual([scoped]);
    expect(useFileTabs.getState().active).toBe(fileTabKey(scoped));
  });
});

describe("tabDirectory (the status bar's folder)", () => {
  const state = { workspaces: [{ id: "w", projectId: "p", hostId: "local", path: "/repo/", name: "repo", branch: "main", dirty: false, state: "active", createdAt: 1, updatedAt: 1 }], sessions: [] } as never;

  it("is the file's folder under its workspace, or under the scope it was opened through", () => {
    expect(tabDirectory(state, { workspaceId: "w", path: "src/a.ts" })).toEqual({ path: "/repo/src", branch: "main" });
    expect(tabDirectory(state, { workspaceId: "w", path: "a.ts" })?.path).toBe("/repo/");
    expect(tabDirectory(state, { workspaceId: "w", scope: dirScopeId("w", "/Users/me/Downloads"), path: "cop4020test.java" })?.path).toBe("/Users/me/Downloads");
    expect(tabDirectory(state, { workspaceId: "w", scope: dirScopeId("w", "/Users/me/Downloads"), path: "x/y.txt" })?.path).toBe("/Users/me/Downloads/x");
  });

  it("is the root for a review, and nothing for a page, a mod, no tab or a scope that is gone", () => {
    expect(tabDirectory(state, { workspaceId: "w", path: "", kind: "review" })?.path).toBe("/repo/");
    expect(tabDirectory(state, { workspaceId: "w", path: "https://x", kind: "browser" })).toBeNull();
    expect(tabDirectory(state, { workspaceId: "w", path: "m:1", kind: "mod", mod: "m" })).toBeNull();
    expect(tabDirectory(state, undefined)).toBeNull();
    expect(tabDirectory(state, { workspaceId: "gone", path: "a" })).toBeNull();
  });
});
