//! Confirmation, the stock screen `stock:confirm`: the small dialog Perch asks before a destructive or disruptive
//! action (closing an agent, deleting a session, discarding changes). Every caller in Perch, and a package's
//! `ConfirmDialog` from `@perch/sdk`, opens this screen, or the person's package chosen for it
//! (`perch mod use stock:confirm <id>`), with the same props.
//!
//! The caller owns the decision: `onConfirm`/`onCancel` run its action, and `busy` says a confirmed action is in
//! flight, so neither button nor key may start or cancel it again. Enter confirms and Escape cancels (not while an
//! input method is composing, not on key repeat); a click outside cancels; the confirm button takes focus.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:confirm` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside it
//! (docs/MOD-SDK.md).
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { buttonClass, Slot, type ConfirmProps } from "@perch/sdk";

export default function Confirm({
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  children,
  busy = false,
}: ConfirmProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.isComposing || e.repeat || busy) return;
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
  }, [onConfirm, onCancel, busy]);

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[rgba(0,0,0,0.55)]" onClick={() => { if (!busy) onCancel(); }}>
      <Slot
        name="confirm"
        isolate
        data={{ message, confirmLabel, cancelLabel, busy }}
        actions={{ confirm: onConfirm, cancel: onCancel }}
        className="w-[min(360px,calc(100vw_-_2rem))]"
      >
        <div
          className="w-[min(360px,calc(100vw_-_2rem))] rounded-ui bg-panel-bg p-4 shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm"
          data-testid="confirm-dialog"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="confirm-dialog__message mx-0 mt-0 mb-4 text-[0.88rem] leading-[1.4] whitespace-pre-wrap [overflow-wrap:anywhere] text-fg">{message}</p>
          {children}
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonClass()} data-testid="confirm-cancel" disabled={busy} onClick={onCancel}>
              {cancelLabel}
            </button>
            <button type="button" className={buttonClass({ variant: "primary" })} data-testid="confirm-accept" disabled={busy} ref={confirmRef} onClick={onConfirm}>
              {busy ? "Starting…" : confirmLabel}
            </button>
          </div>
        </div>
      </Slot>
    </div>,
    document.body,
  );
}
