//! Close guard, the stock screen `stock:close-guard`: the warning Perch shows before closing an agent's tab, which
//! stops its agent and shells for everyone watching. Perch opens it whenever a close is asked for (the tab's x,
//! `session.request_close`, a key); or the person's package chosen for it (`perch mod use stock:close-guard <id>`)
//! with the same props.
//!
//! The decision stays Perch's: `onStop` stops the session (and, with `never`, turns this warning off in Settings),
//! `onKeepRunning` only dismisses this view of it, `onCancel` does nothing. The question is `ConfirmDialog` from
//! `@perch/sdk`, so a copy chosen for `stock:confirm` draws it.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:close-guard` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { useState } from "react";
import { ConfirmDialog, type CloseGuardProps } from "@perch/sdk";

export default function CloseGuard({ label, onStop, onKeepRunning, onCancel }: CloseGuardProps) {
  const [never, setNever] = useState(false);
  return (
    <ConfirmDialog
      message={`Close "${label}"?\n\nClosing this tab stops its agent and shells for everyone watching. The agent's own transcript stays on disk.`}
      confirmLabel="Stop for everyone"
      onCancel={onCancel}
      onConfirm={() => onStop(never)}
    >
      <button type="button" className="mb-4 text-sm underline" onClick={onKeepRunning}>Keep running and dismiss this view</button>
      <label className="mb-4 flex cursor-pointer items-center gap-2 text-[0.8rem] text-subtext-0">
        <input type="checkbox" data-testid="close-agent-never" checked={never} onChange={(e) => setNever(e.target.checked)} />
        Don't show this warning again
      </label>
    </ConfirmDialog>
  );
}
