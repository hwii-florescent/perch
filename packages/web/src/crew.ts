import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CrewActResultMessage, CrewRow } from "@perch/shared";
import { newId } from "./ids";
import { usePerchStore } from "./store";
import { socket } from "./ws";

/** The family strip's data: the other members of a session's run and what each is doing. The core
 * reads it from its own records and words it (`crates/perch-core/src/crew.rs`); this only asks and
 * keeps the latest answer. Without the capability (an older core), for a remote session, or without a
 * connection there is nothing to show. */
const CAPABILITY = "crew.v1";
/** Updates of the family's own sessions arrive in bursts; one ask follows the last of them. */
const SETTLE_MS = 250;
const TIMEOUT_MS = 5000;

const pending = new Map<string, (rows: CrewRow[] | null) => void>();
socket.onMessage((message) => {
  if (message.type !== "crew.state") return;
  pending.get(message.requestId)?.(message.error ? null : message.rows);
  pending.delete(message.requestId);
});
socket.onConnectionChange((connected) => {
  if (!connected) for (const [id, settle] of pending) { settle(null); pending.delete(id); }
});

function ask(sessionId: string): Promise<CrewRow[] | null> {
  const requestId = newId();
  return new Promise((resolve) => {
    pending.set(requestId, resolve);
    setTimeout(() => { if (pending.delete(requestId)) resolve(null); }, TIMEOUT_MS);
    socket.send({ type: "crew.get", requestId, sessionId });
  });
}

/** What a person's action on a child came to: the core's `crew.act.result`, never invented here. */
export interface ActOutcome { outcome: string; reason?: string }
interface PendingAct { progress: (result: ActOutcome) => void; settle: (result: ActOutcome) => void }
const ACT_TIMEOUT_MS = 45_000;
const acting = new Map<string, PendingAct>();
/** The core answers a steer or an interrupt within its own 10 s waits; a silence longer than that, or a
 * dropped connection, is "not confirmed" (the action may have happened), never "refused". */
const UNHEARD: ActOutcome = { outcome: "not_confirmed", reason: "Perch did not hear back, so it cannot say what happened" };
socket.onMessage((message) => {
  if (message.type !== "crew.act.result") return;
  const result = message as CrewActResultMessage;
  const pendingAct = acting.get(result.requestId);
  if (!pendingAct) return;
  const outcome = { outcome: result.outcome, ...(result.reason ? { reason: result.reason } : {}) };
  if (result.done) { acting.delete(result.requestId); pendingAct.settle(outcome); } else pendingAct.progress(outcome);
});
socket.onConnectionChange((connected) => {
  if (!connected) for (const [id, pendingAct] of acting) { acting.delete(id); pendingAct.settle(UNHEARD); }
});

/** Message, steer, interrupt or stop one sub-session of the lead whose chat shows the strip, under that
 * chat's input lease (`generation`). Resolves once, with the final outcome; `onProgress` hears `sent`. */
export function actOnChild(
  args: { sessionId: string; childSessionId: string; action: string; generation: number; text?: string },
  onProgress: (result: ActOutcome) => void = () => {},
): Promise<ActOutcome> {
  const requestId = newId();
  return new Promise((resolve) => {
    acting.set(requestId, { progress: onProgress, settle: resolve });
    setTimeout(() => { if (acting.delete(requestId)) resolve(UNHEARD); }, ACT_TIMEOUT_MS);
    socket.send({ type: "crew.act", requestId, ...args });
  });
}

/** The sessions whose change can change `sessionId`'s family: itself, its lead and its children. A
 * mail receipt that changes without a session update announces itself with one (the core calls
 * `notify_session_updated`), so the strip follows these alone. */
export function familySignature(
  sessions: readonly { id: string; parentSessionId?: string; status: string; blocked?: boolean; unseen?: boolean; title: string }[],
  sessionId: string,
): string {
  const self = sessions.find((session) => session.id === sessionId);
  const lead = self?.parentSessionId ?? sessionId;
  return JSON.stringify(sessions
    .filter((session) => session.id === lead || session.parentSessionId === lead)
    .map((session) => [session.id, session.status, session.blocked ?? false, session.unseen ?? false, session.title]));
}

/** The family rows of `sessionId`, newest traffic first; empty while unknown or outside any run.
 * `refresh` asks again at once: what a child can be sent depends on its running turn, which changes
 * without a session update, so the strip refreshes while its action menu is open. */
export function useCrew(sessionId: string): { rows: CrewRow[]; refresh: () => void } {
  const connected = usePerchStore((state) => state.connected);
  const local = usePerchStore((state) => (state.sessions.find((session) => session.id === sessionId)?.hostId ?? "local") === "local");
  const capable = usePerchStore((state) => state.serverInfo?.capabilities?.includes(CAPABILITY) === true);
  const sessions = usePerchStore((state) => state.sessions);
  const signature = useMemo(() => familySignature(sessions, sessionId), [sessions, sessionId]);
  const [answer, setAnswer] = useState<{ sessionId: string; rows: CrewRow[] }>({ sessionId, rows: [] });
  const enabled = connected && local && capable;
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const refresh = useCallback(() => {
    if (enabled) void ask(sessionId).then((rows) => { if (live.current && rows) setAnswer({ sessionId, rows }); });
  }, [enabled, sessionId]);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    const timer = setTimeout(() => {
      void ask(sessionId).then((rows) => { if (current && rows) setAnswer({ sessionId, rows }); });
    }, SETTLE_MS);
    return () => { current = false; clearTimeout(timer); };
  }, [enabled, sessionId, signature]);
  // A row set of another session, or one from before the connection dropped, is not this one's.
  return { rows: enabled && answer.sessionId === sessionId ? answer.rows : [], refresh };
}
