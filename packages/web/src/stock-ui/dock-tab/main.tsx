//! Dock tab, the stock screen `stock:dock-tab`: one tab of a docked pane group (a session's chat, a shell, a split-in
//! session, a package's panel). A right-click opens the pane menu; the chat's tab says which agent runs in it when pane
//! labels are on.
//!
//! The tab strip itself is dockview's (the engine): dragging a tab, dropping it on an edge, and which tab is active
//! stay its own, and `defaultTab` is its title and close button as dockview draws them. A copy may draw its own title
//! and close from `title` and `onClose` instead. Closing goes through Perch (a closed shell pane's process ends with
//! it). Perch shows this screen, or the person's package chosen for it (`perch mod use stock:dock-tab <id>`), with the
//! same props.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:dock-tab` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside it
//! (docs/MOD-SDK.md).
import type { DockTabProps } from "@perch/sdk";

export default function DockTab({ id, agent, defaultTab, onMenu }: DockTabProps) {
  return (
    <div
      className="pane-tab"
      data-testid={`pane-tab-${id}`}
      onContextMenu={(event) => {
        event.preventDefault();
        onMenu(event.clientX, event.clientY);
      }}
    >
      {defaultTab}
      {agent && (
        // NOT "pane-tab-agent-badge": e2e locators match the `pane-tab-` prefix to find the real tabs.
        <span className="pane-tab__agent-badge" data-testid="chat-tab-agent-badge">
          · {agent}
        </span>
      )}
    </div>
  );
}
