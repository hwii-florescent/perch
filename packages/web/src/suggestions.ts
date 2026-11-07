import { useCallback, useEffect, useRef, useState } from "react";
import type { SuggestionActResultMessage, SuggestionCard } from "@perch/shared";
import { newId } from "./ids";
import { usePerchStore } from "./store";
import { socket } from "./ws";

/** The suggested-task cards of a lead's chat. The core keeps them and decides what each button does
 * (`crates/perch-core/src/server/suggestions.rs`); this asks, keeps the latest answer and sends the
 * person's click. Without the capability (an older core), for a remote session or without a
 * connection there is nothing to show. */
const CAPABILITY = "suggestions.v1";
const SETTLE_MS = 150;
const TIMEOUT_MS = 5000;
const ACT_TIMEOUT_MS = 120_000;

const pending = new Map<string, (cards: SuggestionCard[] | null) => void>();
const listeners = new Set<(sessionId: string) => void>();
socket.onMessage((message) => {
  if (message.type === "suggestions.state") {
    pending.get(message.requestId)?.(message.error ? null : message.cards);
    pending.delete(message.requestId);
  } else if (message.type === "suggestions.changed") {
    for (const listener of listeners) listener(message.sessionId);
  }
});
socket.onConnectionChange((connected) => {
  if (!connected) for (const [id, settle] of pending) { settle(null); pending.delete(id); }
});

function ask(sessionId: string): Promise<SuggestionCard[] | null> {
  const requestId = newId();
  return new Promise((resolve) => {
    pending.set(requestId, resolve);
    setTimeout(() => { if (pending.delete(requestId)) resolve(null); }, TIMEOUT_MS);
    socket.send({ type: "suggestions.get", requestId, sessionId });
  });
}

/** What a person's action came to, in the core's words. */
export type SuggestionOutcome = Pick<SuggestionActResultMessage, "outcome" | "reason" | "results">;
const acting = new Map<string, (result: SuggestionOutcome) => void>();
const UNHEARD: SuggestionOutcome = { outcome: "refused", reason: "Perch did not hear back, so it cannot say what happened. Look at the card before trying again." };
socket.onMessage((message) => {
  if (message.type !== "suggestion.act.result") return;
  acting.get(message.requestId)?.({ outcome: message.outcome, reason: message.reason, results: message.results });
  acting.delete(message.requestId);
});
socket.onConnectionChange((connected) => {
  if (!connected) for (const [id, settle] of acting) { acting.delete(id); settle(UNHEARD); }
});

export interface SuggestionAction {
  sessionId: string;
  cardId: string;
  action: "start" | "start_all" | "handed" | "dismiss";
  suggestionId?: string;
  generation: number;
  agent?: string;
  model?: string;
  worktree?: boolean;
}

/** Start, start all, record a hand-over to the lead, or dismiss, under the chat's input lease. */
export function actOnSuggestion(args: SuggestionAction): Promise<SuggestionOutcome> {
  const requestId = newId();
  return new Promise((resolve) => {
    acting.set(requestId, resolve);
    setTimeout(() => { if (acting.delete(requestId)) resolve(UNHEARD); }, ACT_TIMEOUT_MS);
    socket.send({ type: "suggestion.act", requestId, ...args });
  });
}

/** The cards of `sessionId`, oldest first; empty while unknown. They are asked for again when the core says
 * they changed and when a sub-session settles (`refresh`). */
export function useSuggestions(sessionId: string): { cards: SuggestionCard[]; refresh: () => void } {
  const connected = usePerchStore((state) => state.connected);
  const local = usePerchStore((state) => (state.sessions.find((session) => session.id === sessionId)?.hostId ?? "local") === "local");
  const capable = usePerchStore((state) => state.serverInfo?.capabilities?.includes(CAPABILITY) === true);
  // A started task's card follows its sub-session: its status changes arrive as session updates.
  const childStates = usePerchStore((state) => JSON.stringify(state.sessions.filter((session) => session.parentSessionId === sessionId).map((session) => [session.id, session.status, session.blocked ?? false])));
  const [answer, setAnswer] = useState<{ sessionId: string; cards: SuggestionCard[] }>({ sessionId, cards: [] });
  const enabled = connected && local && capable;
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const refresh = useCallback(() => {
    if (enabled) void ask(sessionId).then((cards) => { if (live.current && cards) setAnswer({ sessionId, cards }); });
  }, [enabled, sessionId]);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    const timer = setTimeout(() => {
      void ask(sessionId).then((cards) => { if (current && cards) setAnswer({ sessionId, cards }); });
    }, SETTLE_MS);
    return () => { current = false; clearTimeout(timer); };
  }, [enabled, sessionId, childStates]);
  useEffect(() => {
    if (!enabled) return;
    const listener = (changed: string) => { if (changed === sessionId) refresh(); };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, [enabled, sessionId, refresh]);
  return { cards: enabled && answer.sessionId === sessionId ? answer.cards : [], refresh };
}
