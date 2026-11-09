import { useState } from "react";
import { agentInputGeneration } from "../../agentTerminals";
import { button } from "../../components/ui/button";
import { glass } from "../../components/ui/glass";
import { cn } from "../../lib/cn";
import { usePerchStore } from "../../store";
import { actOnSuggestion, useSuggestions, waitingCount } from "../../suggestions";
// The suggestion cards are the chat screen's (`stock:chat`); the terminal view shows the same ones, compiled in.
import { SuggestionCards } from "../../stock-ui/chat/SuggestionCards";

/** The suggested tasks a lead left for a person, for a lead shown as its terminal: the chat's cards are
 * not on screen there. Nothing when none waits; otherwise a small count over the terminal that opens
 * the same cards (Start, Start all, Dismiss, Options) the chat shows. The core decides what each does. */
export function TerminalSuggestions({ sessionId, terminalId, controlling }: { sessionId: string; terminalId: string | null; controlling: boolean }) {
  const { cards } = useSuggestions(sessionId);
  const connected = usePerchStore((state) => state.connected);
  const [open, setOpen] = useState(false);
  const count = waitingCount(cards);
  if (!count) return null;
  return <div className="absolute bottom-3 right-3 z-[3] flex max-h-[70%] max-w-[min(34rem,calc(100%-1.5rem))] flex-col items-end gap-1" data-testid="terminal-suggestions">
    {open && <div className={cn(glass, "min-h-0 overflow-y-auto rounded-soft py-1")} data-testid="terminal-suggestions-panel">
      <SuggestionCards cards={cards} canAct={controlling && connected} onOpen={(id) => usePerchStore.getState().switchSession(id)}
        onAct={(cardId, click) => {
          // Under this terminal's input lease, like typing in it; without it the core refuses and nothing is done.
          const generation = terminalId ? agentInputGeneration(terminalId) : undefined;
          if (generation === undefined) return Promise.resolve({ outcome: "refused", reason: "Take control of this terminal first" });
          return actOnSuggestion({ sessionId, cardId, generation, ...click });
        }} />
    </div>}
    <button type="button" aria-expanded={open} data-testid="terminal-suggestions-toggle" onClick={() => setOpen(!open)}
      className={cn(glass, button({ size: "md", variant: "soft" }))}>
      {count === 1 ? "1 suggested task" : `${count} suggested tasks`}
    </button>
  </div>;
}
