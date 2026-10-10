import { useDrawerBrowsers } from "./drawerBrowsers";
import { useFileTabs } from "./fileTabs";
import { usePerchStore } from "./store";

/** Drop everything this window holds for a workspace that no longer exists: its drawer
 * browser pages, and its top-row tabs (files, reviews, browser pages). Closing a browser
 * destroys its native webview (`browserNative.ts` watches the tabs). */
export function purgeWorkspace(workspaceId: string): void {
  const browsers = useDrawerBrowsers.getState();
  for (const page of browsers.pages) if (page.workspaceId === workspaceId) browsers.close(page.id);
  useFileTabs.setState((state) => {
    const tabs = state.tabs.filter((tab) => tab.workspaceId !== workspaceId);
    if (tabs.length === state.tabs.length) return state;
    // Every tab key starts with its workspace id and a newline (`fileTabKey`).
    return { tabs, active: state.active?.startsWith(`${workspaceId}\n`) ? null : state.active };
  });
}

// A workspace is gone when a snapshot no longer lists it (a removed project) or it is
// archived (a removed worktree). Only a change seen here counts: a workspace this window
// never saw listed, such as a remote checkout with no local row, is left alone.
usePerchStore.subscribe((state, previous) => {
  if (state.workspaces === previous.workspaces) return;
  const listed = new Set(state.workspaces.map((workspace) => workspace.id));
  const gone = new Set<string>();
  for (const workspace of previous.workspaces) if (!listed.has(workspace.id)) gone.add(workspace.id);
  for (const workspace of state.workspaces) if (workspace.state === "archived") gone.add(workspace.id);
  for (const id of gone) purgeWorkspace(id);
});
