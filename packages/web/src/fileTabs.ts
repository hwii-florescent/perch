import { create } from "zustand";
import { effectiveWorkspace, usePerchStore } from "./store";

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

// What each workspace has selected: an open file or review, or null for its
// session. Per page load. It records the user's choices only (open, close, a
// click on a session tab), never the resets below, which run before a
// navigation has finished changing the workspace.
const selected = new Map<string, string | null>();
let resetting = false;

useFileTabs.subscribe((state, previous) => {
  if (state.active === previous.active || resetting) return;
  const workspaceId = effectiveWorkspace(usePerchStore.getState())?.id;
  if (workspaceId) selected.set(workspaceId, state.active);
});

/** Reselect what `workspaceId` had on screen when it was left (if still open). */
export function restoreSelection(workspaceId: string): void {
  const key = selected.get(workspaceId);
  const { tabs, active } = useFileTabs.getState();
  if (key && key !== active && tabs.some((tab) => fileTabKey(tab) === key)) useFileTabs.setState({ active: key });
}

// Any session or workspace switch (tab, sidebar, Navigator, keybinding) shows that session.
usePerchStore.subscribe((state, previous) => {
  const files = useFileTabs.getState();
  if (!files.active) return;
  if (state.sessionId === previous.sessionId && effectiveWorkspace(state)?.id === effectiveWorkspace(previous)?.id) return;
  resetting = true;
  files.showSession();
  resetting = false;
});
