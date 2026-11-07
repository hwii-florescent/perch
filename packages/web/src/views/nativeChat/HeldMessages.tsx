import { useState } from "react";
import type { HeldMessage } from "@perch/shared";
import { cn } from "../../lib/cn";
import { button } from "../../components/ui/button";
import { CHAT_COLUMN } from "../../components/ui/chat";
import type { InboundModeName, InboundOutcome, InboundState } from "../../inbound";

/** What each mode does, in the words the person chooses between. */
export const MODE_LABEL: Record<InboundModeName, string> = {
  accept: "Accept messages from other sessions",
  hold: "Hold messages for my approval",
  refuse: "Refuse messages from other sessions",
};

/** Who a held message is from. */
export function senderLine(message: Pick<HeldMessage, "fromProvider" | "fromLabel">): string {
  return [message.fromProvider, message.fromLabel && `“${message.fromLabel}”`].filter(Boolean).join(" ") || "another session";
}

export type OnInboundAct = (click: { action: "set_mode"; mode: InboundModeName } | { action: "deliver" | "discard"; messageId: string } | { action: "deliver_all" | "discard_all" }) => Promise<InboundOutcome>;

/** The messages other sessions sent that wait for this session's person: each with Deliver and Discard, and the
 * session's mode. Shown only while the session holds or refuses, or something is held; accepting with nothing held
 * is quiet (the mode is in the session's menu). The core decides and says why it refused; this starts nothing. */
export function HeldMessages({ state, canAct, onAct, onOpen }: { state: InboundState; canAct: boolean; onAct: OnInboundAct; onOpen: (sessionId: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  if (state.mode === "accept" && !state.held.length) return null;
  const act: OnInboundAct = async (click) => {
    setBusy(true);
    setNote("");
    try {
      const result = await onAct(click);
      if (result.outcome === "refused") setNote(result.reason || "Perch refused");
      return result;
    } finally { setBusy(false); }
  };
  return <section aria-label="Messages from other sessions" data-testid="native-cli-inbound" data-mode={state.mode}
    className={cn(CHAT_COLUMN, "mx-4 mb-1 gap-2 rounded-soft bg-surface-0 px-3 py-2 text-[0.85rem] outline-1 outline-solid outline-accent")}>
    <div className="flex flex-wrap items-center gap-2">
      <strong className="font-semibold">{state.held.length ? `${state.held.length} message${state.held.length === 1 ? "" : "s"} from other sessions wait for you` : state.mode === "hold" ? "Holding messages from other sessions" : "Refusing messages from other sessions"}</strong>
      <select value={state.mode} aria-label="What this session does with messages from other sessions" data-testid="native-cli-inbound-mode" disabled={!canAct || busy}
        onChange={(event) => void act({ action: "set_mode", mode: event.target.value as InboundModeName })}
        className="ml-auto rounded-ui bg-surface-1 px-2 py-1 text-inherit [border:0] [font:inherit]">
        {(Object.keys(MODE_LABEL) as InboundModeName[]).map((mode) => <option key={mode} value={mode}>{MODE_LABEL[mode]}</option>)}
      </select>
    </div>
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {state.held.map((message) => <li key={message.id} className="flex min-w-0 flex-col gap-1" data-testid="native-cli-held" data-held={message.id}>
        <div className="flex flex-wrap items-center gap-2 text-[0.8rem] text-subtext-0">
          <span data-testid="native-cli-held-from">{senderLine(message)}</span>
          <button type="button" data-testid="native-cli-held-open" onClick={() => onOpen(message.fromSessionId)} className={button({ size: "sm" })}>Open</button>
        </div>
        <p className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]" data-testid="native-cli-held-text">{message.text}{message.truncated ? " …" : ""}</p>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" disabled={!canAct || busy} data-testid="native-cli-held-deliver" onClick={() => void act({ action: "deliver", messageId: message.id })} className={button({ size: "sm", variant: "soft" })}>Deliver</button>
          <button type="button" disabled={!canAct || busy} data-testid="native-cli-held-discard" onClick={() => void act({ action: "discard", messageId: message.id })} className={button({ size: "sm" })}>Discard</button>
        </div>
      </li>)}
    </ul>
    {state.held.length > 1 && <div className="flex items-center gap-1">
      <button type="button" disabled={!canAct || busy} data-testid="native-cli-held-deliver-all" onClick={() => void act({ action: "deliver_all" })} className={button({ size: "sm", variant: "soft" })}>Deliver all ({state.held.length})</button>
      <button type="button" disabled={!canAct || busy} data-testid="native-cli-held-discard-all" onClick={() => void act({ action: "discard_all" })} className={button({ size: "sm" })}>Discard all</button>
    </div>}
    {note && <p className="m-0 text-[0.8rem] text-yellow" role="status" data-testid="native-cli-inbound-note">{note}</p>}
    {!canAct && <span className="text-[12px] text-subtext-0">Take control of this chat to answer.</span>}
  </section>;
}
