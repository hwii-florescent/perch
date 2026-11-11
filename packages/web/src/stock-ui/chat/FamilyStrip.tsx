import { useEffect, useRef, useState } from "react";
import { Chevron, buttonClass as button, cn, menuItemClass as menuItem, menuPanel, type ActOutcome, type CrewRow } from "@perch/sdk";
import { CHAT_COLUMN } from "./look";

/** Runs one action on a child under the chat's input lease and reports the core's outcome. */
export type OnAct = (childSessionId: string, action: ActionName, text: string | undefined, onProgress: (result: ActOutcome) => void) => Promise<ActOutcome>;
export type ActionName = "message" | "steer" | "interrupt" | "stop";
const ACTION_LABEL: Record<ActionName, string> = { message: "Message", steer: "Steer", interrupt: "Interrupt", stop: "Stop" };

/** What became of an action, in the core's words and never better than it said: a steer or an
 * interrupt that was not confirmed may still have taken effect, and Perch does not retry it. */
export function actionReceipt(action: string, outcome: string, reason?: string): string {
  const name = ACTION_LABEL[action as ActionName] ?? action;
  const why = reason ? `: ${reason}` : "";
  switch (outcome) {
    case "queued": return `Message queued; it is delivered when the child is idle${why}`;
    case "sent": return `${name} sent, waiting for its answer…`;
    case "confirmed": return action === "stop" ? "Stopped" : `${name} confirmed`;
    case "not_confirmed": return action === "stop" ? `Stop not confirmed${why}` : `${name} sent, not confirmed${why}. It may have taken effect; Perch does not retry it`;
    case "refused": return `${name} refused${why}`;
    default: return `${name}: ${outcome}${why}`;
  }
}

/** Where a row stands, in Perch's own words and from Perch's records alone: the dispatch record of a
 * child that is no longer running outranks its last lifecycle state, a pending approval or question
 * (never an agent's claim) outranks "Working", and an unreadable state is "State unknown", never idle. */
export function stateOf(row: CrewRow): { word: string; tone: "working" | "needs" | "quiet" | "alert" } {
  const dispatched: Record<string, [string, "quiet" | "alert"]> = {
    starting: ["Starting", "quiet"],
    stopping: ["Stopping", "quiet"],
    stopped: ["Stopped", "quiet"],
    exited: ["Exited", "quiet"],
    failed: ["Failed to start", "alert"],
    start_unknown: ["Start not confirmed", "alert"],
    stop_unknown: ["Stop not confirmed", "alert"],
  };
  const record = row.dispatch ? dispatched[row.dispatch] : undefined;
  if (record) return { word: record[0], tone: record[1] };
  if (row.needsYou || row.lifecycle === "blocked") return { word: "Waiting on you", tone: "needs" };
  switch (row.lifecycle) {
    case "working": return { word: "Working", tone: "working" };
    case "idle": return { word: "Idle", tone: "quiet" };
    case "done": return { word: "Finished its turn", tone: "quiet" };
    case "sleeping": return { word: "Asleep", tone: "quiet" };
    case "exited": return { word: "Exited", tone: "quiet" };
    case "error": return { word: "Error", tone: "alert" };
    case "reconnecting": return { word: "Reconnecting", tone: "alert" };
    default: return { word: "State unknown", tone: "quiet" };
  }
}

/** "now", "5m ago", "2h ago", "3d ago". */
export function ago(at: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - at) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

/** The line that says what became of the newest message between this session and the row. */
export function receiptNote(latest: NonNullable<CrewRow["latest"]>): string {
  switch (latest.receipt) {
    case "delivered":
      if (latest.handoff === "queued_in_agent") return "queued in the agent, for after its running turn";
      return latest.handoff === "steered" ? "steered into its running turn" : "";
    case "held": return "held: waiting for its person to approve it";
    case "queued": return latest.reason ? `queued, waiting: ${latest.reason}` : "queued";
    case "delivering": return "being delivered";
    case "unconfirmed": return "handed over, not confirmed";
    case "undelivered": return latest.reason ? `not delivered: ${latest.reason}` : "not delivered";
    default: return latest.receipt;
  }
}

