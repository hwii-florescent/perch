/**
 * PaneContextMenu.tsx — Phase 5 right-click context menu for dockview panel
 * tabs: Split Right, Split Down, Split with Session, Zoom/Restore (toggle), Rename (inline
 * input), Close. Portal-rendered into `document.body` with `position:
 * fixed`, following the same click-outside/Escape-to-close pattern as
 * `ModelChip.tsx`'s popover and `Sidebar.tsx`'s `SessionMenu`.
 *
 * All actions are routed through the existing `DockviewController` (see
 * `dockview/dockviewController.ts`) rather than touching the dockview `api`
 * directly here, so this component never duplicates split/close/maximize
 * plumbing — it only decides *which* panel those actions apply to (via
 * `setActivePanel`) and *when* to fire them.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DockviewController } from "../dockview/dockviewController";
import { canStopAgent, stopAgent } from "../agentTerminals";
import { menuDivider, menuItem, menuPanel } from "./ui/menu";
import { useSplitSets } from "../splitSets";

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
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(title);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node)) return;
      onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (renaming) renameInputRef.current?.focus();
  }, [renaming]);

  const canClose = controller.canClosePanel(panelId);
  const maximized = controller.isPanelMaximized(panelId);

  // Clamp so the menu never renders off-screen for a right-click near an edge.
  const MENU_W = 180;
  const MENU_H = renaming ? 220 : 180;
  const left = Math.min(x, window.innerWidth - MENU_W - 8);
  const top = Math.min(y, window.innerHeight - MENU_H - 8);

  function commitRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== title) controller.renamePanel(panelId, trimmed);
    onClose();
  }

  return createPortal(
    <div
      className={menuPanel}
      data-testid="pane-context-menu"
      ref={menuRef}
      style={{ position: "fixed", top, left, zIndex: 9999, minWidth: MENU_W }}
    >
      {renaming ? (
        <div className="flex items-center gap-[0.35rem] px-2 py-[0.4rem]">
          <input
            type="text"
            className="min-w-0 flex-1 rounded-ui border border-overlay-0 bg-surface-1 px-2 py-[0.3rem] text-[0.8rem] text-fg [font-family:inherit] focus:[outline:1px_solid_var(--accent)]"
            data-testid="pane-menu-rename-input"
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") onClose();
            }}
          />
          <button
            type="button"
            className="shrink-0 cursor-pointer rounded-ui bg-accent px-[0.55rem] py-[0.3rem] text-[0.78rem] font-semibold text-panel-bg [border:none] [font-family:inherit]"
            data-testid="pane-menu-rename-confirm"
            onClick={commitRename}
          >
            OK
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className={menuItem()}
            data-testid="pane-menu-split-right"
            onClick={() => {
              controller.setActivePanel(panelId);
              controller.addTerminalPanel("right");
              onClose();
            }}
          >
            Split Right
          </button>
          <button
            type="button"
            className={menuItem()}
            data-testid="pane-menu-split-down"
            onClick={() => {
              controller.setActivePanel(panelId);
              controller.addTerminalPanel("below");
              onClose();
            }}
          >
            Split Down
          </button>
          <button
            type="button"
            className={menuItem()}
            data-testid="pane-menu-split-session"
            onClick={() => {
              onSplitSession();
              onClose();
            }}
          >
            Split with Session…
          </button>
          {sessionId && (
            <button
              type="button"
              className={menuItem()}
              data-testid="pane-menu-split-tab"
              title="Show this tab beside another tab; the tab strip stays one row"
              onClick={() => {
                useSplitSets.getState().openMenu(sessionId, left, top);
                onClose();
              }}
            >
              Split with tab…
            </button>
          )}
          <button
            type="button"
            className={menuItem()}
            data-testid="pane-menu-zoom"
            onClick={() => {
              controller.setActivePanel(panelId);
              controller.toggleMaximizeActive();
              onClose();
            }}
          >
            {maximized ? "Restore" : "Zoom"}
          </button>
          <button
            type="button"
            className={menuItem()}
            data-testid="pane-menu-rename"
            onClick={() => {
              setRenameValue(title);
              setRenaming(true);
            }}
          >
            Rename
          </button>
          <div className={menuDivider} />
          {sessionId && canStopAgent(sessionId) && (
            <button
              type="button"
              className={menuItem({ danger: true })}
              data-testid="pane-menu-stop-agent"
              title="Kill the agent process. Restart resumes the conversation."
              onClick={() => {
                stopAgent(sessionId);
                onClose();
              }}
            >
              Stop agent
            </button>
          )}
          <button
            type="button"
            className={menuItem({ danger: true })}
            data-testid="pane-menu-close"
            disabled={!canClose}
            onClick={() => {
              if (!canClose) return;
              controller.setActivePanel(panelId);
              controller.closeActiveTerminalPanel();
              onClose();
            }}
          >
            Close
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
