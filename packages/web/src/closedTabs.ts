/**
 * closedTabs.ts — the list behind Cmd+Shift+T: sessions and files alike, as the strip treats them. Per viewer (a window's own
 * localStorage key), newest first, 20 entries for 7 days. Holds descriptors
 * only: no terminal contents, prompt text or command history. Reopening starts
 * a fresh session of the same harness in the same nest; it never re-runs a
 * command or implies the old process survived (docs/DECISIONS.md, "Reopen").
 * ponytail: "Resume agent conversation" needs the provider's conversation id,
 * which the core drops with the session row; add it to `session.delete` first.
 */
import type { SessionSummary } from "@perch/shared";
import { viewerKey } from "./viewer";

const KEY = "perch.closedTabs";
const MAX = 20;
const TTL_MS = 7 * 24 * 3_600_000;

/** A closed session (a terminal or agent) or a closed file or review, newest first in one list. */
export type ClosedTab = { closedAt: number } & (
  | {
      kind?: "session";
      hostId: string;
      cwd: string;
      workspaceId?: string;
      projectId?: string;
      /** The harness to start again (`cliProviderId`); absent starts the default. */
      providerId?: string;
      title: string;
    }
  | { kind: "file"; workspaceId: string; path: string; review?: boolean }
);

/** A stored entry that is well formed and not older than the TTL. */
function isLiveEntry(tab: ClosedTab, now: number): boolean {
  if (typeof tab?.closedAt !== "number" || now - tab.closedAt >= TTL_MS) return false;
  return tab.kind === "file" ? typeof tab.path === "string" : typeof tab.cwd === "string";
}

function read(): ClosedTab[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(viewerKey(KEY)) ?? "[]");
    const now = Date.now();
    return Array.isArray(list) ? list.filter((tab: ClosedTab) => isLiveEntry(tab, now)) : [];
  } catch { return []; }
}

function write(list: ClosedTab[]): void {
  try { localStorage.setItem(viewerKey(KEY), JSON.stringify(list.slice(0, MAX))); } catch { /* best effort */ }
}

/** Remember a session that is being closed. A blank session nothing was started in is not worth reopening. */
export function recordClosedTab(session: SessionSummary): void {
  if (!session.cliProviderId && !session.cliStarted) return;
  write([{
    hostId: session.hostId ?? "local",
    cwd: session.cwd,
    ...(session.workspaceId ? { workspaceId: session.workspaceId } : {}),
    ...(session.projectId ? { projectId: session.projectId } : {}),
    ...(session.cliProviderId ? { providerId: session.cliProviderId } : {}),
    title: session.title,
    closedAt: Date.now(),
  }, ...read()]);
}

/** Remember a file or review tab that is being closed. */
export function recordClosedFile(tab: { workspaceId: string; path: string; kind?: "review" }): void {
  write([{ kind: "file", workspaceId: tab.workspaceId, path: tab.path, ...(tab.kind ? { review: true } : {}), closedAt: Date.now() }, ...read()]);
}

/** Remove and return the newest entry `usable` accepts; entries it rejects are dropped too. */
export function takeClosedTab(usable: (tab: ClosedTab) => boolean): ClosedTab | undefined {
  const list = read();
  const idx = list.findIndex(usable);
  write(idx === -1 ? [] : list.slice(idx + 1));
  return list[idx];
}

/** Remove Birdhouse: its closed tabs go with it. */
export function forgetClosedTabs(projectId: string): void {
  write(read().filter((tab) => tab.kind === "file" || tab.projectId !== projectId));
}
