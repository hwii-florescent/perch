//! Dialog, the stock screen `stock:dialog`: the modal shell of Perch's forms and pickers (Instructions, Memory, a new
//! file's name, Ask agent). Every caller in Perch and a package's `Dialog` from `@perch/sdk` opens this screen, or the
//! person's package chosen for it (`perch mod use stock:dialog <id>`), with the same props. A copy of a dialog that
//! uses `Dialog` (a copy of `stock:instructions`, say) gets the shell chosen here.
//!
//! A dimmed backdrop and one panel; Escape or a press on the backdrop closes it (`onClose`). What is inside, and what
//! closing means, are the caller's.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:dialog` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside it
//! (docs/MOD-SDK.md).
import { createPortal } from "react-dom";
import type { DialogProps } from "@perch/sdk";

export default function Dialog({ title, onClose, children, testId }: DialogProps) {
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
