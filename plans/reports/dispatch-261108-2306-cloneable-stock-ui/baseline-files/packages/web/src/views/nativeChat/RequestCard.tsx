import { useEffect, useRef, useState } from "react";
import type { NativeUiRequest } from "@perch/shared";
import { cn } from "../../lib/cn";

/** What the user chose, kept under the transcript once the CLI moves on. */
export type Receipt = { id: string; title: string; label: string };

const CARD = "flex flex-col gap-2 rounded-soft bg-surface-0 p-3 text-[0.85rem] outline-1 outline-solid outline-accent focus:outline-2";
const OPTION = "flex w-full cursor-pointer items-baseline gap-2 rounded-ui bg-surface-1 px-2 py-1.5 text-left text-fg [border:0] [font:inherit] hover:bg-overlay-0 disabled:cursor-not-allowed disabled:opacity-50";

/** The permission prompt or question the CLI is waiting on. Number keys choose, or Up/Down then Enter; focus lands here so they work at once. */
export function RequestCard({ request, canAnswer, answering, onAnswer, keepFocus }: { request: NativeUiRequest; canAnswer: boolean; answering: boolean; onAnswer: (key: string) => void; keepFocus: boolean }) {
  const card = useRef<HTMLDivElement>(null);
  // A new prompt takes focus, unless the user is mid-sentence in the composer.
  useEffect(() => { if (!keepFocus) card.current?.focus(); }, [request.id, keepFocus]);
  const disabled = !canAnswer || answering;
  // The row Enter accepts. Starts at the first option; a new prompt starts over.
  const [cursor, setCursor] = useState(0);
  useEffect(() => setCursor(0), [request.id]);
  return <div ref={card} className={cn("native-cli-chat__request", CARD)} data-testid="native-cli-request" data-request-id={request.id} role="group" aria-label={request.title || "The CLI is asking"} tabIndex={-1}
    onKeyDown={(event) => {
      if (disabled || event.metaKey || event.ctrlKey || event.altKey) return;
      const count = request.options.length;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setCursor((at) => (at + (event.key === "ArrowDown" ? 1 : count - 1)) % count); return; }
      // Enter on a focused option button presses that button; anywhere else it takes the highlighted row.
      if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); const picked = request.options[cursor]; if (picked) onAnswer(picked.key); return; }
      const option = request.options.find((candidate) => candidate.key === event.key);
      if (option) { event.preventDefault(); onAnswer(option.key); }
    }}>
    {request.title && <strong className="font-semibold">{request.title}</strong>}
    {request.detail && <pre className="m-0 max-h-40 overflow-auto rounded-ui bg-surface-1 p-2 text-[0.8rem] whitespace-pre-wrap [overflow-wrap:anywhere]" data-testid="native-cli-request-detail">{request.detail}</pre>}
    <div className="flex flex-col gap-1">
      {request.options.map((option, index) => <button key={option.key} type="button" className={cn(OPTION, index === cursor && !disabled && "outline-1 outline-solid outline-accent")} aria-current={index === cursor || undefined} onMouseEnter={() => setCursor(index)} disabled={disabled} data-testid={`native-cli-request-option-${option.key}`} onClick={() => onAnswer(option.key)}>
        <kbd className="shrink-0 rounded-[0.25rem] bg-surface-1 px-1.5 text-[0.75rem] text-subtext-0">{option.key}</kbd>
        <span className="min-w-0"><span>{option.label}</span>{option.detail && <span className="block text-[0.78rem] text-subtext-0">{option.detail}</span>}</span>
      </button>)}
    </div>
    {!canAnswer ? <span className="text-[12px] text-subtext-0">Take control to answer here, or answer in Terminal.</span>
      : <span className="text-[12px] text-subtext-0">Press a number, or ↑↓ and Enter.</span>}
  </div>;
}

/** The CLI is waiting on you but showed nothing this view can answer (another provider, a text answer, a layout it does not know). */
export function WaitingNotice() {
  return <div className="rounded-soft bg-surface-0 p-3 text-[0.85rem] text-subtext-0" aria-live="polite" data-testid="native-cli-waiting">The CLI is waiting for you. Switch to Terminal to answer.</div>;
}

export function Receipts({ items }: { items: Receipt[] }) {
  if (!items.length) return null;
  return <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[12px] text-subtext-0" aria-label="Answered prompts" data-testid="native-cli-receipts">
    {items.map((item) => <li key={item.id}>Answered “{item.label}”{item.title ? ` — ${item.title}` : ""}</li>)}
  </ul>;
}
