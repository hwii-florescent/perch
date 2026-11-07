import { useCallback, useEffect, useRef, useState } from "react";
import type { HeldMessage, InboundActResultMessage } from "@perch/shared";
import { newId } from "./ids";
import { usePerchStore } from "./store";
import { socket } from "./ws";

/** What a session does with messages from other sessions, and the messages it holds for its person. The core
 * keeps both and enforces them (`crates/perch-core/src/server/inbound.rs`); this asks, keeps the latest answer
 * and sends the person's choice. Without the capability (an older core), for a remote session or without a
 * connection there is nothing to show. */
const CAPABILITY = "inbound.v1";
const TIMEOUT_MS = 5000;
const ACT_TIMEOUT_MS = 30_000;

export type InboundModeName = "accept" | "hold" | "refuse";
export interface InboundState { mode: InboundModeName; held: HeldMessage[] }
const NONE: InboundState = { mode: "accept", held: [] };

const pending = new Map<string, (state: InboundState | null) => void>();
const listeners = new Set<(sessionId: string) => void>();
const acting = new Map<string, (result: InboundOutcome) => void>();
/** What an action came to, in the core's words. */
export type InboundOutcome = Pick<InboundActResultMessage, "outcome" | "reason" | "count">;
const UNHEARD: InboundOutcome = { outcome: "refused", reason: "Perch did not hear back, so it cannot say what happened. Look again before trying twice." };

socket.onMessage((message) => {
  if (message.type === "inbound.state") {
    const mode = message.mode === "hold" || message.mode === "refuse" ? message.mode : "accept";
    pending.get(message.requestId)?.(message.error ? null : { mode, held: message.held });
    pending.delete(message.requestId);
  } else if (message.type === "inbound.changed") {
    for (const listener of listeners) listener(message.sessionId);
  } else if (message.type === "inbound.act.result") {
    acting.get(message.requestId)?.({ outcome: message.outcome, reason: message.reason, count: message.count });
    acting.delete(message.requestId);
  }
});
socket.onConnectionChange((connected) => {
  if (connected) return;
  for (const [id, settle] of pending) { settle(null); pending.delete(id); }
  for (const [id, settle] of acting) { acting.delete(id); settle(UNHEARD); }
});

function ask(sessionId: string): Promise<InboundState | null> {
  const requestId = newId();
  return new Promise((resolve) => {
    pending.set(requestId, resolve);
    setTimeout(() => { if (pending.delete(requestId)) resolve(null); }, TIMEOUT_MS);
    socket.send({ type: "inbound.get", requestId, sessionId });
  });
}

export interface InboundAction {
  sessionId: string;
  action: "set_mode" | "deliver" | "discard" | "deliver_all" | "discard_all";
  mode?: InboundModeName;
  messageId?: string;
  /** The chat's input lease; deliver and discard need it, the mode does not. */
  generation?: number;
}

/** Set the mode, or deliver or discard what is held. */
export function actOnInbound(args: InboundAction): Promise<InboundOutcome> {
  const requestId = newId();
  return new Promise((resolve) => {
    acting.set(requestId, resolve);
    setTimeout(() => { if (acting.delete(requestId)) resolve(UNHEARD); }, ACT_TIMEOUT_MS);
    socket.send({ type: "inbound.act", requestId, ...args });
  });
}

const MENU_LABEL: Record<InboundModeName, string> = {
  accept: "Accept messages from other sessions",
  hold: "Hold messages for my approval",
  refuse: "Refuse messages from other sessions",
};

/** The session row menu's three choices for what the session does with messages from other sessions, the
 * current one marked. Only for an agent session on this computer, and only when the core can do it. */
export function inboundMenuItems(session: { id: string; hostId?: string; cliProviderId?: string; inboundMode?: "hold" | "refuse" }): { label: string; testId: string; onSelect: () => void }[] {
  const state = usePerchStore.getState();
  if (!session.cliProviderId || (session.hostId ?? "local") !== "local" || !state.serverInfo?.capabilities?.includes(CAPABILITY)) return [];
  const current = session.inboundMode ?? "accept";
  return (Object.keys(MENU_LABEL) as InboundModeName[]).map((mode) => ({
    label: `${mode === current ? "✓ " : ""}${MENU_LABEL[mode]}`,
    testId: `session-inbound-${mode}-${session.id}`,
    onSelect: () => { if (mode !== current) void actOnInbound({ sessionId: session.id, action: "set_mode", mode }); },
  }));
}

/** Whether the connected core can do inbound control at all. */
export function useInboundAvailable(): boolean {
  return usePerchStore((state) => state.serverInfo?.capabilities?.includes(CAPABILITY) === true);
}

/** The mode and held messages of `sessionId`; the default (accepting, nothing held) while unknown. */
export function useInbound(sessionId: string): { state: InboundState; refresh: () => void } {
  const connected = usePerchStore((state) => state.connected);
  const local = usePerchStore((state) => (state.sessions.find((session) => session.id === sessionId)?.hostId ?? "local") === "local");
  const capable = useInboundAvailable();
  const [answer, setAnswer] = useState<{ sessionId: string; state: InboundState }>({ sessionId, state: NONE });
  const enabled = connected && local && capable;
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const refresh = useCallback(() => {
    if (enabled) void ask(sessionId).then((state) => { if (live.current && state) setAnswer({ sessionId, state }); });
  }, [enabled, sessionId]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!enabled) return;
    const listener = (changed: string) => { if (changed === sessionId) refresh(); };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, [enabled, sessionId, refresh]);
  return { state: enabled && answer.sessionId === sessionId ? answer.state : NONE, refresh };
}
