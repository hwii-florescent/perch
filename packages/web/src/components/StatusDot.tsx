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
  /** Just the harness mark, no state ring: for a list that already sits under its state's heading. */
  plain?: boolean;
}

export function StatusDot({ session, className, plain }: StatusDotProps) {
  const state = sessionDotState(session);
  const { color } = DOT_GLYPH[state];
  const remembered = usePerchStore((s) => s.cliAgentBySession[session.id]);
  const provider = session.currentProviderId ?? remembered ?? session.cliProviderId;
  // Preserve transparent brand artwork on a dark tile, like the self-contained
  // Kilo/Droid marks, instead of recoloring it or washing it out on light themes.
  const branded = provider === "claude" || provider === "claude-agent-teams" || provider === "omp";
  const classes = plain
    ? cn("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", className)
    : cn(
      "agent-status-dot",
      `agent-status-dot--${state}`,
      "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none",
      className,
    );

  return (
    <span className={classes} style={plain ? undefined : { borderColor: color }} data-provider={provider ?? "unknown"} title={plain ? (provider ?? "Agent") : `${provider ?? "Agent"} · ${state}`} aria-hidden="true">
      <span className={cn("inline-flex text-fg", branded && "rounded-full bg-[#161616]")}><AgentIcon provider={provider} size={14} /></span>
    </span>
  );
}
