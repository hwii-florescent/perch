import { useEffect, useMemo } from "react";
import { WorkspaceGitReview } from "./WorkspaceGitReview";
import { EMPTY_GIT_REVIEW_STATE, useWorkspaceGitReviewStore } from "../gitReviewStore";
import { usePerchStore } from "../store";

/**
 * Shared workspace Git/review surface used by both Dockview and the narrow
 * mobile canvas. Keeping the workspace lookup and request wiring here means
 * a mobile pane uses the same durable workspace id and server snapshots as a
 * desktop panel instead of maintaining a second, subtly different adapter.
 */
export function WorkspaceGitReviewPane({ workspaceId }: { workspaceId: string }) {
  const state = useWorkspaceGitReviewStore((current) => current.workspaces[workspaceId] ?? EMPTY_GIT_REVIEW_STATE);
  const getWorkspaceActions = useWorkspaceGitReviewStore((current) => current.getWorkspaceActions);
  const actions = useMemo(() => getWorkspaceActions(workspaceId), [getWorkspaceActions, workspaceId]);
  const workspace = usePerchStore((current) => current.workspaces.find((candidate) => candidate.id === workspaceId));
  const sessions = usePerchStore((current) => current.sessions);
  const workspaceSessions = useMemo(
    () => sessions
      .filter((session) => !session.archived && (session.workspaceId === workspaceId || (workspace != null && (session.hostId ?? "local") === workspace.hostId && session.cwd === workspace.path)))
      .map((session) => ({ id: session.id, title: session.title || "New session", agent: session.cliProviderId ?? session.lastAgent })),
    [sessions, workspace, workspaceId],
  );

  // A remote host's workspace has no local row; name it after its sessions' folder.
  const remoteName = useMemo(
    () => sessions.find((session) => session.workspaceId === workspaceId)?.cwd.replace(/\/+$/, "").split("/").pop(),
    [sessions, workspaceId],
  );

  useEffect(() => {
    if (usePerchStore.getState().connected) actions.refreshStatus();
  }, [actions]);

  return (
    <WorkspaceGitReview
      workspaceId={workspaceId}
      workspaceName={workspace?.name ?? remoteName}
      startSnapshot={workspace?.startSnapshot}
      lastAgentTurn={state.lastAgentTurn ?? undefined}
      agentSessionId={state.agentSessionId}
      status={state.status}
      statusState={state.statusState}
      statusError={state.statusError}
      actionError={state.actionError}
      diff={state.diff}
      diffState={state.diffState}
      diffError={state.diffError}
      comments={state.comments}
      refs={state.refs}
      batchDelivery={state.batchDelivery}
      sessions={workspaceSessions}
      currentRevision={state.diff?.sourceRevision}
      actions={actions}
    />
  );
}
