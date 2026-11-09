/**
 * CloseAgentGuard.tsx: mounted once in App, the warning `requestCloseSession` raises for an agent session. The
 * screen is `stock:close-guard` (`stock-ui/close-guard/main.tsx`) or the person's package chosen for it; what each
 * answer does (stop, keep running, cancel) is bound here.
 */
import { sessionLabel } from "../workspaceTabs";
import { dismissSessionView, useCloseGuard } from "../closeGuard";
import { usePerchStore } from "../store";
import CloseGuard from "../stock-ui/close-guard/main";
import { StockRoute } from "./mod-root";

export function CloseAgentGuard() {
  const pending = useCloseGuard((s) => s.pending);
  if (!pending) return null;
  const dismiss = () => useCloseGuard.setState({ pending: null });
  const props = {
    sessionId: pending.id,
    label: sessionLabel(pending),
    onCancel: dismiss,
    onKeepRunning: () => { dismissSessionView(pending.id); dismiss(); },
    onStop: (never: boolean) => {
      if (never) usePerchStore.getState().updateSettings({ warnCloseAgent: false });
      usePerchStore.getState().deleteSession(pending.id);
      dismiss();
    },
  };
  return <StockRoute key={pending.id} name="close-guard" props={props} stock={CloseGuard} />;
}