/** Orca's headline counts, from the four records: working, waiting on you, reported. */
export function headline(rows: readonly CrewRow[]): string {
  const workers = rows.filter((row) => row.role !== "manager");
  const parts = [
    [workers.filter((row) => stateOf(row).tone === "working").length, "working"],
    [workers.filter((row) => stateOf(row).tone === "needs").length, "waiting on you"],
    [workers.filter((row) => row.report?.source === "report" || row.report?.source === "summary").length, "reported"],
  ].filter(([count]) => Number(count) > 0).map(([count, word]) => `${count} ${word}`);
  return parts.length ? parts.join(" · ") : `${rows.length} in this run`;
}

/** What a report is called: its own words, a cheap model's summary of the turn, or the fallback. */
function reportWords(report?: CrewRow["report"]): string {
  if (report?.source === "report") return "Reported";
  if (report?.source === "summary") return `Summary by ${report.model ?? "a model"}`;
  return "Last message, not a report";
}

const DOT = { working: "bg-fg animate-pulse motion-reduce:animate-none", needs: "bg-yellow", quiet: "bg-subtext-0 opacity-60", alert: "bg-red" };
const ROLE: Record<string, string> = { manager: "Lead", worker: "", peer: "Peer" };

/** The row's actions: Message is the default button, the menu holds the rest (Orca's `CrewRowMenu`
 * shape, MIT, 308b5000). An action that is not available stays in the menu, disabled, with its reason. */
