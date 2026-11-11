//! Phone files, the stock screen `stock:mobile-files`: the Files tool of the phone's drawer. The explorer is the
//! drawer's body. A tapped file opens exactly as a click does on the desktop and then fills the whole screen as a
//! sheet that rises over the drawer: the file's name, and two ways to put it away that a desktop does not have, the ×
//! and pulling the sheet's top down. Putting it away only uncovers the explorer (the file's tab stays open for the
//! desktop and the next visit; its draft is Perch's and survives).
//!
//! The explorer and the editor are Perch's (`explorer`, `editor`: the Files screen's own parts with their drafts,
//! saves and conflicts). A phone screen: drawn only on a phone, and a person's copy runs there only once turned on for
//! that phone (Settings > Mods).
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:mobile-files` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside
//! it (docs/MOD-SDK.md).
import { useRef, useState, type PointerEvent } from "react";
import { CloseIcon, cn, ghostButton, tapButtonClass, type MobileFilesProps } from "@perch/sdk";

/** How far the sheet is pulled before letting go puts it away. */
const DISMISS_PX = 96;

function FileSheet({ path, editor, onBack }: { path: string; editor: MobileFilesProps["editor"]; onBack(): void }) {
  const [pull, setPull] = useState(0);
  const from = useRef<number | null>(null);
  // The distance is also kept in a ref: the release must read the last move, not the last render.
  const pulled = useRef(0);
  const move = (e: PointerEvent) => {
    if (from.current === null) return;
    pulled.current = Math.max(0, e.clientY - from.current);
    setPull(pulled.current);
  };
  const release = () => {
    if (from.current === null) return;
    from.current = null;
    if (pulled.current > DISMISS_PX) onBack();
    else setPull(0);
  };
  return (
    <div
      className="mobile-sheet fixed inset-x-0 z-[3100] flex flex-col bg-panel-bg pb-[env(safe-area-inset-bottom)]"
      style={{ top: "var(--visible-top, 0px)", height: "var(--visible-height, 100dvh)", ...(pull ? { transform: `translateY(${pull}px)` } : {}) }}
      data-testid="mobile-file-sheet"
      role="dialog"
      aria-label={path}
    >
      {/* The pull handle: a touch here moves the sheet, and nothing else on it does (the editor keeps its own scroll). */}
      <div
        className={cn("shrink-0 touch-none select-none pt-[max(0.25rem,env(safe-area-inset-top))]", pull ? "cursor-grabbing" : "cursor-grab")}
        data-testid="mobile-file-handle"
        onPointerDown={(e) => {
          // Capturing the pointer would send the release, and so the click, to this row instead of the × in it.
          if ((e.target as HTMLElement).closest("button")) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          from.current = e.clientY;
        }}
        onPointerMove={move}
        onPointerUp={release}
        onPointerCancel={() => { from.current = null; pulled.current = 0; setPull(0); }}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-surface-2" aria-hidden="true" />
        <div className="flex items-center gap-1 px-1 pb-1">
          <button
            type="button"
            className={cn(ghostButton, tapButtonClass, "grid size-11 shrink-0 place-items-center p-0")}
            data-testid="mobile-files-back"
            aria-label="Close file"
            onClick={onBack}
          >
            <CloseIcon size={16} />
          </button>
          <span className="min-w-0 flex-1 truncate text-[0.9rem] font-semibold text-fg" title={path}>{path.split("/").pop()}</span>
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{editor}</div>
    </div>
  );
}

export default function MobileFiles({ openPath, explorer, editor, onBack }: MobileFilesProps) {
  return (
    <>
      {explorer}
      {openPath && editor && <FileSheet key={openPath} path={openPath} editor={editor} onBack={onBack} />}
    </>
  );
}
