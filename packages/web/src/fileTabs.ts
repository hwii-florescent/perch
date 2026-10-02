import { create } from "zustand";
import { usePerchStore } from "./store";

/** A workspace file open as a top-row tab, beside the workspace's sessions. */
export interface FileTab {
  workspaceId: string;
  path: string;
}

export const fileTabKey = (tab: FileTab) => `${tab.workspaceId}\n${tab.path}`;

interface FileTabsState {
  tabs: FileTab[];
  /** The file shown in the main area instead of the session, if any. */
  active: string | null;
  open: (workspaceId: string, path: string) => void;
  close: (key: string) => void;
  /** Back to the session view (a session tab was clicked or switched to). */
  showSession: () => void;
}

// Open tabs survive a reload, per viewer; the session view is what reopens.
const STORAGE_KEY = "perch.fileTabs";

function loadTabs(): FileTab[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((tab): tab is FileTab => typeof tab?.workspaceId === "string" && typeof tab?.path === "string")
      : [];
  } catch {
    return [];
  }
}

export const useFileTabs = create<FileTabsState>((set) => ({
  tabs: loadTabs(),
  active: null,
  open: (workspaceId, path) => set((state) => {
    const key = fileTabKey({ workspaceId, path });
    const known = state.tabs.some((tab) => fileTabKey(tab) === key);
    return { tabs: known ? state.tabs : [...state.tabs, { workspaceId, path }], active: key };
  }),
  close: (key) => set((state) => ({
    tabs: state.tabs.filter((tab) => fileTabKey(tab) !== key),
    active: state.active === key ? null : state.active,
  })),
  showSession: () => set({ active: null }),
}));

useFileTabs.subscribe((state, previous) => {
  if (state.tabs === previous.tabs) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tabs)); } catch { /* convenience only */ }
});

// Any session switch (tab, sidebar, Navigator, keybinding) shows that session.
usePerchStore.subscribe((state, previous) => {
  if (state.sessionId !== previous.sessionId && useFileTabs.getState().active) useFileTabs.getState().showSession();
});
