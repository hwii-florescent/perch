import { useState } from "react";
import type { SuggestionCard, SuggestionItem } from "@perch/shared";
import { cn } from "../../lib/cn";
import { button } from "../../components/ui/button";
import { CHAT_COLUMN } from "../../components/ui/chat";
import type { SuggestionAction, SuggestionOutcome } from "../../suggestions";

/** What a click asks of the core for one card; the chat adds its session and input lease. */
export type SuggestionClick = Omit<SuggestionAction, "sessionId" | "generation" | "cardId">;
/** Runs one action on a card under the chat's input lease and reports the core's outcome. */
export type OnSuggestionAct = (cardId: string, click: SuggestionClick) => Promise<SuggestionOutcome>;
/** Sends the task to the lead as the person's own message through the chat's composer path. */
export type OnSendHere = (task: string) => Promise<{ ok: boolean; reason?: string }>;

const AGENTS = ["claude", "codex", "pi", "omp"];
const FIELD = "rounded-ui bg-surface-1 px-2 py-1 text-inherit [border:0] [font:inherit]";

/** Where a started task's sub-session is, in Perch's words from its dispatch record. */
export function startedWords(dispatch?: string): string {
  switch (dispatch) {
    case "starting": return "Starting";
    case "running": return "Started";
    case "start_unknown": return "Start not confirmed; Perch is not sure it started";
    case "failed": return "Failed to start";
    case "stopping": return "Stopping";
    case "stop_unknown": return "Stop not confirmed";
    case "stopped": return "Stopped";
    case "exited": return "Finished";
    default: return "Started";
  }
}

/** What the task will run with, as the person would read it. */
export function optionsLine(item: Pick<SuggestionItem, "agent" | "model" | "worktree">): string {
  return [item.agent, item.model, item.worktree ? "own worktree" : undefined].filter(Boolean).join(" · ");
}

interface ItemProps {
  item: SuggestionItem;
  busy: boolean;
  canAct: boolean;
  act: (click: SuggestionClick) => Promise<SuggestionOutcome>;
  sendHere: OnSendHere | undefined;
  onOpen: (sessionId: string) => void;
  note: (text: string) => void;
}

function Item({ item, busy, canAct, act, sendHere, onOpen, note }: ItemProps) {
  const [options, setOptions] = useState(false);
  const [agent, setAgent] = useState(item.agent);
  const [model, setModel] = useState(item.model ?? "");
  const [worktree, setWorktree] = useState(item.worktree);
  const waiting = item.state === "pending";
  const answer = async (click: SuggestionClick) => {
    const result = await act({ ...click, suggestionId: item.id });
    note(result.outcome === "refused" ? result.reason || "Perch refused" : result.reason || "");
  };
  // Sent first and recorded after: a task that did not reach the lead stays on the card.
  const here = async () => {
    if (!sendHere) return;
    const sent = await sendHere(item.task);
    if (!sent.ok) note(sent.reason || "The message was not sent");
    else await answer({ action: "handed" });
  };
  return <li className="flex min-w-0 flex-col gap-1" data-testid="native-cli-suggestion" data-suggestion={item.id} data-state={item.state}>
    <p className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]" data-testid="native-cli-suggestion-task">{item.task}</p>
    <p className="m-0 text-[0.78rem] text-subtext-0" data-testid="native-cli-suggestion-options">{optionsLine(item)}</p>
    {item.state === "starting" && <p className="m-0 text-[0.8rem] text-subtext-0" role="status">Starting…</p>}
    {item.state === "started" && <p className="m-0 flex items-center gap-2 text-[0.8rem] text-subtext-0" data-testid="native-cli-suggestion-started" data-dispatch={item.dispatch}>
      {startedWords(item.dispatch)}{item.reason ? ` (${item.reason})` : ""}
      {item.childSessionId && <button type="button" data-testid="native-cli-suggestion-open" onClick={() => onOpen(item.childSessionId!)} className={button({ size: "sm" })}>Open</button>}
    </p>}
    {item.reason && waiting && <p className="m-0 text-[0.8rem] text-yellow" role="alert" data-testid="native-cli-suggestion-reason">Not started: {item.reason}</p>}
    {waiting && <div className="flex flex-wrap items-center gap-1">
      <button type="button" disabled={!canAct || busy} data-testid="native-cli-suggestion-start" onClick={() => void answer({ action: "start" })} className={button({ size: "sm", variant: "soft" })}>Start</button>
      <button type="button" disabled={!canAct || busy || !sendHere} data-testid="native-cli-suggestion-here" onClick={() => void here()} className={button({ size: "sm" })}>Do it here</button>
      <button type="button" disabled={!canAct || busy} aria-expanded={options} data-testid="native-cli-suggestion-options-toggle" onClick={() => setOptions(!options)} className={button({ size: "sm" })}>Options</button>
      <button type="button" disabled={!canAct || busy} data-testid="native-cli-suggestion-dismiss" onClick={() => void answer({ action: "dismiss" })} className={button({ size: "sm" })}>Dismiss</button>
    </div>}
    {waiting && options && <div className="flex flex-wrap items-center gap-2 text-[0.8rem]" data-testid="native-cli-suggestion-options-form">
      <label className="flex items-center gap-1">Agent
        <select value={agent} aria-label="Agent" data-testid="native-cli-suggestion-agent" onChange={(event) => setAgent(event.target.value)} className={FIELD}>
          {AGENTS.map((name) => <option key={name} value={name}>{name}</option>)}
        </select></label>
      <label className="flex items-center gap-1">Model
        <input type="text" value={model} placeholder="the agent's default" aria-label="Model" data-testid="native-cli-suggestion-model" onChange={(event) => setModel(event.target.value)} className={cn(FIELD, "w-40")} /></label>
      <label className="flex items-center gap-1"><input type="checkbox" checked={worktree} aria-label="Own git worktree" data-testid="native-cli-suggestion-worktree" onChange={(event) => setWorktree(event.target.checked)} />Own worktree</label>
      <button type="button" disabled={!canAct || busy} data-testid="native-cli-suggestion-start-options" onClick={() => void answer({ action: "start", agent, model: model.trim(), worktree })} className={button({ size: "sm", variant: "soft" })}>Start with these</button>
    </div>}
  </li>;
}

