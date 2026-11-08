/**
 * The sidebar's "By status" view: which section a chat is in, and the small
 * rules that keep it honest. Pure; `WorkspaceOverview` renders it and
 * `attention.ts` counts with it. Status comes from `sessionDotState` and the
 * core's attention facts; nothing here guesses.
 */
import type { SessionSummary } from "@perch/shared";
import { sessionDotState, type AgentDotState } from "./statusDot";

export type StatusSection = "needs" | "done" | "working" | "idle";
export const STATUS_SECTIONS: StatusSection[] = ["needs", "done", "working", "idle"];
export const STATUS_LABELS: Record<StatusSection, string> = { needs: "Needs you", done: "Done", working: "Working", idle: "Idle" };

/** `needs`: session ids with an unanswered question or failure from the core.
 * `held`: the chat being read that just finished (see `holdFinished`). */
export function sectionOf(session: SessionSummary, needs: ReadonlySet<string>, held: string | null): StatusSection {
  const dot = sessionDotState(session);
  if (dot === "blocked" || needs.has(session.id)) return "needs";
  if (dot === "working") return "working";
  if (dot === "done" || session.id === held) return "done";
  // `sessionDotState` never reports "unknown": a quiet agent is idle, not gone.
  return "idle";
}

/** Sessions per section, each keeping the order given (the core's order, then the existing sort). */
export function groupByStatus(sessions: SessionSummary[], needs: ReadonlySet<string>, held: string | null): Record<StatusSection, SessionSummary[]> {
  const groups: Record<StatusSection, SessionSummary[]> = { needs: [], done: [], working: [], idle: [] };
  for (const session of sessions) groups[sectionOf(session, needs, held)].push(session);
  return groups;
}

/** The sidebar lists agents, not plain shells: a terminal session whose harness is the bare shell stays a
 * tab. One where an agent was started by hand reports that agent (`currentProviderId`) and is listed.
 * `remembered` is the harness the viewer recorded when starting it (`cliAgentBySession`). A session with
 * no harness recorded at all (native chat) is listed. (Not `closeGuard.isAgentSession`: it drops those.) */
export function listedInSidebar(session: SessionSummary, remembered?: string): boolean {
  return (session.currentProviderId ?? remembered ?? session.cliProviderId) !== "terminal";
}

/** The most urgent section among `sessions` (Needs you, Done, Working, Idle), null for none. A folded
 * project or a sort by attention reads this; it never says anything the sessions do not. */
export function topSection(sessions: readonly SessionSummary[], needs: ReadonlySet<string>, held: string | null): StatusSection | null {
  let best = STATUS_SECTIONS.length;
  for (const session of sessions) best = Math.min(best, STATUS_SECTIONS.indexOf(sectionOf(session, needs, held)));
  return STATUS_SECTIONS[best] ?? null;
}

/** What a workspace lists under its row: sessions that matter (anything but Idle), the open one, and the
 * lead of a listed sub-session; the rest are counted as `idle`. `all` lists everything (the open
 * workspace, or a viewer who unfolded it). Each keeps the order given. */
export function discloseSessions(sessions: SessionSummary[], needs: ReadonlySet<string>, held: string | null, activeId: string | null, all: boolean): { shown: SessionSummary[]; idle: number } {
  if (all) return { shown: sessions, idle: 0 };
  const keep = new Set(sessions.filter((s) => s.id === activeId || sectionOf(s, needs, held) !== "idle").map((s) => s.id));
  for (const s of sessions) if (keep.has(s.id) && s.parentSessionId) keep.add(s.parentSessionId);
  const shown = sessions.filter((s) => keep.has(s.id));
  return { shown, idle: sessions.length - shown.length };
}

/** The chat to keep in Done while it is on screen. Reading a finished chat
 * marks it seen, which would drop it to Idle under your eyes; it stays in Done
 * until you leave it or it starts working again. `previous` is the viewed
 * chat's state on the last call (undefined right after switching to it). */
export function holdFinished(held: string | null, viewedId: string | null, previous: AgentDotState | undefined, state: AgentDotState | undefined): string | null {
  if (!viewedId || state === undefined || state === "working" || state === "blocked") return null;
  if (held === viewedId) return held;
  const justFinished = previous === "working" || previous === "blocked";
  return state === "done" || (state === "idle" && justFinished) ? viewedId : null;
}

/** Sessions needing you on hosts that can be reached: an offline host's last
 * known state is not an alert. */
export function sessionsNeedingYou(sessions: SessionSummary[], needs: ReadonlySet<string>, reachable: (hostId: string) => boolean): SessionSummary[] {
  return sessions.filter((session) => reachable(session.hostId ?? "local") && sectionOf(session, needs, null) === "needs");
}

/** The next id after `currentId` (wrapping), else the first; null when none or only the open one. */
export function nextNeeding(ids: string[], currentId: string | null): string | null {
  if (!ids.length) return null;
  const at = currentId ? ids.indexOf(currentId) : -1;
  const next = ids[(at + 1) % ids.length]!;
  return next === currentId ? null : next;
}
