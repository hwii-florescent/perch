//! Pane menu, the stock screen `stock:pane-menu`: the right-click menu of a docked pane's tab (split with a new
//! terminal, add a session inside the tab, show beside an open tab, zoom, rename, stop agent, close). Perch opens it
//! from the docked layout; or the person's package chosen for it (`perch mod use stock:pane-menu <id>`) with the
//! same props.
//!
//! The actions are Perch's own (`actions`: the dock controller's split, zoom, rename and close, and the agent stop),
//! for the pane the menu was opened on; `canClose`, `maximized` and `canStopAgent` say what applies. Where the menu
//! sits, the rename field and the rows are this screen's. A press outside or Escape closes it.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:pane-menu` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside
//! it (docs/MOD-SDK.md).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buttonClass as button, menuDividerClass as menuDivider, menuItemClass as menuItem, menuPanel, type PaneMenuScreenProps } from "@perch/sdk";

export default function PaneMenu({ title, x, y, sessionId, canClose, maximized, canStopAgent, actions, onClose }: PaneMenuScreenProps) {
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

  // Clamp so the menu never renders off-screen for a right-click near an edge.
  const MENU_W = 180;
  const MENU_H = renaming ? 220 : 180;
  const left = Math.min(x, window.innerWidth - MENU_W - 8);
  const top = Math.min(y, window.innerHeight - MENU_H - 8);

  function commitRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== title) actions.rename(trimmed);
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
            className="min-w-0 flex-1 rounded-ui bg-surface-1 px-2 py-[0.3rem] text-[0.8rem] text-fg [font-family:inherit] focus:[outline:1px_solid_var(--accent)]"
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
            className={button({ variant: "primary", size: "sm" })}
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
              actions.splitNew("right");
              onClose();
            }}
          >
            Split right with new terminal
          </button>
          <button
            type="button"
            className={menuItem()}
            data-testid="pane-menu-split-down"
            onClick={() => {
              actions.splitNew("below");
              onClose();
            }}
          >
            Split below with new terminal
          </button>
          <button
            type="button"
            className={menuItem()}
            data-testid="pane-menu-split-session"
            title="Add a session pane to this tab's saved layout; other tabs stay separate"
            onClick={() => {
              actions.splitSession();
              onClose();
            }}
          >
            Add session inside this tab…
          </button>
          {sessionId && (
            <button
              type="button"
              className={menuItem()}
              data-testid="pane-menu-split-tab"
              title="Show two open tabs side by side; both stay in the tab strip"
              onClick={() => {
                actions.showBesideTab(left, top);
                onClose();
              }}
            >
              Show beside an open tab…
            </button>
          )}
          <button
            type="button"
            className={menuItem()}
            data-testid="pane-menu-zoom"
            onClick={() => {
              actions.toggleZoom();
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
            Rename pane
          </button>
          <div className={menuDivider} />
          {canStopAgent && (
            <button
              type="button"
              className={menuItem({ danger: true })}
              data-testid="pane-menu-stop-agent"
              title="Kill the agent process. Restart resumes the conversation."
              onClick={() => {
                actions.stopAgent();
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
              actions.close();
              onClose();
            }}
          >
            Close pane
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
