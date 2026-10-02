import { usePerchStore } from "../store";
import { useFileTabs } from "../fileTabs";
import { WorkspaceFilesView } from "./WorkspaceFiles";
import { WorkspaceGitReviewPane } from "./WorkspaceGitReviewPane";

export type WorkspaceToolsTab = "files" | "gitReview";

const TABS: { id: WorkspaceToolsTab; label: string }[] = [
  { id: "files", label: "Files" },
  { id: "gitReview", label: "Git" },
];

/**
 * The desktop drawer behind the toolbar's right-panel button: the file
 * explorer and Git for whichever workspace is active. A clicked file opens as
 * a top-row tab beside the workspace's sessions (`fileTabs.ts`). Terminals are session
 * tabs, not drawer content. Git shows only for a git checkout. It belongs to
 * the app, not to a session's saved layout, so it stays open across chats and
 * simply follows the workspace the user clicks.
 */
export function WorkspaceTools({ tab, onTabChange, onClose }: {
  tab: WorkspaceToolsTab;
  onTabChange: (tab: WorkspaceToolsTab) => void;
  onClose: () => void;
}) {
  const workspaceId = usePerchStore((state) =>
    state.activeWorkspaceId ?? state.sessions.find((candidate) => candidate.id === state.sessionId)?.workspaceId ?? null);
  const row = usePerchStore((state) => state.workspaces.find((candidate) => candidate.id === workspaceId));
  const project = usePerchStore((state) => state.workspaceProjects.find((candidate) => candidate.id === row?.projectId));
  const isGit = Boolean(row?.branch || project?.repoPath);
  const tabs = isGit ? TABS : TABS.filter(({ id }) => id !== "gitReview");
  if (tab === "gitReview" && !isGit) tab = "files";
  const missing = <div className="workspace-tools__empty">Pick a workspace in the sidebar.</div>;

  return (
    <aside className="workspace-tools" data-testid="workspace-tools" aria-label="Files and Git">
      <div className="workspace-tools__bar">
        <nav className="workspace-tools__tabs" aria-label="Files and Git">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={"workspace-tools__tab" + (tab === id ? " workspace-tools__tab--active" : "")}
              data-testid={`workspace-tools-${id}`}
              aria-pressed={tab === id}
              onClick={() => onTabChange(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <span className="workspace-tools__workspace" title={row?.path}>
          {row ? row.name || row.path.split("/").pop() : ""}
        </span>
        <button type="button" className="workspace-tools__close" aria-label="Close Files and Git" onClick={onClose}>×</button>
      </div>
      <div className="workspace-tools__content">
        {tab === "files" && (workspaceId ? (
          <WorkspaceFilesView
            key={workspaceId}
            layout="explorer"
            workspaceId={workspaceId}
            onOpenFile={(path) => useFileTabs.getState().open(workspaceId, path)}
          />
        ) : missing)}
        {tab === "gitReview" && (workspaceId ? <WorkspaceGitReviewPane key={workspaceId} workspaceId={workspaceId} /> : missing)}
      </div>
    </aside>
  );
}
