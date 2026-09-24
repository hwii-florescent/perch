/**
 * Shared status-glyph logic, mirroring herdr's `pane_agent_status(state, seen)`.
 *
 * `unseen`/`blocked` are computed server-side (see `SessionSummary` in
 * `@perch/shared`); this module just maps them (plus `status`) onto a single
 * discriminant and its static glyph/color, so the sidebar and status bar
 * render identically. herdr's post-`81f355f` dots are static — no pulsing —
 * which is why `DOT_GLYPH` carries no animation, only a fixed glyph + color.
 */
import type { SessionSummary } from "@perch/shared";

export type AgentDotState = "blocked" | "working" | "done" | "idle" | "unknown";

export function sessionDotState(s: SessionSummary): AgentDotState {
  // `stale`: busy but silent for 30 minutes reads as idle (server/session.rs).
  if (s.blocked && !s.stale) return "blocked";
  if (s.status === "running" && !s.stale) return "working";
  if (s.unseen) return "done";
  return "idle"; // seen + idle
}

export const DOT_GLYPH: Record<AgentDotState, { glyph: string; color: string }> = {
  blocked: { glyph: "●", color: "var(--red)" }, // ●
  working: { glyph: "●", color: "var(--yellow)" }, // ●
  done: { glyph: "●", color: "var(--teal)" }, // ●
  idle: { glyph: "○", color: "var(--green)" }, // ○
  unknown: { glyph: "·", color: "var(--overlay-1)" }, // ·
};
