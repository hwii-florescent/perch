import { create } from "zustand";
import { browserCall, browserId } from "./browserNative";
import { useBrowserPages } from "./browserPages";
import { fileTabKey, useFileTabs } from "./fileTabs";
import { readViewerStored, viewerKey } from "./viewer";

/** A page open in the right drawer's Browser section. Each is its own native webview
 * (`browser.rs`) that lives until it is closed here, so an unwanted one costs memory. */
export interface DrawerPage {
  id: string;
  workspaceId: string;
  /** The last address seen, so a restarted UI reopens it. "" before the first one. */
  url: string;
}

/** The webview key of a drawer page (a top-row browser tab's is its `fileTabKey`). */
export const drawerPageKey = (id: string) => `drawer\n${id}`;

interface DrawerBrowsersState {
  pages: DrawerPage[];
  /** The page each workspace shows; the newest when unset. */
  active: Record<string, string>;
  open: (workspaceId: string) => void;
  select: (workspaceId: string, id: string) => void;
  setUrl: (id: string, url: string) => void;
  close: (id: string) => void;
  /** Every browser of the workspace: its drawer pages and its browser tabs. */
  closeAll: (workspaceId: string) => void;
}

const STORAGE_KEY = "perch.drawerBrowsers";

function loadPages(): DrawerPage[] {
  try {
    const parsed: unknown = JSON.parse(readViewerStored(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((page): page is DrawerPage => typeof page?.id === "string" && typeof page?.workspaceId === "string" && typeof page?.url === "string")
      : [];
  } catch {
    return [];
  }
}

export const useDrawerBrowsers = create<DrawerBrowsersState>((set, get) => ({
  pages: loadPages(),
  active: {},
  open: (workspaceId) => {
    const id = crypto.randomUUID();
    set((state) => ({ pages: [...state.pages, { id, workspaceId, url: "" }], active: { ...state.active, [workspaceId]: id } }));
  },
  select: (workspaceId, id) => set((state) => ({ active: { ...state.active, [workspaceId]: id } })),
  setUrl: (id, url) => set((state) => state.pages.some((page) => page.id === id && page.url !== url)
    ? { pages: state.pages.map((page) => page.id === id ? { ...page, url } : page) }
    : state),
  close: (id) => {
    void browserCall("close", { id: browserId(drawerPageKey(id)) });
    useBrowserPages.getState().forget(drawerPageKey(id));
    set((state) => ({ pages: state.pages.filter((page) => page.id !== id) }));
  },
  closeAll: (workspaceId) => {
    for (const page of get().pages) if (page.workspaceId === workspaceId) get().close(page.id);
    const files = useFileTabs.getState();
    for (const tab of files.tabs) if (tab.workspaceId === workspaceId && tab.kind === "browser") files.close(fileTabKey(tab));
  },
}));

/** The actual owner of a native page; stale/unknown native targets never fall back to a tab. */
export function browserOwner(id: string) {
  const tab = useFileTabs.getState().tabs.find((t) => t.kind === "browser" && browserId(fileTabKey(t)) === id);
  if (tab) return { kind: "tab" as const, tab };
  const page = useDrawerBrowsers.getState().pages.find((p) => browserId(drawerPageKey(p.id)) === id);
  return page ? { kind: "drawer" as const, page } : null;
}

/** Close the specific browser, never an unrelated active tab or session. */
export function closeBrowserById(id: string): boolean {
  const owner = browserOwner(id);
  if (!owner) return false;
  if (owner.kind === "tab") useFileTabs.getState().close(fileTabKey(owner.tab));
  else useDrawerBrowsers.getState().close(owner.page.id);
  return true;
}

useDrawerBrowsers.subscribe((state, previous) => {
  if (state.pages === previous.pages) return;
  try { localStorage.setItem(viewerKey(STORAGE_KEY), JSON.stringify(state.pages)); } catch { /* convenience only */ }
});
