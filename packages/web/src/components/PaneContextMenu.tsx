/**
 * PaneContextMenu.tsx: the right-click menu of a docked pane's tab. The screen is `stock:pane-menu`
 * (`stock-ui/pane-menu/main.tsx`) or the person's package chosen for it; this file binds its actions to the
 * `DockviewController` (split/close/maximize plumbing stays there), the split sets and the agent stop, for `panelId`.
 */
import type { DockviewController } from "../dockview/dockviewController";
import { canStopAgent, stopAgent } from "../agentTerminals";
import { useSplitSets } from "../splitSets";
import { splitActiveTab } from "../tiledPanes";
import PaneMenu from "../stock-ui/pane-menu/main";
import { StockRoute } from "./mod-root";

export interface PaneContextMenuProps {
  panelId: string;
  title: string;
  /** Viewport coordinates of the right-click, used as the menu's anchor. */
  x: number;
  y: number;
  controller: DockviewController;
  /** The session a chat pane shows; enables "Stop agent". */
  sessionId?: string;
  /** Opens the "Split with session" picker at the menu's anchor. */
  onSplitSession: () => void;
  onClose: () => void;
}

export function PaneContextMenu({ panelId, title, x, y, controller, sessionId, onSplitSession, onClose }: PaneContextMenuProps) {
  const props = {
    panelId, title, x, y, sessionId, onClose,
    canClose: controller.canClosePanel(panelId),
    maximized: controller.isPanelMaximized(panelId),
    canStopAgent: !!sessionId && canStopAgent(sessionId),
    actions: {
      splitNew: (direction: "right" | "below") => splitActiveTab(direction),
      splitSession: onSplitSession,
      showBesideTab: (left: number, top: number) => { if (sessionId) useSplitSets.getState().openMenu(sessionId, left, top); },
      toggleZoom: () => { controller.setActivePanel(panelId); controller.toggleMaximizeActive(); },
      rename: (name: string) => controller.renamePanel(panelId, name),
      stopAgent: () => { if (sessionId) stopAgent(sessionId); },
      close: () => { if (!controller.canClosePanel(panelId)) return; controller.setActivePanel(panelId); controller.closeActiveTerminalPanel(); },
    },
  };
  return <StockRoute name="pane-menu" props={props} stock={PaneMenu} />;
}
