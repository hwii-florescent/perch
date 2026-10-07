import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { sessionLabel } from "../workspaceTabs";
import { useCloseGuard } from "../closeGuard";
import { usePerchStore } from "../store";

/** Mounted once in App: the warning `requestCloseSession` raises for an agent session. */
export function CloseAgentGuard() {
  const pending = useCloseGuard((s) => s.pending);
  const [never, setNever] = useState(false);
  if (!pending) return null;
  const dismiss = () => { useCloseGuard.setState({ pending: null }); setNever(false); };
  return (
    <ConfirmDialog
      message={`Close "${sessionLabel(pending)}"?\n\nClosing this tab stops its agent and any shells in it. The agent's own transcript stays on disk.`}
      confirmLabel="Close"
      onCancel={dismiss}
      onConfirm={() => {
        if (never) usePerchStore.getState().updateSettings({ warnCloseAgent: false });
        usePerchStore.getState().deleteSession(pending.id);
        dismiss();
      }}
    >
      <label className="mb-4 flex cursor-pointer items-center gap-2 text-[0.8rem] text-subtext-0">
        <input type="checkbox" data-testid="close-agent-never" checked={never} onChange={(e) => setNever(e.target.checked)} />
        Don't show this warning again
      </label>
    </ConfirmDialog>
  );
}
