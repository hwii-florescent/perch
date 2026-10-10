import { create } from "zustand";
import { browserCall, browserId } from "./browserNative";
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
    set((state) => ({ pages: state.pages.filter((page) => page.id !== id) }));
  },
  closeAll: (workspaceId) => {
    for (const page of get().pages) if (page.workspaceId === workspaceId) get().close(page.id);
    const files = useFileTabs.getState();
    for (const tab of files.tabs) if (tab.workspaceId === workspaceId && tab.kind === "browser") files.close(fileTabKey(tab));
  },
}));

useDrawerBrowsers.subscribe((state, previous) => {
  if (state.pages === previous.pages) return;
  try { localStorage.setItem(viewerKey(STORAGE_KEY), JSON.stringify(state.pages)); } catch { /* convenience only */ }
});
