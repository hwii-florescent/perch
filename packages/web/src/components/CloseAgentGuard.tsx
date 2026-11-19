/**
 * CloseAgentGuard.tsx: mounted once in App, the warning `requestCloseSession` raises for an agent session. The
 * screen is `stock:close-guard` (`stock-ui/close-guard/main.tsx`) or the person's package chosen for it; what each
 * answer does (stop, keep running, cancel) is bound here.
 */
import { sessionLabel } from "../workspaceTabs";
import { dismissSessionView, subSessionsOf, useCloseGuard } from "../closeGuard";
import { stopAgent } from "../agentTerminals";
import { usePerchStore } from "../store";
import CloseGuard from "../stock-ui/close-guard/main";
import { StockRoute } from "./mod-root";

export function CloseAgentGuard() {
  const pending = useCloseGuard((s) => s.pending);
  const stopping = useCloseGuard((s) => s.stopping);
  if (!pending) return null;
  const dismiss = () => useCloseGuard.setState({ pending: null, stopping: false });
  if (stopping) {
    // A Stop of a lead: only whether its sub-sessions stop too.
    const props = {
      sessionId: pending.id,
      label: sessionLabel(pending),
      action: "stop" as const,
      subSessions: subSessionsOf(pending.id) || undefined,
      onCancel: dismiss,
      onKeepRunning: dismiss,
      onStop: (_never: boolean, stopSubSessions?: boolean) => { stopAgent(pending.id, !!stopSubSessions); dismiss(); },
    };
    return <StockRoute key={`stop-${pending.id}`} name="close-guard" props={props} stock={CloseGuard} />;
  }
  const props = {
    sessionId: pending.id,
    label: sessionLabel(pending),
    subSessions: subSessionsOf(pending.id) || undefined,
    onCancel: dismiss,
    onKeepRunning: () => { dismissSessionView(pending.id); dismiss(); },
    onStop: (never: boolean, stopSubSessions?: boolean) => {
      if (never) usePerchStore.getState().updateSettings({ warnCloseAgent: false });
      usePerchStore.getState().deleteSession(pending.id, stopSubSessions);
      dismiss();
    },
  };
  return <StockRoute key={pending.id} name="close-guard" props={props} stock={CloseGuard} />;
}
