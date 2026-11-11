import type { MobileFilesProps } from "@perch/sdk";
import { fileTabKey, useFileTabs } from "../fileTabs";
import { openFilePreview } from "../workspaceTabs";
// The phone's explorer and editor are Perch's own Files parts (a phone never runs the desktop's choice for them).
import { WorkspaceFilesView } from "../stock-ui/files/files";
import Files from "../stock-ui/mobile-files/main";
import { StockRoute } from "./mod-root";

/**
 * The phone's Files tool. The screen is `stock:mobile-files` (`stock-ui/mobile-files/`), or the person's copy once
 * turned on for this phone (`phoneMods.ts`). Built from the desktop's own pieces: the explorer is the drawer's
 * (`layout="explorer"`, always mounted, so its folders stay open behind a file), and a tapped file opens exactly as a
 * click does there (`openFilePreview` / pin into the shared `fileTabs` store), then shows in the tab's editor
 * (`layout="editor"`) in a sheet over it. `onBack` is the same "no file covers the session" state the desktop's strip
 * uses (`showSession`), and the tab stays open for the desktop view and the next visit.
 */
export function MobileFiles({ workspaceId }: { workspaceId: string }) {
  const tab = useFileTabs((s) => s.tabs.find((t) => !t.kind && t.workspaceId === workspaceId && fileTabKey(t) === s.active));
  const props: MobileFilesProps = {
    workspaceId,
    openPath: tab?.path ?? null,
    explorer: (
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
    ),
    editor: tab ? <WorkspaceFilesView key={fileTabKey(tab)} layout="editor" workspaceId={workspaceId} initialPath={tab.path} /> : null,
    onBack: () => useFileTabs.getState().showSession(),
  };
  return <StockRoute name="mobile-files" props={props} stock={Files} />;
}
