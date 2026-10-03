import { usePerchStore } from "../store";
import { cn } from "../lib/cn";
import { useFileTabs } from "../fileTabs";
import { WorkspaceFilesView } from "./WorkspaceFiles";
import { WorkspaceGitReviewPane } from "./WorkspaceGitReviewPane";

const BTN = "cursor-pointer rounded-ui border border-transparent bg-transparent px-[0.55rem] py-[0.2rem] text-[0.75rem] text-overlay-1 [font-family:inherit] [font-weight:inherit] [line-height:inherit] hover:text-fg";

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
export function WorkspaceTools({ requestedWorkspaceId, tab, onTabChange, onClose }: {
  /** The workspace a sidebar Files/Git action named, if any. */
  requestedWorkspaceId?: string | null;
  tab: WorkspaceToolsTab;
  onTabChange: (tab: WorkspaceToolsTab) => void;
  onClose: () => void;
}) {
  const activeId = usePerchStore((state) =>
    state.activeWorkspaceId ?? state.sessions.find((candidate) => candidate.id === state.sessionId)?.workspaceId ?? null);
  const workspaceId = requestedWorkspaceId ?? activeId;
  const row = usePerchStore((state) => state.workspaces.find((candidate) => candidate.id === workspaceId));
  const project = usePerchStore((state) => state.workspaceProjects.find((candidate) => candidate.id === row?.projectId));
  // A requested id with no local row is a remote checkout, offered Git only
  // when its host relays git (`ProjectGitReviewButton`).
  const isGit = Boolean(row?.branch || project?.repoPath || (requestedWorkspaceId && !row));
  const tabs = isGit ? TABS : TABS.filter(({ id }) => id !== "gitReview");
  if (tab === "gitReview" && !isGit) tab = "files";
  const missing = <div className="p-4 text-[0.8rem] text-overlay-1">Pick a workspace in the sidebar.</div>;

  return (
    <aside className="flex min-h-0 w-[var(--tools-width,min(46vw,760px))] shrink-0 flex-col border-l border-l-overlay-0 bg-panel-bg" data-testid="workspace-tools" aria-label="Files and Git">
      <div className="flex items-center gap-2 border-b border-b-overlay-0 px-[0.4rem] py-1">
        <nav className="flex gap-[0.15rem]" aria-label="Files and Git">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={cn(BTN, tab === id && "border-overlay-0 bg-surface-0 text-fg")}
              data-testid={`workspace-tools-${id}`}
              aria-pressed={tab === id}
              onClick={() => onTabChange(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <span className="min-w-0 flex-1 overflow-hidden text-right text-[0.72rem] text-ellipsis whitespace-nowrap text-overlay-1" title={row?.path}>
          {row ? row.name || row.path.split("/").pop() : ""}
        </span>
        <button type="button" className={BTN} aria-label="Close Files and Git" onClick={onClose}>×</button>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden [&>*]:min-h-0 [&>*]:min-w-0 [&>*]:flex-1">
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
