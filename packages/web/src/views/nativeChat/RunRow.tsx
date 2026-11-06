import { memo } from "react";
import { WORKED_FOR } from "../../components/ui/chat";
import { cn } from "../../lib/cn";
import { summarizeRun, type Step } from "./transcript";

export type FindMark = "hit" | "current";
export const FIND_MARK = { none: "", hit: "bg-accent/10", current: "outline outline-2 outline-accent" };

/** A turn's tool calls and thinking as one row: open while the agent is still working, collapsed after. */
export const RunRow = memo(function RunRow({ id, steps, live, find }: { id: string; steps: Step[]; live: boolean; find?: FindMark }) {
  return <details className={cn("message__worked-for", WORKED_FOR, FIND_MARK[find ?? "none"])} open={live || find === "current" || undefined} data-testid="native-cli-run" data-native-run={steps.length} data-block-id={id}>
    <summary>{summarizeRun(steps)}</summary>
    <div className="mt-1 flex flex-col gap-1">
      {steps.map((step) => <details key={step.id} className={cn("message__worked-for", WORKED_FOR)}>
        <summary>{step.label}</summary>
        <pre>{step.body}</pre>
      </details>)}
    </div>
  </details>;
}, (before, after) => before.live === after.live && before.find === after.find && before.steps.length === after.steps.length && before.steps.every((step, index) => step.id === after.steps[index]!.id && step.body === after.steps[index]!.body));
