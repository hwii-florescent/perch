import { memo } from "react";
import { WORKED_FOR } from "../../components/ui/chat";
import { cn } from "../../lib/cn";
import { summarizeRun, type Step } from "./transcript";

/** A turn's tool calls and thinking as one row: open while the agent is still working, collapsed after. */
export const RunRow = memo(function RunRow({ steps, live }: { steps: Step[]; live: boolean }) {
  return <details className={cn("message__worked-for", WORKED_FOR)} open={live || undefined} data-testid="native-cli-run" data-native-run={steps.length}>
    <summary>{summarizeRun(steps)}</summary>
    <div className="mt-1 flex flex-col gap-1">
      {steps.map((step) => <details key={step.id} className={cn("message__worked-for", WORKED_FOR)}>
        <summary>{step.label}</summary>
        <pre>{step.body}</pre>
      </details>)}
    </div>
  </details>;
}, (before, after) => before.live === after.live && before.steps.length === after.steps.length && before.steps.every((step, index) => step.id === after.steps[index]!.id && step.body === after.steps[index]!.body));
