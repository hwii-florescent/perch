/**
 * StatusDot — the harness mark inside a static status-colored ring.
 * `sessionDotState` owns the same working/blocked/unseen semantics as before.
 * No animation: a busy sidebar should stay quiet.
 *
 * `.agent-status-dot` / `.agent-status-dot--<state>` carry no styles; they are
 * the hooks `e2e/status-glyphs.spec.ts` locates dots by.
 */
import type { SessionSummary } from "@perch/shared";
import { cn } from "../lib/cn";
import { sessionDotState, DOT_GLYPH } from "../statusDot";
import { usePerchStore } from "../store";
import { AgentIcon } from "./AgentIcon";

export interface StatusDotProps {
  session: SessionSummary;
  className?: string;
}

export function StatusDot({ session, className }: StatusDotProps) {
  const state = sessionDotState(session);
  const { color } = DOT_GLYPH[state];
  const remembered = usePerchStore((s) => s.cliAgentBySession[session.id]);
  const provider = remembered ?? session.cliProviderId ?? session.lastAgent;
  const classes = cn(
    "agent-status-dot",
    `agent-status-dot--${state}`,
    "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] leading-none",
    className,
  );

  return (
    <span className={classes} style={{ borderColor: color }} data-provider={provider ?? "unknown"} title={`${provider ?? "Agent"} · ${state}`} aria-hidden="true">
      <span className="inline-flex text-fg"><AgentIcon provider={provider} size={14} /></span>
    </span>
  );
}