/** The suggested tasks a lead put in front of the person: a card per `perch suggest`, each task with Start,
 * Do it here, Options and Dismiss, and Start all for several. The core decides what each does and says why it
 * refused; nothing here starts anything by itself. */
export function SuggestionCards({ cards, canAct, onAct, onSendHere, onOpen }: { cards: readonly SuggestionCard[]; canAct: boolean; onAct?: OnSuggestionAct; onSendHere?: OnSendHere; onOpen: (sessionId: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (!cards.length) return null;
  return <div className="shrink-0 px-4 pb-1" data-testid="native-cli-suggestions">
    {cards.map((card) => {
      const waiting = card.items.filter((item) => item.state === "pending");
      const say = (text: string) => setNotes((all) => ({ ...all, [card.id]: text }));
      const act = async (click: SuggestionClick): Promise<SuggestionOutcome> => {
        if (!onAct) return { outcome: "refused", reason: "Take control of this chat first" };
        setBusy(true);
        try { return await onAct(card.id, click); } finally { setBusy(false); }
      };
      const startAll = async () => {
        const result = await act({ action: "start_all" });
        say(result.outcome === "started" ? "" : result.reason || (result.outcome === "partial" ? "Some tasks were not started" : "Nothing was started"));
      };
      return <section key={card.id} aria-label="Suggested tasks" data-testid="native-cli-suggestion-card" data-card={card.id}
        className={cn(CHAT_COLUMN, "mb-1 gap-2 rounded-soft bg-surface-0 px-3 py-2 text-[0.85rem] outline-1 outline-solid outline-accent")}>
        <strong className="font-semibold">{card.items.length > 1 ? "Suggested tasks" : "Suggested task"}</strong>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {card.items.map((item) => <Item key={item.id} item={item} busy={busy} canAct={canAct} act={act} sendHere={onSendHere} onOpen={onOpen} note={say} />)}
        </ul>
        {waiting.length > 1 && <div className="flex items-center gap-1">
          <button type="button" disabled={!canAct || busy} data-testid="native-cli-suggestion-start-all" onClick={() => void startAll()} className={button({ size: "sm", variant: "soft" })}>Start all ({waiting.length})</button>
          <button type="button" disabled={!canAct || busy} data-testid="native-cli-suggestion-dismiss-all" onClick={() => void act({ action: "dismiss" })} className={button({ size: "sm" })}>Dismiss all</button>
        </div>}
        {notes[card.id] && <p className="m-0 text-[0.8rem] text-yellow" role="status" data-testid="native-cli-suggestion-note">{notes[card.id]}</p>}
        {!canAct && waiting.length > 0 && <span className="text-[12px] text-subtext-0">Take control of this chat to answer a suggestion.</span>}
      </section>;
    })}
  </div>;
}
