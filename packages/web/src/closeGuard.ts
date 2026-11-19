/**
 * closeGuard.ts — the warning before closing an agent session. Closing a tab
 * ends its agent, so a click on ×, Cmd+W or a sidebar close asks first;
 * terminals close without asking. A lead with sub-sessions always asks
 * whether to keep them (as ordinary sessions) or close them too. "Don't show this again" turns the
 * `warnCloseAgent` setting off; Settings turns it back on.
 */
import { create } from "zustand";
import type { SessionSummary } from "@perch/shared";
import { usePerchStore } from "./store";
import { isWatchingAgent, stopAgent } from "./agentTerminals";
import { forgetSessionTerminals } from "./terminalKeeper";

/** Settings > "Warn before closing an agent" (the server's `warnCloseAgent`; on until the settings arrive). */
function warnOnCloseAgent(): boolean {
  return usePerchStore.getState().settings?.warnCloseAgent !== false;
}

/** A session whose harness is an agent CLI (not a plain terminal). */
export function isAgentSession(session: SessionSummary): boolean {
  const provider = session.currentProviderId ?? session.cliProviderId;
  return provider !== undefined && provider !== "terminal";
}

/** How many sub-sessions of `leadId` the core lists. */
export function subSessionsOf(leadId: string): number {
  return usePerchStore.getState().sessions.filter((s) => s.parentSessionId === leadId).length;
}

/** The session waiting on the warning dialog, if any; `stopping`: a Stop of it asks, not a close. */
export const useCloseGuard = create<{ pending: SessionSummary | null; stopping?: boolean }>(() => ({ pending: null }));

/** A person's Stop of an agent: a lead with sub-sessions asks first whether they stop too (the guard's default
 * keeps them as sessions); any other agent stops at once. */
export function requestStopAgent(sessionId: string): void {
  const session = usePerchStore.getState().sessions.find((candidate) => candidate.id === sessionId);
  if (session && subSessionsOf(sessionId) > 0) useCloseGuard.setState({ pending: session, stopping: true });
  else stopAgent(sessionId);
}

/** Leave execution discoverable in the workspace, but release this view. */
export function dismissSessionView(sessionId: string): void {
  forgetSessionTerminals(sessionId);
  if (usePerchStore.getState().sessionId === sessionId) usePerchStore.getState().showWorkspaceHome();
}

/** Owners close for everyone; a watcher can only dismiss its own view. */
export function requestCloseSession(sessionId: string): void {
  const state = usePerchStore.getState();
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (isWatchingAgent(sessionId)) { dismissSessionView(sessionId); return; }
  // A lead with sub-sessions always asks what becomes of them, even with the warning off.
  if (session && (subSessionsOf(sessionId) > 0 || (isAgentSession(session) && warnOnCloseAgent()))) useCloseGuard.setState({ pending: session, stopping: false });
  else state.deleteSession(sessionId);
}
