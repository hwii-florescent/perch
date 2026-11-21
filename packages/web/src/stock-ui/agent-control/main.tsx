//! Agent terminal controls, the stock screen `stock:agent-control`: what sits over an agent's terminal. Drawn in two
//! places (`part`): `top`, the chip at the top right that says how this view stands ("Viewing agent", "Another view
//! is typing in this agent", "Reconnecting…", ...) with Take control / Fit here, or Retry CLI when the agent could not
//! start; `bottom`, the agent's error line and, while the agent is hibernated, the banner with Resume agent. An agent
//! that exited has no banner: its tab closes.
//!
//! The terminal's authority is Perch's: taking control moves the input and resize lease, Resume starts the agent
//! again, each through Perch (props); this screen only asks, and shows what Perch says.
//! Perch shows it, or the person's package chosen for it (`perch mod use stock:agent-control <id>`), with the same
//! props. A phone keeps Perch's own.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:agent-control` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside
//! it (docs/MOD-SDK.md).
import { buttonClass, cn, glassClass, type AgentControlProps } from "@perch/sdk";

const TAP = "[.app--mobile_&]:min-h-11";

export default function AgentControl({ part, agent, label, pending, onRetry, control, error, sleeping }: AgentControlProps) {
  if (part === "top") {
    if (!label) return null;
    return (
      <div className={cn(glassClass, "absolute top-2 right-3 z-[2] flex items-center gap-1 py-0.5 pr-0.5 pl-3 text-[0.8rem] text-subtext-0")} data-testid="agent-control-chip">
        <span role="status">{label}</span>
        {onRetry && <button type="button" className={buttonClass({ variant: "soft", size: "md", className: TAP })} disabled={pending} onClick={onRetry}>Retry CLI</button>}
        {control && <button type="button" className={buttonClass({ variant: "soft", size: "md", className: TAP })} data-testid="agent-take-control" disabled={control.disabled} onClick={control.onClick}>{control.label}</button>}
      </div>
    );
  }
  return (
    <>
      {error && <div className="terminal__cli-error" role="alert">{error}</div>}
      {sleeping && (
        <div className="terminal__exited terminal__exited--cli" data-testid="cli-sleeping">
          <span className="terminal__exited-text">{agent} is sleeping to save memory — its conversation is kept</span>
          <span className="terminal__exited-actions">
            <button type="button" className={buttonClass({ variant: "primary", size: "md", className: TAP })} data-testid="cli-resume" onClick={sleeping.onResume}>Resume agent</button>
          </span>
        </div>
      )}
    </>
  );
}
