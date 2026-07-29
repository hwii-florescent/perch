/**
 * StatusDot — thin wrapper around `sessionDotState`/`DOT_GLYPH` (see
 * `../statusDot`). Renders a single static glyph character colored per the
 * herdr-parity semantic tokens. No animation — herdr's current status dots
 * are static, and pulsing must not be reintroduced here.
 *
 * Also emits the legacy `.session-status`/`.session-status--running|--idle`
 * classes so existing e2e selectors (`e2e/sidebar.spec.ts`,
 * `e2e/cli-sync.spec.ts`, etc.) keep working unchanged: those only ever
 * distinguished running vs. not-running, which maps 1:1 onto the new
 * "working" vs. everything-else split.
 */
import type { SessionSummary } from "@perch/shared";
import { sessionDotState, DOT_GLYPH } from "../statusDot";

export interface StatusDotProps {
  session: SessionSummary;
  className?: string;
}

export function StatusDot({ session, className }: StatusDotProps) {
  const state = sessionDotState(session);
  const { glyph, color } = DOT_GLYPH[state];
  const legacy = state === "working" ? "session-status--running" : "session-status--idle";
  const classes = ["agent-status-dot", `agent-status-dot--${state}`, "session-status", legacy, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} style={{ color }} title={`status: ${state}`} aria-hidden="true">
      {glyph}
    </span>
  );
}
