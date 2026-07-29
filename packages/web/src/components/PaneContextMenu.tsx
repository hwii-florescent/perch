/**
 * PaneContextMenu.tsx — Phase 5 right-click context menu for dockview panel
 * tabs: Split Right, Split Down, Zoom/Restore (toggle), Rename (inline
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

export interface PaneContextMenuProps {
  panelId: string;
  title: string;
  /** Viewport coordinates of the right-click, used as the menu's anchor. */
  x: number;
  y: number;
  controller: DockviewController;
  onClose: () => void;
}

export function PaneContextMenu({ panelId, title, x, y, controller, onClose }: PaneContextMenuProps) {
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
      className="pane-context-menu"
      data-testid="pane-context-menu"
      ref={menuRef}
      style={{ position: "fixed", top, left, zIndex: 9999, minWidth: MENU_W }}
    >
      {renaming ? (
        <div className="pane-context-menu__rename">
          <input
            type="text"
            className="pane-context-menu__rename-input"
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
            className="pane-context-menu__rename-confirm"
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
            className="pane-context-menu__item"
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
            className="pane-context-menu__item"
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
            className="pane-context-menu__item"
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
            className="pane-context-menu__item"
            data-testid="pane-menu-rename"
            onClick={() => {
              setRenameValue(title);
              setRenaming(true);
            }}
          >
            Rename
          </button>
          <div className="pane-context-menu__divider" />
          <button
            type="button"
            className="pane-context-menu__item pane-context-menu__item--danger"
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
