import { useEffect, useState } from "react";
import type { AgentTurnSummary, ClientMessage } from "@perch/shared";
import { socket } from "../../ws";
import { newId } from "../../ids";
import { gitCapabilityForWorkspace } from "../../gitReviewStore";

/** The files the agent changed in this session's newest recorded turn, once it has finished.
 * Uses its own request ids, so it never disturbs the Git review pane. `null` without Git, a turn or a
 * finished comparison. Only the newest turn is offered: older turns are not matched to transcript rows. */
export function useLastTurnChanges(workspaceId: string | undefined, sessionId: string, hostId: string, settled: boolean): AgentTurnSummary | null {
  const [turn, setTurn] = useState<AgentTurnSummary | null>(null);
  useEffect(() => {
    // A turn in progress has no finished comparison, and the previous one is no longer "last".
    if (!settled) setTurn(null);
    if (!workspaceId || !settled || !gitCapabilityForWorkspace(workspaceId)) return;
    const requestId = newId();
    let done = false;
    const stop = socket.onMessage((message) => {
      if (done || !("requestId" in message) || message.requestId !== requestId) return;
      done = true;
      if (message.type !== "git.status.result") { setTurn(null); return; }
      const next = message.lastAgentTurn ?? null;
      setTurn(next && next.sessionId === sessionId && (next.state ?? "complete") === "complete" && next.afterRef && next.changedPaths.length ? next : null);
    });
    // The turn's after-boundary is written just after the agent goes idle.
    const timer = setTimeout(() => socket.send(withHost({ type: "git.status", requestId, workspaceId, sessionId }, hostId)), 600);
    return () => { done = true; clearTimeout(timer); stop(); };
  }, [workspaceId, sessionId, hostId, settled]);
  return turn;
}

export function withHost<T extends ClientMessage>(message: T, hostId: string): T {
  return hostId !== "local" ? { ...message, hostId } as T : message;
}
