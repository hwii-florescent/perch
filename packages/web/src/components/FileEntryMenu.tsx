/**
 * FileEntryMenu.tsx: the file explorer's right-click menu and the prompt its action needs (also the new-file prompt
 * of the tab strip and the launcher). The screen is `stock:file-menu` (`stock-ui/file-menu/main.tsx`) or the person's
 * package chosen for it; this file binds its actions to `fileOps.ts` (`fs.mutate`; nothing is ever overwritten), the
 * entry clipboard, the desktop app's open/reveal and Context Bridge.
 */
import type { DirectoryEntry } from "@perch/shared";
import { askAgentAboutFile, contextBridgeAvailable } from "../contextBridge";
import { freeName, joinPath, mutateEntry, namesIn, useEntryClipboard } from "../fileOps";
import { useFileTabs } from "../fileTabs";
import { tauriInvoke } from "../links";
import { usePerchStore } from "../store";
import { dirScopeId, workspaceRecord } from "../terminalScope";
import FileMenu from "../stock-ui/file-menu/main";
import { StockRoute } from "./mod-root";

export interface FileEntryMenuProps {
  workspaceId: string;
  /** Absolute workspace root, for Copy Path. */
  workspacePath: string;
  target: DirectoryEntry | null;
  x: number;
  y: number;
  onClose: () => void;
  onOpenFile: (path: string) => void;
  /** Show this folder's children (a create just put something there). */
  onExpand: (path: string) => void;
  onRefresh: () => void;
  /** Skip the menu and open this name prompt (the explorer header's new file / new folder icons). */
  initialStage?: "newFile" | "newFolder";
}

export function FileEntryMenu(props: FileEntryMenuProps) {
  const { workspaceId } = props;
  const held = useEntryClipboard((state) => state.entry);
  const local = usePerchStore((state) => workspaceRecord(state, workspaceId)?.hostId === "local");
  const screen = {
    ...props,
    held: held && held.workspaceId === workspaceId ? { path: held.path, cut: held.cut } : null,
    nativeAvailable: !!tauriInvoke && local,
    canAsk: contextBridgeAvailable(workspaceId),
    actions: {
      mutate: (op: "createFile" | "createDir" | "rename" | "copy" | "delete", path: string, to?: string) => mutateEntry(workspaceId, op, path, to),
      createFileAt: async (dir: string, name: string) => {
        const root = props.workspacePath.replace(/\/+$/, "");
        const inside = dir === root ? "" : dir.startsWith(`${root}/`) ? dir.slice(root.length + 1) : null;
        if (inside !== null) {
          await mutateEntry(workspaceId, "createFile", joinPath(inside, name));
          props.onOpenFile(joinPath(inside, name));
          return;
        }
        // Outside the workspace: the file is read and saved through a scope for that directory.
        const scope = dirScopeId(workspaceId, dir);
        await mutateEntry(scope, "createFile", name);
        useFileTabs.getState().open(workspaceId, name, undefined, scope);
      },
      hold: (path: string, cut: boolean) => useEntryClipboard.setState({ entry: { workspaceId, path, cut } }),
      freeName: (name: string, dir: string) => freeName(name, namesIn(workspaceId, dir)),
      openInDefaultApp: async (path: string) => { if (!tauriInvoke) throw new Error("Only the desktop app opens files in their default app."); await tauriInvoke("open_in_default_app", { path }); },
      reveal: (path: string) => { void tauriInvoke?.("reveal_in_finder", { path }).catch(() => undefined); },
      askAgent: (path: string) => askAgentAboutFile(workspaceId, path),
    },
  };
  return <StockRoute name="file-menu" props={screen} stock={FileMenu} />;
}
