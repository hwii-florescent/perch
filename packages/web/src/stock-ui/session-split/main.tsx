//! Split with session, the stock screen `stock:session-split`: the picker a docked pane group's ⛶ button opens. It
//! lists the other sessions of the workspace; each row is clickable (split that session in to the right of the group
//! it was opened from) and draggable (drop it on any edge, or the centre for a tab, of any group: the dock draws the
//! drop target and makes the split). Perch shows it, or the person's package chosen for it (`perch mod use
//! stock:session-split <id>`), with the same props.
//!
//! The split is Perch's: `onPick` opens the session's panel (an already open one is shown again, never duplicated),
//! and `beginDrag` puts the session on the drag so the dock can read it back.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:session-split` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { SessionSplitProps } from "@perch/sdk";

const MENU_W = 260;
const MENU_MAX_H = 320;

export default function SessionSplit({ sessions, x, y, onPick, beginDrag, onClose }: SessionSplitProps) {
  const menuRef = useRef<HTMLDivElement>(null);

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

  const left = Math.min(x, window.innerWidth - MENU_W - 8);
  const top = Math.min(y, window.innerHeight - MENU_MAX_H - 8);

  return createPortal(
    <div
      className="session-split-popover"
      data-testid="session-split-popover"
      ref={menuRef}
      style={{ position: "fixed", top, left, zIndex: 9999, width: MENU_W, maxHeight: MENU_MAX_H }}
    >
      <div className="session-split-popover__header">Split with session</div>
      {sessions.length === 0 ? (
        <div className="session-split-popover__empty">No other sessions yet</div>
      ) : (
        <div className="session-split-popover__list">
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              className="session-split-popover__item"
              data-testid={`session-split-option-${s.id}`}
              draggable
              onDragStart={(e) => {
                beginDrag(e, s.id);
                // The drag carries on; close so this picker does not sit over the drop target.
                onClose();
              }}
              onClick={() => {
                onPick(s.id);
                onClose();
              }}
              title={s.cwd}
            >
              <span className="session-split-popover__item-title">{s.title || "Untitled session"}</span>
              <span className="session-split-popover__item-cwd">{s.cwd}</span>
              {s.open && <span className="session-split-popover__item-badge">open</span>}
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
