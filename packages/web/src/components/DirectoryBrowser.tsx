/**
 * DirectoryBrowser.tsx: the folder picker (Add project, a session's folder). The screen is `stock:folder-browser`
 * (`stock-ui/folder-browser/main.tsx`) or the person's package chosen for it; this file binds `browse` to the
 * store's `fs.browse` round trip (hub-routed for a remote host).
 */
import { usePerchStore } from "../store";
import FolderBrowser from "../stock-ui/folder-browser/main";
import { StockRoute } from "./mod-root";

export interface DirectoryBrowserProps {
  hostId: string;
  /** Called with the chosen path ("Use this folder", its keys, or a typed path). */
  onUseFolder: (path: string) => void;
}

export function DirectoryBrowser({ hostId, onUseFolder }: DirectoryBrowserProps) {
  const props = {
    hostId, onUseFolder,
    browse: (path?: string) => usePerchStore.getState().browseDirectory(hostId, path).then(({ path, parent, entries }) => ({ path, parent, entries })),
  };
  return <StockRoute name="folder-browser" props={props} stock={FolderBrowser} />;
}
