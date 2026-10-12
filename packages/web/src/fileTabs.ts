import { create } from "zustand";
import { effectiveWorkspace, usePerchStore } from "./store";
import { readViewerStored, viewerKey } from "./viewer";
import { recordClosedFile } from "./closedTabs";
import { useWorkspaceFilesStore } from "./filesystemStore";

/** A workspace resource open as a top-row tab, a peer of the workspace's sessions:
 * a file, or (`kind: "review"`) the workspace's change review, or (`kind: "browser"`)
 * a page in perch's browser, whose `path` is its URL. */
export interface FileTab {
  workspaceId: string;
  /** The file's path; "" for a review. */
  path: string;
  kind?: "review" | "browser";
  /** A file opened by a single click (VS Code's preview tab, shown in italics): the next
   * previewed file replaces it in place until it is edited, double-clicked or opened for real. */
  preview?: boolean;
}

// NUL cannot occur in a path, so a review never collides with a file.
export const fileTabKey = (tab: FileTab) => `${tab.workspaceId}\n${tab.kind === "review" ? "\0review" : tab.kind === "browser" ? `\0browser\n${tab.path}` : tab.path}`;

interface FileTabsState {
  tabs: FileTab[];
  /** The file shown in the main area instead of the session, if any. */
  active: string | null;
  open: (workspaceId: string, path: string, kind?: FileTab["kind"]) => void;
  close: (key: string) => void;
  /** Show `path` as the workspace's preview tab: in `replaceKey`'s slot (that preview tab goes,
   * unrecorded), else at the end. An already open file is just shown, preview or not. */
  openPreview: (workspaceId: string, path: string, replaceKey?: string) => void;
  /** A preview tab becomes a regular one. */
  pin: (key: string) => void;
  /** Back to the session view (a session tab was clicked or switched to). */
  showSession: () => void;
}

// Open tabs survive a reload, per viewer (window); the session view is what reopens.
const STORAGE_KEY = "perch.fileTabs";

function loadTabs(): FileTab[] {
  try {
    const parsed: unknown = JSON.parse(readViewerStored(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((tab): tab is FileTab => typeof tab?.workspaceId === "string" && typeof tab?.path === "string" && (tab.kind === undefined || tab.kind === "review" || tab.kind === "browser"))
      : [];
  } catch {
    return [];
  }
}

export const useFileTabs = create<FileTabsState>((set, get) => ({
  tabs: loadTabs(),
  active: null,
  open: (workspaceId, path, kind) => set((state) => {
    const next: FileTab = kind ? { workspaceId, path, kind } : { workspaceId, path };
    const key = fileTabKey(next);
    const known = state.tabs.some((tab) => fileTabKey(tab) === key);
    return { tabs: known ? state.tabs : [...state.tabs, next], active: key };
  }),
  openPreview: (workspaceId, path, replaceKey) => set((state) => {
    const next: FileTab = { workspaceId, path, preview: true };
    const key = fileTabKey(next);
    if (state.tabs.some((tab) => fileTabKey(tab) === key)) return { active: key };
    const at = replaceKey ? state.tabs.findIndex((tab) => fileTabKey(tab) === replaceKey && tab.preview) : -1;
    if (at < 0) return { tabs: [...state.tabs, next], active: key };
    const tabs = [...state.tabs];
    tabs[at] = next;
    return { tabs, active: key };
  }),
  pin: (key) => set((state) => (
    state.tabs.some((tab) => tab.preview && fileTabKey(tab) === key)
      ? { tabs: state.tabs.map((tab) => (tab.preview && fileTabKey(tab) === key ? { ...tab, preview: false } : tab)) }
      : state
  )),
  close: (key) => {
    const closing = get().tabs.find((tab) => fileTabKey(tab) === key);
    if (closing) recordClosedFile(closing);
    set((state) => ({
      tabs: state.tabs.filter((tab) => fileTabKey(tab) !== key),
      active: state.active === key ? null : state.active,
    }));
  },
  showSession: () => set({ active: null }),
}));

useFileTabs.subscribe((state, previous) => {
  if (state.tabs === previous.tabs) return;
  try { localStorage.setItem(viewerKey(STORAGE_KEY), JSON.stringify(state.tabs)); } catch { /* convenience only */ }
});

// Editing a previewed file makes its tab permanent (and it stays so after a save).
useWorkspaceFilesStore.subscribe((state, previous) => {
  if (state.documents === previous.documents) return;
  const { tabs } = useFileTabs.getState();
  const edited = tabs.filter((tab) => {
    const document = tab.preview ? state.documents[tab.workspaceId]?.[tab.path] : undefined;
    return document != null && document.content !== document.savedContent;
  });
  if (edited.length > 0) useFileTabs.setState({ tabs: tabs.map((tab) => (edited.includes(tab) ? { ...tab, preview: false } : tab)) });
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

/** What `workspaceId` has selected, if it has been chosen this page load (null = its session). */
export const selectedKey = (workspaceId: string): string | null | undefined => selected.get(workspaceId);

/** Record `key` as `workspaceId`'s selection (a restored one) and show it if that workspace is on screen. */
export function selectResource(workspaceId: string, key: string): void {
  selected.set(workspaceId, key);
  if (effectiveWorkspace(usePerchStore.getState())?.id === workspaceId) restoreSelection(workspaceId);
}

/** Reselect what `workspaceId` had on screen when it was left (if still open). */
export function restoreSelection(workspaceId: string): void {
  const key = selected.get(workspaceId);
  const { tabs, active } = useFileTabs.getState();
  if (key && key !== active && tabs.some((tab) => fileTabKey(tab) === key)) useFileTabs.setState({ active: key });
}

// Any session or workspace switch (tab, sidebar, Navigator, keybinding) shows that session,
// except when the workspace's last session closes: its newest file or review is shown instead.
usePerchStore.subscribe((state, previous) => {
  const files = useFileTabs.getState();
  const workspaceId = effectiveWorkspace(state)?.id;
  const sameWorkspace = workspaceId === effectiveWorkspace(previous)?.id;
  if (state.sessionId === previous.sessionId && sameWorkspace) return;
  const left = state.sessionId === null && previous.sessionId !== null && sameWorkspace
    ? files.tabs.findLast((tab) => tab.workspaceId === workspaceId)
    : undefined;
  if (left) {
    files.open(left.workspaceId, left.path, left.kind);
    return;
  }
  if (!files.active) return;
  resetting = true;
  files.showSession();
  resetting = false;
});
