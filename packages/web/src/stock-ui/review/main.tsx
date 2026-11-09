//! Review, the stock screen `stock:review`: a workspace's Git status, diff and line comments, stage and
//! discard/commit with previews, Ask agent (Context Bridge) and the review packet sent to an agent. Perch shows
//! one copy per place a review is open (the Files/Git drawer, a review tab, a docked panel) with `workspaceId`;
//! the phone renders this source compiled in. The data and every action are Perch's own (`useGitReview`: one
//! `gitReviewStore` per workspace, versioned comments, server-issued revisions and previews), so a clone changes
//! how the review looks and is used, never how Git or review state is kept.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs
//! and `perch mod clone stock:review` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { useEffect } from "react";
import { useGitReview } from "@perch/sdk";
import { WorkspaceGitReview } from "./review";

export default function Review({ workspaceId }: { workspaceId: string }) {
  const review = useGitReview(workspaceId);
  const { ready, actions } = review;
  // A review restored before its host offers Git (a reload) asks once the offer arrives; asked earlier, every
  // first request fails and stays failed.
  useEffect(() => {
    if (ready) actions.refreshStatus();
  }, [actions, ready]);

  if (!ready) return <div className="terminal__notice" role="status">Waiting for this host to offer Git…</div>;
  return (
    <WorkspaceGitReview
      workspaceId={workspaceId}
      workspaceName={review.workspaceName}
      startSnapshot={review.startSnapshot}
      lastAgentTurn={review.lastAgentTurn}
      agentSessionId={review.agentSessionId}
      status={review.status}
      statusState={review.statusState}
      statusError={review.statusError}
      actionError={review.actionError}
      diff={review.diff}
      diffState={review.diffState}
      diffError={review.diffError}
      comments={review.comments}
      refs={review.refs}
      batchDelivery={review.batchDelivery}
      sessions={review.sessions}
      currentRevision={review.currentRevision}
      actions={actions}
      onAskAgent={review.askAgent}
    />
  );
}
