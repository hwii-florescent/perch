/**
 * ConfirmDialog.tsx — Wave 1 item 6: small themed confirmation dialog used
 * before destructive/disruptive actions (deleting a session, closing a
 * multi-tab terminal group). Client-only — no protocol involvement.
 *
 * Stateless and reusable: callers render it conditionally at their own call
 * site (same portal-popover precedent as `SessionMenu`/`NewSessionPopover`/
 * `PaneContextMenu` in Sidebar.tsx and `SettingsModal`'s backdrop+panel),
 * rather than a single global App-level singleton. Styled like every other
 * overlay in the app — accent border + panel-bg fill (see
 * `.model-chip__popover` comment in styles.css).
 */
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface ConfirmDialogProps {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onConfirm, onCancel]);

  return createPortal(
    <div className="confirm-dialog__backdrop" onClick={onCancel}>
      <div
        className="confirm-dialog"
        data-testid="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="confirm-dialog__message">{message}</p>
        <div className="confirm-dialog__actions">
          <button
            type="button"
            className="confirm-dialog__btn confirm-dialog__btn--cancel"
            data-testid="confirm-cancel"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="confirm-dialog__btn confirm-dialog__btn--accept"
            data-testid="confirm-accept"
            ref={confirmRef}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
