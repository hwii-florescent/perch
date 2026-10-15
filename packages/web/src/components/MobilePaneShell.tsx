import { ChatView } from "../views/Chat";
import { MobileFiles } from "./MobileFiles";
import { WorkspaceGitReviewPane } from "./WorkspaceGitReviewPane";
import { useToolsContext } from "./WorkspaceTools";
import { useFileTabs } from "../fileTabs";
import { cn } from "../lib/cn";

// A plain terminal is a session like any agent (the `Terminal` provider), so there is no separate shell pane.
export type MobilePaneKind = "chat" | "files" | "gitReview";

const ICON = { width: 20, height: 20, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

// The same glyphs as the desktop chrome where one exists (Files/Git drawer tabs).
const PANES: { kind: MobilePaneKind; label: string; testId: string; icon: React.ReactNode }[] = [
  { kind: "chat", label: "Session", testId: "mobile-pane-chat", icon: <svg {...ICON}><rect x="1.5" y="2.5" width="13" height="11" rx="2" /><path d="m4.5 6 2 2-2 2M8 10.5h3" /></svg> },
  { kind: "files", label: "Files", testId: "mobile-pane-files", icon: <svg {...ICON}><path d="M2 4.5a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" /></svg> },
  { kind: "gitReview", label: "Git", testId: "mobile-pane-git", icon: <svg {...ICON}><circle cx="4.5" cy="3.5" r="1.5" /><circle cx="4.5" cy="12.5" r="1.5" /><circle cx="11.5" cy="6" r="1.5" /><path d="M4.5 5v6M11.5 7.5c0 2-3 2-7 3.5" /></svg> },
];

export interface MobilePaneShellProps {
  activePane: MobilePaneKind;
  workspaceFilesWorkspaceId?: string | null;
  workspaceGitReviewWorkspaceId?: string | null;
  onPaneChange: (pane: MobilePaneKind) => void;
  onCloseFiles: () => void;
  onCloseGitReview: () => void;
}

/**
 * Narrow-width canvas: the active pane over a bottom tab bar (thumb reach, and
 * the agent gets the full height above it). Exactly one content component is
 * mounted at a time; inactive desktop Dockview panels are not merely hidden,
 * which keeps mobile memory, keyboard focus, and terminal lifecycle bounded to
 * the pane the user is actually viewing.
 *
 * Files and Git are the drawer's own: the workspace a Switcher request named, else
 * the active session's (`useToolsContext`), and Git only for a git checkout.
 * Leaving either pane drops its request, so it never goes stale.
 */
export function MobilePaneShell({
  activePane,
  workspaceFilesWorkspaceId,
  workspaceGitReviewWorkspaceId,
  onPaneChange,
  onCloseFiles,
  onCloseGitReview,
}: MobilePaneShellProps) {
  const { workspaceId, isGit } = useToolsContext(workspaceFilesWorkspaceId ?? workspaceGitReviewWorkspaceId);
  const panes = isGit ? PANES : PANES.filter(({ kind }) => kind !== "gitReview");
  const shown = activePane === "gitReview" && !isGit ? "files" : activePane;

  function selectPane(pane: MobilePaneKind) {
    if (pane !== "gitReview") onCloseGitReview();
    if (pane !== "files") onCloseFiles();
    // As on the desktop, an open file covers the session until the session is chosen again.
    if (pane === "chat") useFileTabs.getState().showSession();
    onPaneChange(pane);
  }

  return (
    <section className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-panel-bg" data-testid="mobile-pane-shell" aria-label="Mobile workspace pane">
      <div className="mobile-pane-shell__content flex min-h-0 w-full min-w-0 flex-1 overflow-hidden" data-testid={`mobile-active-pane-${shown}`}>
        {shown === "chat" && <ChatView />}
        {shown === "files" && (workspaceId
          ? <MobileFiles workspaceId={workspaceId} />
          : <div className="grid flex-1 place-items-center p-6 text-center text-[0.78rem] text-subtext-0">Pick a workspace in the switcher.</div>)}
        {shown === "gitReview" && (workspaceId
          ? <WorkspaceGitReviewPane key={workspaceId} workspaceId={workspaceId} />
          : <div className="grid flex-1 place-items-center p-6 text-center text-[0.78rem] text-subtext-0">Pick a workspace in the switcher.</div>)}
      </div>
      <nav className="flex shrink-0 border-t border-t-overlay-0 bg-surface-0 pb-[env(safe-area-inset-bottom)]" aria-label="Mobile panes">
        {panes.map(({ kind, label, testId, icon }) => (
          <button
            key={kind}
            type="button"
            className={cn(
              "flex min-h-[3.25rem] flex-1 cursor-pointer flex-col items-center justify-center gap-[0.15rem] bg-transparent text-[0.68rem] [border:0] [font-family:inherit] focus-visible:bg-surface-1",
              shown === kind ? "text-fg" : "text-subtext-0",
            )}
            data-testid={testId}
            aria-pressed={shown === kind}
            onClick={() => selectPane(kind)}
          >
            {icon}
            {label}
          </button>
        ))}
      </nav>
    </section>
  );
}
