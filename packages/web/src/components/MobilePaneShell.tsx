import { ChatView } from "../views/Chat";
import { TerminalView } from "../views/Terminal";
import { WorkspaceFilesView } from "./WorkspaceFiles";
import { WorkspaceGitReviewPane } from "./WorkspaceGitReviewPane";
import { cn } from "../lib/cn";

const TAB = "min-h-[44px] min-w-[4.2rem] flex-[1_0_auto] cursor-pointer rounded-ui border px-[0.55rem] py-[0.32rem] text-[0.72rem] [font-family:inherit] [line-height:inherit] hover:border-accent focus-visible:border-accent";
const tab = (active: boolean) =>
  cn(TAB, active ? "border-accent bg-accent font-bold text-panel-bg hover:text-fg focus-visible:text-fg" : "border-overlay-0 bg-surface-0 text-overlay-1 hover:text-fg focus-visible:text-fg");

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
    <section className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-panel-bg" data-testid="mobile-pane-shell" aria-label="Mobile workspace pane">
      <nav className="flex shrink-0 gap-[0.15rem] overflow-x-auto border-b border-b-overlay-0 bg-panel-bg px-[0.45rem] py-[0.3rem]" aria-label="Mobile panes">
        <button
          type="button"
          className={tab(activePane === "chat")}
          data-testid="mobile-pane-chat"
          aria-pressed={activePane === "chat"}
          onClick={() => selectPane("chat")}
        >
          Chat
        </button>
        <button
          type="button"
          className={tab(activePane === "terminal")}
          data-testid="mobile-pane-terminal"
          aria-pressed={activePane === "terminal"}
          onClick={() => selectPane("terminal")}
        >
          Terminal
        </button>
        <button
          type="button"
          className={tab(activePane === "files")}
          data-testid="mobile-pane-files"
          aria-pressed={activePane === "files"}
          onClick={() => selectPane("files")}
        >
          Files
        </button>
        <button
          type="button"
          className={tab(activePane === "gitReview")}
          data-testid="mobile-pane-git"
          aria-pressed={activePane === "gitReview"}
          onClick={() => selectPane("gitReview")}
        >
          Git
        </button>
      </nav>
      <div className="mobile-pane-shell__content flex min-h-0 w-full min-w-0 flex-1 overflow-hidden" data-testid={`mobile-active-pane-${activePane}`}>
        {activePane === "chat" && <ChatView />}
        {activePane === "terminal" && <TerminalView active />}
        {activePane === "files" && (filesWorkspaceId
          ? <WorkspaceFilesView workspaceId={filesWorkspaceId} onClose={() => { onCloseFiles(); selectPane("chat"); }} />
          : <div className="grid flex-1 place-items-center p-6 text-center text-[0.78rem] text-subtext-0">Choose a workspace from Switch before opening files.</div>)}
        {activePane === "gitReview" && (gitWorkspaceId
          ? <WorkspaceGitReviewPane workspaceId={gitWorkspaceId} />
          : <div className="grid flex-1 place-items-center p-6 text-center text-[0.78rem] text-subtext-0">Choose a workspace from Switch before opening Git review.</div>)}
      </div>
    </section>
  );
}
