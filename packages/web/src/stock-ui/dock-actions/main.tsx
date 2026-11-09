//! Dock group actions, the stock screen `stock:dock-actions`: the buttons at the right end of a docked pane group's
//! tab strip: add a shell tab (in a group of shells), split another session in beside it, and the pane menu.
//!
//! What each does is Perch's (props: adding a shell starts one, the session picker and the pane menu are their own
//! screens, `stock:session-split` and `stock:pane-menu`); a missing action is not offered in this group. The strip is
//! dockview's. Perch shows this screen, or the person's package chosen for it (`perch mod use stock:dock-actions
//! <id>`), with the same props.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:dock-actions` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside
//! it (docs/MOD-SDK.md).
import { EllipsisIcon, PlusIcon, type DockActionsProps } from "@perch/sdk";

export default function DockActions({ onAddTerminal, onSplitSession, onMenu }: DockActionsProps) {
  return (
    <>
      {onAddTerminal && (
        <button
          type="button"
          className="dockview-group-action dockview-group-action--add-terminal"
          data-testid="terminal-add-tab"
          title="Add terminal"
          aria-label="Add terminal"
          onClick={onAddTerminal}
        >
          <PlusIcon />
        </button>
      )}
      {onSplitSession && (
        <button
          type="button"
          className="dockview-group-action dockview-group-action--split-session"
          data-testid="pane-split-session"
          title="Split with another session"
          aria-label="Split with another session"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            onSplitSession(rect.right, rect.bottom);
          }}
        >
          ⛶
        </button>
      )}
      {onMenu && (
        <button
          type="button"
          className="dockview-group-action dockview-group-action--pane-menu"
          data-testid="pane-group-menu"
          title="Split / zoom / rename / close pane"
          aria-label="Split / zoom / rename / close pane"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            onMenu(rect.right, rect.bottom);
          }}
        >
          <EllipsisIcon />
        </button>
      )}
    </>
  );
}
