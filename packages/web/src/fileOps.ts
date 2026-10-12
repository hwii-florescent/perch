import { create } from "zustand";
import type { FsErrorMessage, FsMutateOp, ServerMessage } from "@perch/shared";
import { fileTabKey, useFileTabs } from "./fileTabs";
import { useWorkspaceFilesStore } from "./filesystemStore";
import { newId } from "./ids";
import { socket } from "./ws";

const MUTATE_TIMEOUT_MS = 30_000;

export const parentPath = (path: string): string => path.split("/").slice(0, -1).join("/");
export const joinPath = (dir: string, name: string): string => (dir ? `${dir}/${name}` : name);
const within = (path: string, root: string): boolean => path === root || path.startsWith(`${root}/`);

/** Create / rename / delete one workspace entry (`fs.mutate`). Resolves once the
 * server has done it and the open tabs and the tree have caught up; rejects with
 * the server's message. Nothing is ever overwritten. */
export function mutateEntry(workspaceId: string, op: FsMutateOp, path: string, to?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!socket.connected) return reject(new Error("Disconnected. Reconnect and try again."));
    const requestId = newId();
    const settle = (error?: Error) => {
      clearTimeout(timer);
      off();
      if (error) reject(error);
      else {
        followUp(workspaceId, op, path, to);
        resolve();
      }
    };
    const timer = setTimeout(() => settle(new Error("The server did not answer.")), MUTATE_TIMEOUT_MS);
    const off = socket.onMessage((message: ServerMessage) => {
      if (!("requestId" in message) || message.requestId !== requestId) return;
      if (message.type === "fs.mutate.result") settle();
      else if (message.type === "fs.error") settle(new Error((message as FsErrorMessage).message));
    });
    socket.send({ type: "fs.mutate", requestId, workspaceId, op, path, ...(to ? { to } : {}) });
  });
}

/** The explorer's own clipboard (Cut / Copy / Paste): an entry, not text, so the
 * system clipboard is left alone (Copy Path is the one that writes it). */
export interface EntryClipboard {
  workspaceId: string;
  path: string;
  cut: boolean;
}
export const useEntryClipboard = create<{ entry: EntryClipboard | null }>(() => ({ entry: null }));

/** `name` itself if free in `taken`, else Finder-style "name copy.ext", "name copy 2.ext", … */
export function freeName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf(".");
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  for (let n = 1; ; n += 1) {
    const candidate = `${stem} copy${n > 1 ? ` ${n}` : ""}${ext}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** The names already in a loaded folder (empty when it has not been listed: the server still refuses a clash). */
export function namesIn(workspaceId: string, dir: string): Set<string> {
  const entries = useWorkspaceFilesStore.getState().trees[workspaceId]?.[dir]?.entries ?? [];
  return new Set(entries.map((entry) => entry.name));
}

/** Keep the file tabs and the explorer tree honest about what just changed on disk. */
function followUp(workspaceId: string, op: FsMutateOp, path: string, to?: string): void {
  if (op === "delete" || op === "rename") {
    // A cut entry that moved or vanished must not be pasted again.
    const held = useEntryClipboard.getState().entry;
    if (held && held.workspaceId === workspaceId && within(held.path, path)) useEntryClipboard.setState({ entry: null });
    const { tabs, active } = useFileTabs.getState();
    const affected = tabs.filter((tab) => tab.workspaceId === workspaceId && !tab.kind && within(tab.path, path));
    if (affected.length > 0) {
      const gone = new Set(affected.map(fileTabKey));
      useFileTabs.setState({ tabs: tabs.filter((tab) => !gone.has(fileTabKey(tab))), active: active && gone.has(active) ? null : active });
      // A renamed file that was on screen stays on screen under its new name.
      const shown = affected.find((tab) => fileTabKey(tab) === active);
      if (op === "rename" && to && shown) useFileTabs.getState().open(workspaceId, to + shown.path.slice(path.length));
    }
  }
  const { requestTree } = useWorkspaceFilesStore.getState();
  for (const dir of new Set([parentPath(path), ...(to ? [parentPath(to)] : [])])) requestTree(workspaceId, dir);
}
