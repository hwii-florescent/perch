/**
 * Needs You, client side. The core owns every fact (`server/attention.rs`,
 * `attention.snapshot`); this module only keeps the snapshot and orders and
 * counts it. The sidebar's "By status" view lists what needs you
 * (`WorkspaceOverview`, `statusView.ts`). Read is not resolved: opening a
 * session reads its updates on the server, and a question leaves only when the
 * agent is answered.
 */
import { useMemo } from "react";
import { create } from "zustand";
import type { AttentionEvent, ServerMessage } from "@perch/shared";
import { socket } from "./ws";
import { usePerchStore } from "./store";
import { useFileTabs } from "./fileTabs";
import { withSidebar } from "./appEvents";
import { nextNeeding, sessionsNeedingYou } from "./statusView";

export const ATTENTION_CAPABILITY = "attention.v1";

interface AttentionState {
  events: AttentionEvent[];
  /** The local host advertised `attention.v1`. */
  supported: boolean;
}

export const useAttention = create<AttentionState>(() => ({ events: [], supported: false }));

const rank = (event: AttentionEvent) => (event.kind === "question" ? 0 : 1);

/** Needs You: questions first, then failures; oldest first within each, so
 * whoever has waited longest is answered first. */
export function needsYou(events: AttentionEvent[]): AttentionEvent[] {
  return events.filter((event) => event.requiresAction || event.kind === "question")
    .sort((a, b) => rank(a) - rank(b) || a.occurredAt - b.occurredAt);
}

/** Human, non-sensitive reason for a row. No prompt text is invented: the
 * question summary is generic unless the provider supplied one. */
export function reasonLabel(event: AttentionEvent): string {
  if (event.kind === "question") return event.certainty === "unconfirmed" ? "Was waiting for you before restart" : "Waiting for you";
  if (event.kind === "failed") return event.summary || "Failed";
  if (event.kind === "finished" && event.count > 1) return `${event.summary} · ${event.count} turns`;
  return event.summary;
}

/** How sure the core is, said only when it is not certain. */
export function certaintyNote(event: AttentionEvent): string | null {
  if (event.certainty === "heuristic") return "Guessed from terminal output";
  if (event.certainty === "unconfirmed") return "Not confirmed since Perch restarted";
  return null;
}

/** Hosts whose sessions' status can be stated now. */
function reachableHost(hostId: string): boolean {
  const state = usePerchStore.getState();
  return hostId === "local" ? state.connected : state.hostStates[hostId]?.state === "connected";
}

/** Chats that need you, longest-waiting first: the core's questions and
 * failures, then any other blocked chat (an older core sends no events). */
function needingIds(): string[] {
  const { sessions } = usePerchStore.getState();
  const events = needsYou(useAttention.getState().events);
  const needs = new Set(events.map((event) => event.sessionId));
  const live = new Set(sessionsNeedingYou(sessions, needs, reachableHost).map((session) => session.id));
  const ordered = events.map((event) => event.sessionId).filter((id, at, all) => live.has(id) && all.indexOf(id) === at);
  return [...ordered, ...[...live].filter((id) => !ordered.includes(id))];
}

/** How many chats need you, for the badge on the control that opens the sidebar. */
export function useNeedsYouCount(): number {
  const events = useAttention((s) => s.events);
  const sessions = usePerchStore((s) => s.sessions);
  const connected = usePerchStore((s) => s.connected);
  const hostStates = usePerchStore((s) => s.hostStates);
  return useMemo(() => {
    const needs = new Set(needsYou(events).map((event) => event.sessionId));
    return sessionsNeedingYou(sessions, needs, (host) => (host === "local" ? connected : hostStates[host]?.state === "connected")).length;
  }, [events, sessions, connected, hostStates]);
}

/** Cmd-Shift-U: show the sidebar, and open the next chat that needs you.
 * With none it only shows the sidebar. */
export function openNextAttention(): void {
  withSidebar(() => {});
  const next = nextNeeding(needingIds(), usePerchStore.getState().sessionId);
  if (!next) return;
  useFileTabs.getState().showSession();
  usePerchStore.getState().switchSession(next);
}

export function handleAttentionMessage(message: ServerMessage): boolean {
  if (message.type === "server.info") {
    const supported = message.capabilities?.includes(ATTENTION_CAPABILITY) === true;
    useAttention.setState(supported ? { supported } : { supported, events: [] });
    if (supported) socket.send({ type: "attention.list" });
    return false;
  }
  if (message.type !== "attention.snapshot") return false;
  useAttention.setState({ events: message.events });
  return true;
}

socket.onMessage(handleAttentionMessage);