function RowActions({ row, name, onAct, unavailable, onRefresh }: { row: CrewRow; name: string; onAct: OnAct; unavailable?: string; onRefresh?: () => void }) {
  const [menu, setMenu] = useState(false);
  const [compose, setCompose] = useState<"message" | "steer" | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState("");
  const holder = useRef<HTMLDivElement>(null);
  // What can be done depends on the child's running turn, which changes without a session update: ask
  // again as the menu opens and every couple of seconds while it stays open.
  useEffect(() => {
    if (!menu || !onRefresh) return;
    onRefresh();
    const timer = setInterval(onRefresh, 2000);
    return () => clearInterval(timer);
  }, [menu, onRefresh]);
  useEffect(() => {
    if (!menu) return;
    const close = (event: Event) => { if (!(event.target instanceof Node && holder.current?.contains(event.target))) setMenu(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [menu]);
  const state = (action: ActionName) => {
    if (unavailable) return { ok: false, reason: unavailable };
    return row.actions?.[action] ?? { ok: false, reason: "Perch has not said whether this is possible" };
  };
  const run = async (action: ActionName, body?: string) => {
    setBusy(true);
    setReceipt(actionReceipt(action, "sent"));
    const result = await onAct(row.sessionId, action, body, (progress) => setReceipt(actionReceipt(action, progress.outcome, progress.reason)));
    setReceipt(actionReceipt(action, result.outcome, result.reason));
    setBusy(false);
    return result;
  };
  const send = async () => {
    if (!compose || !text.trim() || busy) return;
    const result = await run(compose, text.trim());
    // The words stay when nothing was done, so they are not lost; once handed over they are gone.
    if (result.outcome !== "refused") { setText(""); setCompose(null); }
  };
  const choose = (action: ActionName) => {
    setMenu(false);
    if (action === "message" || action === "steer") { setCompose(action); setConfirmStop(false); }
    else if (action === "stop") { setCompose(null); setConfirmStop(true); }
    else { setCompose(null); setConfirmStop(false); void run("interrupt"); }
  };
  const message = state("message");
  return <div className="flex flex-col gap-1 pl-5" data-testid="native-cli-family-actions">
    <div ref={holder} className="relative flex items-center gap-1">
      <button type="button" disabled={!message.ok || busy} title={message.ok ? undefined : message.reason} data-testid="native-cli-family-message" onClick={() => choose("message")} className={button({ size: "sm" })}>Message</button>
      <button type="button" aria-haspopup="menu" aria-expanded={menu} aria-label={`More actions for ${name}`} data-testid="native-cli-family-more" onClick={() => setMenu(!menu)} className={button({ size: "sm" })}>⋯</button>
      {menu && <div role="menu" aria-label={`Actions for ${name}`} className={cn(menuPanel, "absolute top-full left-0 z-10 min-w-56")}>
        {(["steer", "interrupt", "stop"] as const).map((action) => {
          const item = state(action);
          return <button key={action} type="button" role="menuitem" disabled={!item.ok} data-testid={`native-cli-family-${action}`} onClick={() => choose(action)} className={menuItem({ danger: action === "stop" })}>
            {ACTION_LABEL[action]}{item.ok ? null : <span className="block text-[0.72rem] text-subtext-0" data-testid={`native-cli-family-${action}-reason`}>{item.reason}</span>}
          </button>;
        })}
      </div>}
    </div>
    {compose && <div className="flex flex-col gap-1" data-testid="native-cli-family-compose">
      <textarea value={text} rows={2} aria-label={`${ACTION_LABEL[compose]} ${name}`} disabled={busy} onChange={(event) => setText(event.target.value)}
        placeholder={compose === "steer" ? "Into its running turn, to correct it…" : "Queued; delivered when it is idle…"} className="box-border w-full resize-none rounded-ui bg-surface-1 px-2 py-1 text-inherit [border:0] [font:inherit]" />
      {compose === "steer" && <span className="text-[0.72rem] text-subtext-0">A steer reaches the turn that is running now. It cannot answer a question or approve anything.</span>}
      <span className="flex gap-1">
        <button type="button" disabled={busy || !text.trim() || !state(compose).ok} title={state(compose).ok ? undefined : state(compose).reason} data-testid="native-cli-family-send" onClick={() => void send()} className={button({ size: "sm", variant: "soft" })}>{ACTION_LABEL[compose]}</button>
        <button type="button" disabled={busy} onClick={() => setCompose(null)} className={button({ size: "sm" })}>Cancel</button>
      </span>
    </div>}
    {confirmStop && <span className="flex items-center gap-1" data-testid="native-cli-family-confirm-stop">Stop {name}? It ends the session.
      <button type="button" disabled={busy} data-testid="native-cli-family-confirm" onClick={() => { setConfirmStop(false); void run("stop"); }} className={button({ size: "sm", tone: "danger" })}>Stop</button>
      <button type="button" onClick={() => setConfirmStop(false)} className={button({ size: "sm" })}>Cancel</button></span>}
    {receipt && <p className="m-0 text-[0.8rem] text-subtext-0" role="status" data-testid="native-cli-family-receipt">{receipt}</p>}
  </div>;
}

function Row({ row, now, onOpen, onAct, unavailable, onRefresh }: { row: CrewRow; now: number; onOpen: (sessionId: string) => void; onAct?: OnAct; unavailable?: string; onRefresh?: () => void }) {
  const [open, setOpen] = useState(false);
  const { word, tone } = stateOf(row);
  const name = row.role === "worker" && row.task ? row.task : row.title || row.provider;
  const latest = row.latest;
  const note = latest ? receiptNote(latest) : "";
  const reportLabel = reportWords(row.report);
  return <li className="flex min-w-0 flex-col" data-testid="native-cli-family-row" data-session={row.sessionId} data-role={row.role} data-lifecycle={row.lifecycle} data-tone={tone}>
    <div className="flex min-w-0 items-center gap-2">
      <button type="button" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} details of ${name}`} onClick={() => setOpen(!open)}
        className="flex min-h-6 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-ui bg-transparent px-[0.4rem] text-left text-fg [border:0] hover:bg-surface-1">
        <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", DOT[tone])} />
        <span className="min-w-0 truncate">{ROLE[row.role] ? <span className="text-subtext-0">{ROLE[row.role]} · </span> : null}{row.previousRun ? <span className="text-subtext-0" data-testid="native-cli-family-previous">Earlier conversation · </span> : null}{name}</span>
        {row.pr && <span className="shrink-0 text-subtext-0" data-testid="native-cli-family-pr" data-pr-state={row.pr.state}>PR #{row.pr.number} · {row.pr.state}</span>}
        <span className={cn("ml-auto shrink-0", tone === "needs" ? "text-yellow" : tone === "alert" ? "text-red" : "text-subtext-0")} data-testid="native-cli-family-state">{word}</span>
        <Chevron open={open} className="shrink-0 text-subtext-0" />
      </button>
      <button type="button" aria-label={`Open ${name}`} data-testid="native-cli-family-open" onClick={() => onOpen(row.sessionId)}
        className="shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.4rem] py-0.5 text-subtext-0 [border:0] hover:bg-surface-1 hover:text-fg">Open</button>
    </div>
    {onAct && row.role === "worker" && <RowActions row={row} name={name} onAct={onAct} unavailable={unavailable} onRefresh={onRefresh} />}
    {row.needsYou
      ? <p className="m-0 truncate pl-5 text-yellow" data-testid="native-cli-family-asks">Waiting for you · {row.needsYou.preview}</p>
      : latest && <p className="m-0 truncate pl-5 text-subtext-0" data-testid="native-cli-family-latest">{latest.direction === "to" ? (latest.kind === "steer" ? "You steered" : "You wrote") : "It wrote"} · {latest.preview}{note ? ` (${note})` : ""} · {ago(latest.at, now)}</p>}
    {row.report && <p className="m-0 truncate pl-5 text-subtext-0" data-testid="native-cli-family-report" data-source={row.report.source}>{reportLabel}: {row.report.text}</p>}
    {open && <dl className="m-0 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 py-1 pl-5 text-[0.8rem] [overflow-wrap:anywhere]" data-testid="native-cli-family-details">
      <dt className="text-subtext-0">Agent</dt><dd className="m-0">{row.provider}{row.dispatch ? ` · ${row.dispatch}` : ""}</dd>
      {row.previousRun && <><dt className="text-subtext-0">Run</dt><dd className="m-0">Started in an earlier conversation of this tab. It keeps running; the agent in this conversation cannot message, read or stop it. You can.</dd></>}
      {row.branch && <><dt className="text-subtext-0">Branch</dt><dd className="m-0">{row.branch}</dd></>}
      {row.pr && <><dt className="text-subtext-0">Pull request</dt><dd className="m-0"><a href={row.pr.url} target="_blank" rel="noreferrer noopener" className="text-fg underline" data-testid="native-cli-family-pr-link">#{row.pr.number} ({row.pr.state})</a><span className="text-subtext-0"> from your GitHub login, not verified by Perch</span></dd></>}
      {row.task && <><dt className="text-subtext-0">Task</dt><dd className="m-0 whitespace-pre-wrap">{row.task}</dd></>}
      {row.needsYou && <><dt className="text-yellow">Asks you</dt><dd className="m-0 whitespace-pre-wrap">{row.needsYou.preview}</dd></>}
      {latest && <><dt className="text-subtext-0">{latest.direction === "to" ? "You wrote" : "It wrote"}</dt><dd className="m-0 whitespace-pre-wrap">{latest.preview}{note && <span className="text-subtext-0"> ({note})</span>}</dd></>}
      {row.report && <><dt className="text-subtext-0">{reportLabel}</dt><dd className="m-0 whitespace-pre-wrap">{row.report.text}<span className="text-subtext-0"> ({row.report.source === "summary" ? "written from what it did, not verified" : "its own claim, not verified"})</span></dd></>}
      {!row.canMessage && <><dt className="text-subtext-0">Messages</dt><dd className="m-0">It cannot receive messages now</dd></>}
    </dl>}
  </li>;
}

/** The lead's family above the composer: one line per sub-session, newest traffic first. The core
 * gathered and ordered the rows (`crew.rs`; layout and fields follow Orca's `CrewRowView` and
 * `CrewRowDetails`, MIT, commit 308b5000, without Mention or a panel; the row's actions follow its
 * `CrewRowMenu`). A row's state, a
 * waiting question, the last message's receipt and the agent's own report are four separate lines,
 * never one status word. */
export function FamilyStrip({ rows, now = Date.now(), onOpen, onAct, unavailable, onRefresh }: { rows: readonly CrewRow[]; now?: number; onOpen: (sessionId: string) => void; onAct?: OnAct; unavailable?: string; onRefresh?: () => void }) {
  if (!rows.length) return null;
  return <div className="shrink-0 px-4 pb-1" data-testid="native-cli-family">
    <details open className={cn(CHAT_COLUMN, "rounded-soft bg-surface-0 px-3 py-1.5 text-[0.85rem] [&>summary]:cursor-pointer [&>summary]:select-none")}>
      <summary className="font-semibold">Sub-sessions <span className="font-normal text-subtext-0" data-testid="native-cli-family-headline">{headline(rows)}</span></summary>
      <ul aria-label="Sub-sessions" className="m-0 flex list-none flex-col gap-1 p-0 pt-1">
        {rows.map((row) => <Row key={row.sessionId} row={row} now={now} onOpen={onOpen} onAct={onAct} unavailable={unavailable} onRefresh={onRefresh} />)}
      </ul>
    </details>
  </div>;
}
