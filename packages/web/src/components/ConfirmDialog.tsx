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
 * `.model-chip__popover` comment in styles/composer.css).
 */
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";

const BTN = "cursor-pointer rounded-ui border px-[0.85rem] py-[0.35rem] text-[0.82rem] [font-family:inherit] [transition:border-color_0.12s_ease,background_0.12s_ease] hover:border-accent";

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
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[rgba(0,0,0,0.55)]" onClick={onCancel}>
      <div
        className="w-[min(360px,calc(100vw_-_2rem))] rounded-ui border border-accent bg-panel-bg p-4 shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
        data-testid="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="confirm-dialog__message mx-0 mt-0 mb-4 text-[0.88rem] leading-[1.4] whitespace-pre-wrap text-fg">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={cn(BTN, "border-overlay-0 bg-transparent text-fg")}
            data-testid="confirm-cancel"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={cn(BTN, "border-accent bg-accent text-panel-bg hover:[filter:brightness(1.1)]")}
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
