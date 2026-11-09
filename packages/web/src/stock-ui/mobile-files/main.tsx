//! Phone files, the stock screen `stock:mobile-files`: the phone's Files pane. With no file open it is the explorer;
//! a tapped file opens exactly as a click does on the desktop and then fills the pane, with "Files" to go back. The
//! phone has no tab strip, so the open file replaces the explorer; going back only uncovers the explorer (the file's
//! tab stays open for the desktop and the next visit).
//!
//! The explorer and the editor are Perch's (`explorer`, `editor`: the Files screen's own parts with their drafts,
//! saves and conflicts). A phone screen: drawn only on a phone, and a person's copy runs there only once turned on for
//! that phone (Settings > Mods).
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:mobile-files` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside
//! it (docs/MOD-SDK.md).
import { Chevron, cn, ghostButton, type MobileFilesProps } from "@perch/sdk";

export default function MobileFiles({ openPath, explorer, editor, onBack }: MobileFilesProps) {
  if (!openPath || !editor) return <>{explorer}</>;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <button
        type="button"
        className={cn(ghostButton, "flex min-h-11 shrink-0 items-center gap-1 self-start px-3 text-[0.85rem]")}
        data-testid="mobile-files-back"
        onClick={onBack}
      >
        <Chevron open={false} className="rotate-180" />
        Files
      </button>
      {editor}
    </div>
  );
}
