// selectors.ts only imports types from ./index, so no jsdom/socket stub needed.
import { describe, it, expect } from "vitest";
import type { SessionSummary } from "@perch/shared";
import { activeWorkspaceSessions, effectiveWorkspace, type ProjectNavState } from "./selectors";
import type { WorkspaceRecord } from "./index";

const ws = (id: string, path: string): WorkspaceRecord =>
  ({ id, projectId: "p1", hostId: "local", path, name: id }) as WorkspaceRecord;
const sess = (id: string, o: Partial<SessionSummary> = {}): SessionSummary =>
  ({ id, title: id, cwd: "/repo", createdAt: 0, status: "idle", ...o }) as SessionSummary;

const main = ws("w-main", "/repo");
const tree = ws("w-tree", "/repo-wt");
const sessions = [
  sess("c", { workspaceId: "w-main", createdAt: 30 }),
  sess("a", { workspaceId: "w-main", createdAt: 10 }),
  sess("legacy", { cwd: "/repo", createdAt: 20 }), // no workspaceId: matched by (hostId, cwd)
  sess("archived", { workspaceId: "w-main", archived: true, createdAt: 5 }),
  sess("other", { workspaceId: "w-other", createdAt: 40 }), // same cwd, a workspace we have no record of
  sess("sibling", { workspaceId: "w-tree", cwd: "/repo-wt", createdAt: 15 }),
];
const nav = (o: Partial<ProjectNavState> = {}): ProjectNavState => ({
  sessions,
  sessionId: "a",
  activeHostId: "local",
  activeProject: { hostId: "local", cwd: "/repo" },
  activeWorkspaceId: "w-main",
  workspaces: [main, tree],
  ...o,
});
const ids = (s: ProjectNavState) => activeWorkspaceSessions(s).map((x) => x.id);

describe("activeWorkspaceSessions", () => {
  it("scopes to the workspace, keeps the cwd fallback, drops archived and sibling worktrees", () => {
    expect(ids(nav())).toEqual(["a", "legacy", "c"]);
    expect(ids(nav({ activeWorkspaceId: "w-tree", sessionId: "sibling" }))).toEqual(["sibling"]);
  });

  it("falls back to the active session's workspaceId when activeWorkspaceId is unset", () => {
    expect(effectiveWorkspace(nav({ activeWorkspaceId: null }))?.id).toBe("w-main");
    expect(ids(nav({ activeWorkspaceId: undefined, sessionId: "sibling" }))).toEqual(["sibling"]);
  });

  it("uses today's project scoping when no workspace record matches", () => {
    const s = nav({ activeWorkspaceId: "gone", workspaces: [tree], sessionId: "legacy" });
    expect(effectiveWorkspace(s)).toBeNull();
    expect(ids(s)).toEqual(["a", "legacy", "c", "other"]);
  });
});
