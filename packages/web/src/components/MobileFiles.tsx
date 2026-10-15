import { fileTabKey, useFileTabs } from "../fileTabs";
import { openFilePreview } from "../workspaceTabs";
import { cn } from "../lib/cn";
import { GHOST_BUTTON } from "./ui/icon-button";
import { Chevron } from "./ui/chevron";
import { WorkspaceFilesView } from "./WorkspaceFiles";

/**
 * The phone's Files pane, built from the desktop's own pieces: the explorer is
 * the drawer's (`layout="explorer"`), and a tapped file opens exactly as a
 * click does there (`openFilePreview` / pin into the shared `fileTabs` store),
 * then shows in the tab's editor (`layout="editor"`). The phone has no tab strip, so
 * the open file replaces the explorer and "Files" goes back; `showSession` is
 * the same "no file covers the session" state the desktop's strip uses, and the
 * tab stays open for the desktop view and for the next visit.
 */
export function MobileFiles({ workspaceId }: { workspaceId: string }) {
  const tab = useFileTabs((s) => s.tabs.find((t) => !t.kind && t.workspaceId === workspaceId && fileTabKey(t) === s.active));
  if (!tab) {
    return (
      <WorkspaceFilesView
        key={workspaceId}
        layout="explorer"
        workspaceId={workspaceId}
        onOpenFile={(path, pinned) => {
          if (!pinned) return openFilePreview(workspaceId, path);
          const files = useFileTabs.getState();
          files.open(workspaceId, path);
          files.pin(fileTabKey({ workspaceId, path }));
        }}
      />
    );
  }
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <button
        type="button"
        className={cn(GHOST_BUTTON, "flex min-h-11 shrink-0 items-center gap-1 self-start px-3 text-[0.85rem]")}
        data-testid="mobile-files-back"
        onClick={() => useFileTabs.getState().showSession()}
      >
        <Chevron open={false} className="rotate-180" />
        Files
      </button>
      <WorkspaceFilesView key={fileTabKey(tab)} layout="editor" workspaceId={workspaceId} initialPath={tab.path} />
    </div>
  );
}
