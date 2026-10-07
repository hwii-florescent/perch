import { usePerchStore } from "../store";
import { cn } from "../lib/cn";
import { useFileTabs } from "../fileTabs";
import { segment } from "./ui/segment";
import { WorkspaceFilesView } from "./WorkspaceFiles";
import { WorkspaceGitReviewPane } from "./WorkspaceGitReviewPane";

const BTN = "px-[0.8rem] text-[0.75rem] [font-weight:inherit] [line-height:inherit]";

export type WorkspaceToolsTab = "files" | "gitReview";

const TABS: { id: WorkspaceToolsTab; label: string }[] = [
  { id: "files", label: "Files" },
  { id: "gitReview", label: "Git" },
];

/** The workspace the drawer shows and whether it offers Git. */
function useToolsContext(requestedWorkspaceId?: string | null) {
  const activeId = usePerchStore((state) =>
    state.activeWorkspaceId ?? state.sessions.find((candidate) => candidate.id === state.sessionId)?.workspaceId ?? null);
  const workspaceId = requestedWorkspaceId ?? activeId;
  const row = usePerchStore((state) => state.workspaces.find((candidate) => candidate.id === workspaceId));
  const project = usePerchStore((state) => state.workspaceProjects.find((candidate) => candidate.id === row?.projectId));
  // A requested id with no local row is a remote checkout, offered Git only
  // when its host relays git (`ProjectGitReviewButton`).
  const isGit = Boolean(row?.branch || project?.repoPath || (requestedWorkspaceId && !row));
  return { workspaceId, row, isGit };
}

/** Files / Git switch. It lives in the top row beside the drawer toggle
 * (UI-UX-DIRECTION.md D8), not inside the drawer. */
export function WorkspaceToolsTabs({ requestedWorkspaceId, tab, onTabChange }: {
  requestedWorkspaceId?: string | null;
  tab: WorkspaceToolsTab;
  onTabChange: (tab: WorkspaceToolsTab) => void;
}) {
  const { isGit } = useToolsContext(requestedWorkspaceId);
  const tabs = isGit ? TABS : TABS.filter(({ id }) => id !== "gitReview");
  const shown = tab === "gitReview" && !isGit ? "files" : tab;
  return (
    <nav className="flex items-stretch gap-[2px] self-stretch px-[3px] py-[3px]" aria-label="Files and Git">
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={cn(segment({ active: shown === id }), BTN)}
          data-testid={`workspace-tools-${id}`}
          aria-pressed={shown === id}
          onClick={() => onTabChange(id)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

/**
 * The desktop drawer behind the toolbar's right-panel button: the file
 * explorer and Git for whichever workspace is active. A clicked file opens as
 * a top-row tab beside the workspace's sessions (`fileTabs.ts`). Terminals are session
 * tabs, not drawer content. Git shows only for a git checkout. It belongs to
 * the app, not to a session's saved layout, so it stays open across chats and
 * simply follows the workspace the user clicks.
 */
export function WorkspaceTools({ requestedWorkspaceId, tab }: {
  /** The workspace a sidebar Files/Git action named, if any. */
  requestedWorkspaceId?: string | null;
  tab: WorkspaceToolsTab;
}) {
  const { workspaceId, row, isGit } = useToolsContext(requestedWorkspaceId);
  if (tab === "gitReview" && !isGit) tab = "files";
  const missing = <div className="p-4 text-[0.8rem] text-overlay-1">Pick a workspace in the sidebar.</div>;

  return (
    <aside className="flex min-h-0 w-[var(--tools-width,min(46vw,760px))] shrink-0 flex-col border-l border-l-overlay-0 bg-panel-bg" data-testid="workspace-tools" aria-label="Files and Git">
      <div className="flex items-center gap-2 px-3 py-[3px]">
        <span className="min-w-0 flex-1 overflow-hidden text-[0.72rem] text-ellipsis whitespace-nowrap text-subtext-0" title={row?.path}>
          {row ? row.name || row.path.split("/").pop() : ""}
        </span>
        {tab === "gitReview" && workspaceId && (
          <button type="button" className={BTN} data-testid="workspace-tools-open-review" title="Open the review as a tab" onClick={() => useFileTabs.getState().open(workspaceId, "", "review")}>
            Open as tab
          </button>
        )}
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
