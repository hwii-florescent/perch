import type { MobilePaneKind, MobilePanesProps } from "@perch/sdk";
import { AgentPane } from "../views/AgentPane";
import { MobileFiles } from "./MobileFiles";
// The phone's Git pane is Perch's own review (a phone never runs the desktop's choice for it): the stock source.
import Review from "../stock-ui/review/main";
import Panes from "../stock-ui/mobile-panes/main";
import { useToolsContext } from "./WorkspaceTools";
import { useFileTabs } from "../fileTabs";
import { StockRoute } from "./mod-root";

// A plain terminal is a session like any agent (the `Terminal` provider), so there is no separate shell pane.
export type { MobilePaneKind };

const PANES: { kind: MobilePaneKind; label: string }[] = [
  { kind: "chat", label: "Session" },
  { kind: "files", label: "Files" },
  { kind: "gitReview", label: "Git" },
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
 * Narrow-width canvas. The screen is `stock:mobile-panes` (`stock-ui/mobile-panes/`), or the person's copy once turned
 * on for this phone (`phoneMods.ts`): it draws the bar and places the one pane this file mounts. Exactly one content
 * component is mounted at a time; inactive desktop Dockview panels are not merely hidden, which keeps mobile memory,
 * keyboard focus, and terminal lifecycle bounded to the pane the user is actually viewing.
 *
 * Files and Git are the drawer's own: the workspace a Switcher request named, else the active session's
 * (`useToolsContext`), and Git only for a git checkout. Leaving either pane drops its request, so it never goes stale.
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
    if (!panes.some(({ kind }) => kind === pane)) return;
    if (pane !== "gitReview") onCloseGitReview();
    if (pane !== "files") onCloseFiles();
    // As on the desktop, an open file covers the session until the session is chosen again.
    if (pane === "chat") useFileTabs.getState().showSession();
    onPaneChange(pane);
  }

  const content = shown === "chat" ? <AgentPane phone />
    : !workspaceId ? null
    : shown === "files" ? <MobileFiles workspaceId={workspaceId} />
    : <Review key={workspaceId} workspaceId={workspaceId} />;
  const props: MobilePanesProps = { panes, shown, content, workspaceId: workspaceId ?? null, onSelect: selectPane };
  return <StockRoute name="mobile-panes" props={props} stock={Panes} />;
}
