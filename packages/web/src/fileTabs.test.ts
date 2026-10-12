// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { fileTabKey, useFileTabs } from "./fileTabs";
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
