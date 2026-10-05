import { type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Modal shell for forms and pickers: dimmed backdrop, one borderless panel on
 * the surface colour, Escape or a backdrop click closes it. Confirmations use
 * `ConfirmDialog`; this is for anything with a body. */
export function Dialog({ title, onClose, children, testId }: { title: string; onClose: () => void; children: ReactNode; testId?: string }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}
    >
      <div
        className="grid max-h-[85vh] w-[min(30rem,92vw)] gap-[0.6rem] overflow-y-auto rounded-ui bg-panel-bg p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
      >
        <h2 className="m-0 text-[0.9rem] font-semibold text-fg">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
