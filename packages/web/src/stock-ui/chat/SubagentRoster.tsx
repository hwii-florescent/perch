import { useState } from "react";
import { Chevron, type NativeUiSubagentGroup } from "@perch/sdk";

const DOT: Record<string, string> = {
  working: "bg-fg animate-pulse motion-reduce:animate-none",
  completed: "bg-subtext-0",
  idle: "bg-subtext-0 opacity-60",
  failed: "bg-red",
  stopped: "bg-subtext-0",
  unverifiable: "bg-subtext-0 opacity-60",
};

/** "12s", "1m 5s". */
export function duration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

const Dot = ({ state }: { state: string }) => <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${DOT[state] ?? DOT.unverifiable}`} />;

/** One spawning turn's subagents: a headline with the verdict, opening to one line per child. The core
 * worded and grouped them (`native_ui/subagents.rs`); layout follows Orca's `NativeChatSubagentRun`
 * (MIT, commit 308b5000) without its per-child transcript sections or live clock. */
export function SubagentRoster({ group }: { group: NativeUiSubagentGroup }) {
  const [open, setOpen] = useState(false);
  return <section className="text-[0.85rem]" aria-label={group.headline} data-testid="native-cli-subagents">
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
      className="flex min-h-6 w-full min-w-0 cursor-pointer items-center gap-2 rounded-ui bg-transparent px-[0.4rem] text-left text-subtext-0 [border:0] hover:bg-surface-1 hover:text-fg">
      <Dot state={group.alertState ?? group.verdictState} />
      <span className={`min-w-0 truncate ${group.working ? "text-fg" : ""}`}>{group.headline}</span>
      <span className="ml-auto shrink-0 tabular-nums" data-testid="native-cli-subagents-verdict">
        {group.verdict}{group.alert ? ` +${group.alert}` : ""}{group.durationMs !== undefined ? ` · ${duration(group.durationMs)}` : ""}
      </span>
      <Chevron open={open} className="shrink-0" />
    </button>
    {open && <ul className="m-0 list-none space-y-0.5 py-1 pl-6 pr-1">
      {group.agents.map((agent) => <li key={agent.id} className="flex min-w-0 items-center gap-2" data-testid="native-cli-subagent" data-state={agent.state}>
        <Dot state={agent.state} />
        <span className="min-w-0 truncate text-fg" title={agent.agentType ? `${agent.label} (${agent.agentType})` : agent.label}>{agent.label}</span>
        <span className="ml-auto shrink-0 tabular-nums text-subtext-0">{agent.stateLabel}</span>
      </li>)}
    </ul>}
  </section>;
}
