import { ChatView } from "../views/Chat";
import { TerminalView } from "../views/Terminal";
import { WorkspaceFilesView } from "./WorkspaceFiles";
import { WorkspaceGitReviewPane } from "./WorkspaceGitReviewPane";

export type MobilePaneKind = "chat" | "terminal" | "files" | "gitReview";

export interface MobilePaneShellProps {
  activePane: MobilePaneKind;
  workspaceFilesWorkspaceId?: string | null;
  workspaceGitReviewWorkspaceId?: string | null;
  fallbackWorkspaceId?: string | null;
  onPaneChange: (pane: MobilePaneKind) => void;
  onCloseFiles: () => void;
  onCloseGitReview: () => void;
}

/**
 * Narrow-width canvas. Exactly one content component is mounted at a time;
 * inactive desktop Dockview panels are not merely hidden, which keeps mobile
 * memory, keyboard focus, and terminal lifecycle bounded to the pane the user
 * is actually viewing.
 */
export function MobilePaneShell({
  activePane,
  workspaceFilesWorkspaceId,
  workspaceGitReviewWorkspaceId,
  fallbackWorkspaceId,
  onPaneChange,
  onCloseFiles,
  onCloseGitReview,
}: MobilePaneShellProps) {
  const filesWorkspaceId = workspaceFilesWorkspaceId ?? fallbackWorkspaceId ?? null;
  const gitWorkspaceId = workspaceGitReviewWorkspaceId ?? fallbackWorkspaceId ?? null;

  function selectPane(pane: MobilePaneKind) {
    if (activePane === "gitReview" && pane !== "gitReview") onCloseGitReview();
    onPaneChange(pane);
  }

  return (
    <section className="mobile-pane-shell" data-testid="mobile-pane-shell" aria-label="Mobile workspace pane">
      <nav className="mobile-pane-shell__nav" aria-label="Mobile panes">
        <button
          type="button"
          className={activePane === "chat" ? "mobile-pane-shell__tab mobile-pane-shell__tab--active" : "mobile-pane-shell__tab"}
          data-testid="mobile-pane-chat"
          aria-pressed={activePane === "chat"}
          onClick={() => selectPane("chat")}
        >
          Chat
        </button>
        <button
          type="button"
          className={activePane === "terminal" ? "mobile-pane-shell__tab mobile-pane-shell__tab--active" : "mobile-pane-shell__tab"}
          data-testid="mobile-pane-terminal"
          aria-pressed={activePane === "terminal"}
          onClick={() => selectPane("terminal")}
        >
          Terminal
        </button>
        <button
          type="button"
          className={activePane === "files" ? "mobile-pane-shell__tab mobile-pane-shell__tab--active" : "mobile-pane-shell__tab"}
          data-testid="mobile-pane-files"
          aria-pressed={activePane === "files"}
          onClick={() => selectPane("files")}
        >
          Files
        </button>
        <button
          type="button"
          className={activePane === "gitReview" ? "mobile-pane-shell__tab mobile-pane-shell__tab--active" : "mobile-pane-shell__tab"}
          data-testid="mobile-pane-git"
          aria-pressed={activePane === "gitReview"}
          onClick={() => selectPane("gitReview")}
        >
          Git
        </button>
      </nav>
      <div className="mobile-pane-shell__content" data-testid={`mobile-active-pane-${activePane}`}>
        {activePane === "chat" && <ChatView />}
        {activePane === "terminal" && <TerminalView active />}
        {activePane === "files" && (filesWorkspaceId
          ? <WorkspaceFilesView workspaceId={filesWorkspaceId} onClose={() => { onCloseFiles(); selectPane("chat"); }} />
          : <div className="mobile-pane-shell__empty">Choose a workspace from Switch before opening files.</div>)}
        {activePane === "gitReview" && (gitWorkspaceId
          ? <WorkspaceGitReviewPane workspaceId={gitWorkspaceId} />
          : <div className="mobile-pane-shell__empty">Choose a workspace from Switch before opening Git review.</div>)}
      </div>
    </section>
  );
}
