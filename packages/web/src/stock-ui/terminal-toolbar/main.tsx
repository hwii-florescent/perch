//! Shell toolbar, the stock screen `stock:terminal-toolbar`: the row over a shell pane's terminal. It picks which of
//! the pane's shells is shown, says whether one runs, opens a new shell beside it and closes the shown one.
//!
//! The shells are Perch's: opening, closing and attaching one, its input and its size stay with the terminal (props
//! name them; this screen only asks). Closing a shell ends its process, so the button is off while one is closing.
//! Perch shows this screen, or the person's package chosen for it (`perch mod use stock:terminal-toolbar <id>`), with
//! the same props. A phone keeps Perch's own.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:terminal-toolbar` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { Select, type TerminalToolbarProps } from "@perch/sdk";

export default function TerminalToolbar({ shells, selected, connected, closing, running, canClose, onSelect, onNew, onClose }: TerminalToolbarProps) {
  return (
    <div className="terminal__toolbar" data-testid="terminal-toolbar">
      {shells.length > 0 && (
        <Select
          className="min-w-0 max-w-[140px]"
          ariaLabel="Shell pane"
          disabled={closing || !connected}
          value={selected}
          onChange={onSelect}
          options={[...(selected ? [] : [{ value: "", label: "Choose a shell", disabled: true }]), ...shells]}
        />
      )}
      <span className="terminal__connection">{running ? "Shell running" : "Shell"}</span>
      <button type="button" data-testid="terminal-new-shell" disabled={!connected || closing} onClick={onNew}>New shell</button>
      <button type="button" data-testid="terminal-close-shell" disabled={!connected || !canClose || closing} onClick={onClose}>{closing ? "Closing…" : "Close shell"}</button>
    </div>
  );
}
