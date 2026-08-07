/**
 * AgentPicker.tsx — Bug 2/3 fix: a small, reusable claude/codex segmented
 * control for session-*create* flows (as opposed to `CliStartPanel`'s own
 * inline toggle, which is CLI-mode-only and pre-dates this component).
 *
 * Used by the sidebar's "+ New session" popover and `NoSessionPanel` so a
 * provider choice is available at every hosted-mode create entry point, not
 * just CLI mode's. See `store.ts`'s `hostedAgentBySession`/`lastAgentChoice`
 * for how the choice is threaded through and remembered.
 */
import type { AgentKind } from "@perch/shared";
import { AGENTS } from "../models";

export function AgentPicker({
  value,
  onChange,
  testIdPrefix = "new-session-agent",
  className,
}: {
  value: AgentKind;
  onChange: (agent: AgentKind) => void;
  /** Overrides the default `new-session-agent-{claude,codex}` testids —
   * needed wherever a second instance of this picker can be mounted at the
   * same time as another one (e.g. the sidebar popover open on top of
   * `NoSessionPanel`), so `data-testid` stays unique in the DOM. */
  testIdPrefix?: string;
  className?: string;
}) {
  return (
    <div
      className={"agent-picker" + (className ? ` ${className}` : "")}
      role="group"
      aria-label="Agent"
    >
      {AGENTS.map((a) => (
        <button
          key={a.id}
          type="button"
          className={"agent-picker__btn" + (a.id === value ? " agent-picker__btn--active" : "")}
          data-testid={`${testIdPrefix}-${a.id}`}
          aria-pressed={a.id === value}
          onClick={() => onChange(a.id)}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
