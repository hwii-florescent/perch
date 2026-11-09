//! Files, the stock screen `stock:files`: a workspace's explorer (`layout: "explorer"`, the Files drawer and the
//! phone's Files pane) or one file's editor (`layout: "editor"`, a file tab and a docked file panel). Perch shows one
//! copy per place with these props; the phone renders this source compiled in. Opening a file from the explorer is
//! the caller's (`onOpenFile`: a preview tab, or a kept one when `pinned`); everything a draft needs is Perch's own
//! (`useWorkspaceFiles`), so a clone changes how files look and are used, never how they are kept or saved.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs
//! and `perch mod clone stock:files` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { WorkspaceFilesView, type WorkspaceFilesViewProps } from "./files";

export default function Files(props: WorkspaceFilesViewProps) {
  return <WorkspaceFilesView {...props} />;
}
