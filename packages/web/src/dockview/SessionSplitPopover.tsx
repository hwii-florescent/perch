/**
 * SessionSplitPopover.tsx — "Split with session" picker opened from a pane
 * group's header actions (see `DockviewShell.tsx`'s `PaneGroupHeaderActions`).
 * Lists the other sessions in the workspace; each row is both:
 *
 *   - clickable, for a one-step "split this session in to the right of the
 *     group I opened this from" (the reliable, driveable-by-e2e path), and
 *   - natively HTML5-`draggable`, carrying the session id via
 *     `sessionDrag.ts`'s custom mime type so it can be dropped onto ANY edge
 *     (or centre, for a tab) of ANY group in the shell — dockview's own
 *     drop-target overlay renders the highlight; `DockviewShell.tsx`'s
 *     `onUnhandledDragOver`/`onDidDrop` wiring reads the payload back out and
 *     calls `addSessionChatPanel` with whatever position dockview reports.
 *
 * Positioning/portal/click-outside/Escape mirror `PaneContextMenu.tsx`
 * exactly (same anchor-coordinate `x`/`y` model, same dismiss behavior) —
 * intentionally not shared code, since `PaneContextMenu.tsx` is outside this
 * task's editable file set.
 */
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { SessionSummary } from "@perch/shared";
import { beginSessionDrag } from "./sessionDrag";

export interface SessionSplitPopoverProps {
  /** Candidate sessions to split in — caller has already excluded the
   * session the triggering group is showing and (typically) archived ones. */
  sessions: SessionSummary[];
  /** Session ids that already have an open chat panel somewhere in this
   * shell (`DockviewController.openSessionChatIds()`) — rendered with a
   * "(open)" hint; picking one re-activates that panel instead of opening a
   * duplicate (`addSessionChatPanel` itself is what dedupes; this is purely
   * a label). */
  openSessionIds: string[];
  x: number;
  y: number;
  /** Click path: split `sessionId` in immediately (title supplied so the
   * caller doesn't need a second sessions-array lookup). */
  onPick: (sessionId: string, title: string) => void;
  onClose: () => void;
}

const MENU_W = 260;
const MENU_MAX_H = 320;

export function SessionSplitPopover({ sessions, openSessionIds, x, y, onPick, onClose }: SessionSplitPopoverProps) {
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
          {sessions.map((s) => {
            const isOpen = openSessionIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                className="session-split-popover__item"
                data-testid={`session-split-option-${s.id}`}
                draggable
                onDragStart={(e) => {
                  beginSessionDrag(e, s.id);
                  // Let the drag ghost carry on; close so the popover itself
                  // isn't sitting on top of the drop target the user is
                  // about to drag across.
                  onClose();
                }}
                onClick={() => {
                  onPick(s.id, s.title);
                  onClose();
                }}
                title={s.cwd}
              >
                <span className="session-split-popover__item-title">{s.title || "Untitled session"}</span>
                <span className="session-split-popover__item-cwd">{s.cwd}</span>
                {isOpen && <span className="session-split-popover__item-badge">open</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>,
    document.body,
  );
}
