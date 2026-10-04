import { create } from "zustand";
import { usePerchStore } from "./store";

/** A workspace resource open as a top-row tab, a peer of the workspace's sessions:
 * a file, or (`kind: "review"`) the workspace's change review. */
export interface FileTab {
  workspaceId: string;
  /** The file's path; "" for a review. */
  path: string;
  kind?: "review";
}

// NUL cannot occur in a path, so a review never collides with a file.
export const fileTabKey = (tab: FileTab) => `${tab.workspaceId}\n${tab.kind === "review" ? "\0review" : tab.path}`;

interface FileTabsState {
  tabs: FileTab[];
  /** The file shown in the main area instead of the session, if any. */
  active: string | null;
  open: (workspaceId: string, path: string, kind?: "review") => void;
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
      ? parsed.filter((tab): tab is FileTab => typeof tab?.workspaceId === "string" && typeof tab?.path === "string" && (tab.kind === undefined || tab.kind === "review"))
      : [];
  } catch {
    return [];
  }
}

export const useFileTabs = create<FileTabsState>((set) => ({
  tabs: loadTabs(),
  active: null,
  open: (workspaceId, path, kind) => set((state) => {
    const next: FileTab = kind ? { workspaceId, path, kind } : { workspaceId, path };
    const key = fileTabKey(next);
    const known = state.tabs.some((tab) => fileTabKey(tab) === key);
    return { tabs: known ? state.tabs : [...state.tabs, next], active: key };
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
