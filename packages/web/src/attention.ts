/**
 * Needs You + Welcome Back, client side. The core owns every fact
 * (`server/attention.rs`, `attention.snapshot`); this module only orders,
 * summarizes and navigates. Read is not resolved: opening a session reads its
 * updates on the server, and a question leaves only when the agent is answered.
 */
import { create } from "zustand";
import type { AttentionEvent, HostInfoMessage, ServerMessage, SessionSummary } from "@perch/shared";
import { socket } from "./ws";
import { usePerchStore } from "./store";
import { useFileTabs } from "./fileTabs";
import { openFilePreview } from "./workspaceTabs";

export const ATTENTION_CAPABILITY = "attention.v1";
/** Hidden at least this long before a return counts as "while you were away". */
export const AWAY_AFTER_MS = 10 * 60 * 1000;

interface AttentionState {
  events: AttentionEvent[];
  /** The local host advertised `attention.v1`. */
  supported: boolean;
  open: boolean;
  /** Opened by a return rather than a click: shows the Welcome Back summary
   * and does not take focus from the terminal. */
  welcome: { since: number } | null;
  setOpen: (open: boolean, welcome?: { since: number } | null) => void;
}

export const useAttention = create<AttentionState>((set) => ({
  events: [],
  supported: false,
  open: false,
  welcome: null,
  setOpen: (open, welcome = null) => set({ open, welcome: open ? welcome : null }),
}));

const rank = (event: AttentionEvent) => (event.kind === "question" ? 0 : 1);

/** Needs You: questions first, then failures; oldest first within each, so
 * whoever has waited longest is answered first. */
export function needsYou(events: AttentionEvent[]): AttentionEvent[] {
  return events.filter((event) => event.requiresAction || event.kind === "question")
    .sort((a, b) => rank(a) - rank(b) || a.occurredAt - b.occurredAt);
}

/** Recent updates: finished turns and exits, newest first. */
export function recentUpdates(events: AttentionEvent[]): AttentionEvent[] {
  return events.filter((event) => !event.requiresAction && event.kind !== "question")
    .sort((a, b) => b.occurredAt - a.occurredAt);
}

export interface WelcomeSummary {
  finished: number;
  exited: number;
  needsYou: number;
  working: number;
  /** Sessions shown busy with no status evidence for 30 minutes. */
  unknown: number;
  /** Remote hosts not connected: their agents' status is unknown. */
  offlineHosts: string[];
}

/** What changed since `since`, and what is true now. Finished counts turns
 * (coalesced rows carry a count); working/unknown come from live sessions. */
export function welcomeSummary(
  events: AttentionEvent[],
  sessions: SessionSummary[],
  hosts: Record<string, HostInfoMessage>,
  since: number,
): WelcomeSummary {
  const fresh = events.filter((event) => event.occurredAt >= since && !event.read);
  return {
    finished: fresh.filter((event) => event.kind === "finished").reduce((n, event) => n + event.count, 0),
    exited: fresh.filter((event) => event.kind === "exited").length,
    needsYou: needsYou(events).length,
    working: sessions.filter((s) => s.status === "running" && !s.blocked && !s.stale).length,
    unknown: sessions.filter((s) => s.stale).length,
    offlineHosts: Object.values(hosts).filter((host) => host.hostId !== "local" && host.state === "error").map((host) => host.name),
  };
}

/** The sentence the Welcome Back header shows; null when nothing happened. */
export function welcomeLine(summary: WelcomeSummary): string | null {
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const parts = [
    summary.finished && `${plural(summary.finished, "turn")} finished`,
    summary.exited && `${plural(summary.exited, "agent")} exited`,
    summary.working && `${summary.working} still working`,
    summary.unknown && `${plural(summary.unknown, "status", "statuses")} not confirmed`,
    summary.offlineHosts.length && `${summary.offlineHosts.join(", ")} offline`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
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

export function ago(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const send = (message: Parameters<typeof socket.send>[0]) => {
  if (useAttention.getState().supported) socket.send(message);
};

export function dismissAttention(ids: string[]): void {
  if (ids.length) send({ type: "attention.update", ids, dismiss: true });
}

/** Jump to the agent's own tab: its CLI is where a question is answered. */
export function openAttention(event: AttentionEvent): void {
  useAttention.getState().setOpen(false);
  useFileTabs.getState().showSession();
  usePerchStore.getState().switchSession(event.sessionId);
}

/** The workspace's change review as a tab (its "Last agent turn" base shows
 * exactly this turn's changes). */
export function openAttentionReview(event: AttentionEvent): void {
  if (!event.workspaceId) return;
  useAttention.getState().setOpen(false);
  usePerchStore.getState().focusWorkspace(event.workspaceId);
  useFileTabs.getState().open(event.workspaceId, "", "review");
}

export function openAttentionFile(event: AttentionEvent, path: string): void {
  if (!event.workspaceId) return;
  useAttention.getState().setOpen(false);
  usePerchStore.getState().focusWorkspace(event.workspaceId);
  openFilePreview(event.workspaceId, path);
}

/** Cmd-Shift-U: the oldest item that needs you, else the panel says so. */
export function openNextAttention(): void {
  const next = needsYou(useAttention.getState().events)[0];
  if (next) openAttention(next);
  else useAttention.getState().setOpen(true);
}

// --- wiring ---------------------------------------------------------------

let hiddenAt: number | null = null;
let launched = false;

/** When this browser last looked at the panel: Welcome Back shows only what
 * is newer, so a stale unread update does not reopen it on every load. */
const SEEN_KEY = "perch.attention.seenAt";
function seenAt(): number | null {
  try {
    const n = Number(localStorage.getItem(SEEN_KEY));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch { return null; }
}
function markSeen(): void {
  try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch { /* per-browser convenience */ }
}
useAttention.subscribe((state, previous) => {
  if (state.open !== previous.open) markSeen();
});

/** First snapshot of a page load, or a return after `AWAY_AFTER_MS` hidden:
 * open the panel quietly when something happened since this browser last
 * looked. A browser that never looked starts from now (nothing to compare). */
function maybeWelcome(hiddenSince: number): void {
  const { events, open, setOpen } = useAttention.getState();
  const seen = seenAt();
  if (seen === null) return markSeen();
  if (open) return;
  const since = Math.max(hiddenSince, seen);
  const news = events.some((event) => (!event.read || event.kind === "question") && event.occurredAt > since);
  if (news) setOpen(true, { since });
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
  if (!launched) {
    launched = true;
    // Unread events are what happened since this viewer last looked.
    maybeWelcome(0);
  }
  return true;
}

socket.onMessage(handleAttentionMessage);

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      return;
    }
    const since = hiddenAt;
    hiddenAt = null;
    if (since !== null && Date.now() - since >= AWAY_AFTER_MS) maybeWelcome(since);
  });
}
