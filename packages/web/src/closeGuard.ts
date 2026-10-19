/**
 * closeGuard.ts — the warning before closing an agent session. Closing a tab
 * ends its agent, so a click on ×, Cmd+W or a sidebar close asks first;
 * terminals close without asking. "Don't show this again" turns the
 * `warnCloseAgent` setting off; Settings turns it back on.
 */
import { create } from "zustand";
import type { SessionSummary } from "@perch/shared";
import { usePerchStore } from "./store";
import { isWatchingAgent } from "./agentTerminals";
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

/** The session waiting on the warning dialog, if any. */
export const useCloseGuard = create<{ pending: SessionSummary | null }>(() => ({ pending: null }));

/** Leave execution discoverable in the nest, but release this view. */
export function dismissSessionView(sessionId: string): void {
  forgetSessionTerminals(sessionId);
  if (usePerchStore.getState().sessionId === sessionId) usePerchStore.getState().showWorkspaceHome();
}

/** Owners close for everyone; a watcher can only dismiss its own view. */
export function requestCloseSession(sessionId: string): void {
  const state = usePerchStore.getState();
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (isWatchingAgent(sessionId)) { dismissSessionView(sessionId); return; }
  if (session && isAgentSession(session) && warnOnCloseAgent()) useCloseGuard.setState({ pending: session });
  else state.deleteSession(sessionId);
}
