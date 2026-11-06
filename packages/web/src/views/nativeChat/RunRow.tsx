import { memo } from "react";
import type { NativeUiBlock } from "@perch/shared";
import { WORKED_FOR } from "../../components/ui/chat";
import { cn } from "../../lib/cn";

export type FindMark = "hit" | "current";
export const FIND_MARK = { none: "", hit: "bg-accent/10", current: "outline outline-2 outline-accent" };

type Run = Extract<NativeUiBlock, { kind: "run" }>;

/** A turn's tool calls and thinking as one row: open while the agent is still working, collapsed after.
 * Everything it says (the sentence, each call's verb and target, which calls failed) is the core's. */
export const RunRow = memo(function RunRow({ run, find }: { run: Run; find?: FindMark }) {
  const { id, steps, live, summary, failed } = run;
  return <details className={cn("message__worked-for", WORKED_FOR, FIND_MARK[find ?? "none"])} open={live || find === "current" || undefined} data-testid="native-cli-run" data-native-run={steps.length} data-native-turn={run.turn} data-block-id={id}>
    <summary>{summary}{failed > 0 && <span className="text-red" data-testid="native-cli-run-failed">· {failed} failed</span>}</summary>
    <div className="mt-1 flex flex-col gap-1">
      {steps.map((step) => <details key={step.id} className={cn("message__worked-for", WORKED_FOR)} data-native-step={step.tool?.state ?? step.kind}>
        <summary className={step.tool?.state === "failed" ? "text-red" : undefined}>{step.label}</summary>
        {step.body && <pre>{step.body}</pre>}
        {step.tool?.output && <pre data-testid="native-cli-tool-output">{step.tool.output}</pre>}
      </details>)}
    </div>
  </details>;
}, (before, after) => before.find === after.find && JSON.stringify(before.run) === JSON.stringify(after.run));
