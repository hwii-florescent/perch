import { cn } from "../../lib/cn";
import type { Tone, UiBlock } from "./uiBlocks";

const TONE_TEXT: Record<Tone, string> = { info: "text-accent", success: "text-green", warning: "text-yellow", error: "text-red" };
const TONE_EDGE: Record<Tone, string> = { info: "border-l-accent", success: "border-l-green", warning: "border-l-yellow", error: "border-l-red" };
const STEP_MARK = { todo: "○", doing: "◐", done: "✓", failed: "✕" } as const;
const STEP_TEXT = { todo: "text-subtext-0", doing: "text-accent", done: "text-green", failed: "text-red" } as const;

/** Draws an agent's `perch-ui` blocks (`perchUi.ts`) with the app's own tokens. Text only. */
export function PerchUi({ blocks }: { blocks: UiBlock[] }) {
  return <div className="my-2 flex flex-col gap-2 text-[0.9em]" data-testid="native-cli-perch-ui">
    {blocks.map((b, index) => {
      switch (b.type) {
        case "callout":
          return <div key={index} role="note" className={cn("rounded-soft border-l-[3px] bg-surface-0 px-3 py-2", TONE_EDGE[b.tone])}>
            {b.title && <strong className={cn("block font-semibold", TONE_TEXT[b.tone])}>{b.title}</strong>}
            <span className="whitespace-pre-wrap">{b.text}</span>
          </div>;
        case "stats":
          return <div key={index} className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-2">
            {b.items.map((item, i) => <div key={i} className="rounded-soft bg-surface-0 px-3 py-2">
              <div className="text-[0.8em] text-subtext-0">{item.label}</div>
              <div className={cn("text-[1.4em] leading-tight font-semibold tabular-nums", item.tone && TONE_TEXT[item.tone])}>{item.value}</div>
              {item.hint && <div className="text-[0.8em] text-subtext-0">{item.hint}</div>}
            </div>)}
          </div>;
        case "table":
          return <div key={index} className="overflow-x-auto rounded-soft bg-surface-0">
            <table className="md-table">
              {b.caption && <caption>{b.caption}</caption>}
              <thead><tr>{b.columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
              <tbody>{b.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}>{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>;
        case "steps":
          return <ul key={index} className="m-0 flex list-none flex-col gap-1 rounded-soft bg-surface-0 px-3 py-2">
            {b.items.map((item, i) => <li key={i} className="flex gap-2" data-state={item.state}>
              <span aria-label={item.state} className={cn("w-4 shrink-0 text-center", STEP_TEXT[item.state])}>{STEP_MARK[item.state]}</span>
              <span className={item.state === "done" ? "text-subtext-0" : undefined}>{item.text}</span>
            </li>)}
          </ul>;
        case "bars": {
          const max = Math.max(...b.items.map((i) => i.value), 0) || 1;
          return <div key={index} className="rounded-soft bg-surface-0 px-3 py-2">
            {b.title && <strong className="mb-1 block font-semibold">{b.title}</strong>}
            {b.items.map((item, i) => <div key={i} className="grid grid-cols-[minmax(4rem,10rem)_1fr_auto] items-center gap-2 py-0.5">
              <span className="truncate text-subtext-0" title={item.label}>{item.label}</span>
              <span className="h-2 rounded-full bg-surface-1"><span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(0, item.value) / max * 100}%` }} /></span>
              <span className="tabular-nums">{item.value}</span>
            </div>)}
          </div>;
        }
      }
    })}
  </div>;
}
