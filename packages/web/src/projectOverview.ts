import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OverviewGroup } from "@perch/shared";
import { newId } from "./ids";
import { usePerchStore } from "./store";
import { socket } from "./ws";

/** A Project's threads grouped by state. The core gathers and groups them from its own records
 * (`crates/perch-core/src/overview.rs`); this only asks and keeps the latest answer. Without the
 * capability (an older core), for a remote Project, or without a connection there is nothing to show. */
const CAPABILITY = "project.overview.v1";
/** Updates of the Project's sessions arrive in bursts; one ask follows the last of them. */
const SETTLE_MS = 250;
const TIMEOUT_MS = 5000;

type Answer = { groups: OverviewGroup[]; error?: string } | null;
const pending = new Map<string, (answer: Answer) => void>();
socket.onMessage((message) => {
  if (message.type !== "project.overview") return;
  pending.get(message.requestId)?.({ groups: message.groups, ...(message.error ? { error: message.error } : {}) });
  pending.delete(message.requestId);
});
socket.onConnectionChange((connected) => {
  if (!connected) for (const [id, settle] of pending) { settle(null); pending.delete(id); }
});

function ask(projectId: string): Promise<Answer> {
  const requestId = newId();
  return new Promise((resolve) => {
    pending.set(requestId, resolve);
    setTimeout(() => { if (pending.delete(requestId)) resolve(null); }, TIMEOUT_MS);
    socket.send({ type: "project.overview.get", requestId, projectId });
  });
}

/** What changes a thread's group: its session's status, whether it waits on a person, and its title. */
export function overviewSignature(
  sessions: readonly { id: string; projectId?: string; status: string; blocked?: boolean; title: string }[],
  projectId: string,
): string {
  return JSON.stringify(sessions
    .filter((session) => session.projectId === projectId)
    .map((session) => [session.id, session.status, session.blocked ?? false, session.title]));
}

/** The non-empty groups of `projectId`'s threads, in display order; `error` when the core refused
 * (a remote or missing Project). `refresh` asks again at once. */
export function useProjectOverview(projectId: string): { groups: OverviewGroup[]; error?: string; refresh: () => void } {
  const connected = usePerchStore((state) => state.connected);
  const capable = usePerchStore((state) => state.serverInfo?.capabilities?.includes(CAPABILITY) === true);
  const sessions = usePerchStore((state) => state.sessions);
  const signature = useMemo(() => overviewSignature(sessions, projectId), [sessions, projectId]);
  const [answer, setAnswer] = useState<{ projectId: string; value: NonNullable<Answer> }>({ projectId, value: { groups: [] } });
  const enabled = connected && capable;
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const refresh = useCallback(() => {
    if (enabled) void ask(projectId).then((value) => { if (live.current && value) setAnswer({ projectId, value }); });
  }, [enabled, projectId]);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    const timer = setTimeout(() => {
      void ask(projectId).then((value) => { if (current && value) setAnswer({ projectId, value }); });
    }, SETTLE_MS);
    return () => { current = false; clearTimeout(timer); };
  }, [enabled, projectId, signature]);
  // An answer for another Project, or from before the connection dropped, is not this one's.
  const value = enabled && answer.projectId === projectId ? answer.value : { groups: [] as OverviewGroup[] };
  return { groups: value.groups, ...(value.error ? { error: value.error } : {}), refresh };
}
