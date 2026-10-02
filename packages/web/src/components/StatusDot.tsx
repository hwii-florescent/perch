/**
 * StatusDot — thin wrapper around `sessionDotState`/`DOT_GLYPH` (see
 * `../statusDot`). Renders a single static glyph character colored per the
 * herdr-parity semantic tokens. No animation — herdr's current status dots
 * are static, and pulsing must not be reintroduced here.
 *
 * `.agent-status-dot` / `.agent-status-dot--<state>` carry no styles; they are
 * the hooks `e2e/status-glyphs.spec.ts` locates dots by.
 */
import type { SessionSummary } from "@perch/shared";
import { cn } from "../lib/cn";
import { sessionDotState, DOT_GLYPH } from "../statusDot";

export interface StatusDotProps {
  session: SessionSummary;
  className?: string;
}

export function StatusDot({ session, className }: StatusDotProps) {
  const state = sessionDotState(session);
  const { glyph, color } = DOT_GLYPH[state];
  const classes = cn(
    "agent-status-dot",
    `agent-status-dot--${state}`,
    "mt-[0.15rem] inline-flex shrink-0 items-center justify-center text-[0.7rem] leading-none",
    className,
  );

  return (
    <span className={classes} style={{ color }} title={`status: ${state}`} aria-hidden="true">
      {glyph}
    </span>
  );
}
