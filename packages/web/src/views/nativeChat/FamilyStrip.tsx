import { useState } from "react";
import type { CrewRow } from "@perch/shared";
import { cn } from "../../lib/cn";
import { CHAT_COLUMN } from "../../components/ui/chat";
import { Chevron } from "../../components/ui/chevron";

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
    case "delivered": return "";
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
    [workers.filter((row) => row.report?.source === "report").length, "reported"],
  ].filter(([count]) => Number(count) > 0).map(([count, word]) => `${count} ${word}`);
  return parts.length ? parts.join(" · ") : `${rows.length} in this run`;
}

const DOT = { working: "bg-fg animate-pulse motion-reduce:animate-none", needs: "bg-yellow", quiet: "bg-subtext-0 opacity-60", alert: "bg-red" };
const ROLE: Record<string, string> = { manager: "Lead", worker: "", peer: "Peer" };

function Row({ row, now, onOpen }: { row: CrewRow; now: number; onOpen: (sessionId: string) => void }) {
  const [open, setOpen] = useState(false);
  const { word, tone } = stateOf(row);
  const name = row.role === "worker" && row.task ? row.task : row.title || row.provider;
  const latest = row.latest;
  const note = latest ? receiptNote(latest) : "";
  const reportLabel = row.report?.source === "report" ? "Reported" : "Last message, not a report";
  return <li className="flex min-w-0 flex-col" data-testid="native-cli-family-row" data-session={row.sessionId} data-role={row.role} data-lifecycle={row.lifecycle} data-tone={tone}>
    <div className="flex min-w-0 items-center gap-2">
      <button type="button" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} details of ${name}`} onClick={() => setOpen(!open)}
        className="flex min-h-6 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-ui bg-transparent px-[0.4rem] text-left text-fg [border:0] hover:bg-surface-1">
        <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", DOT[tone])} />
        <span className="min-w-0 truncate">{ROLE[row.role] ? <span className="text-subtext-0">{ROLE[row.role]} · </span> : null}{name}</span>
        <span className={cn("ml-auto shrink-0", tone === "needs" ? "text-yellow" : tone === "alert" ? "text-red" : "text-subtext-0")} data-testid="native-cli-family-state">{word}</span>
        <Chevron open={open} className="shrink-0 text-subtext-0" />
      </button>
      <button type="button" aria-label={`Open ${name}`} data-testid="native-cli-family-open" onClick={() => onOpen(row.sessionId)}
        className="shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.4rem] py-0.5 text-subtext-0 [border:0] hover:bg-surface-1 hover:text-fg">Open</button>
    </div>
    {row.needsYou
      ? <p className="m-0 truncate pl-5 text-yellow" data-testid="native-cli-family-asks">Waiting for you · {row.needsYou.preview}</p>
      : latest && <p className="m-0 truncate pl-5 text-subtext-0" data-testid="native-cli-family-latest">{latest.direction === "to" ? "You wrote" : "It wrote"} · {latest.preview}{note ? ` (${note})` : ""} · {ago(latest.at, now)}</p>}
    {row.report && <p className="m-0 truncate pl-5 text-subtext-0" data-testid="native-cli-family-report" data-source={row.report.source}>{reportLabel}: {row.report.text}</p>}
    {open && <dl className="m-0 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 py-1 pl-5 text-[0.8rem] [overflow-wrap:anywhere]" data-testid="native-cli-family-details">
      <dt className="text-subtext-0">Agent</dt><dd className="m-0">{row.provider}{row.dispatch ? ` · ${row.dispatch}` : ""}</dd>
      {row.task && <><dt className="text-subtext-0">Task</dt><dd className="m-0 whitespace-pre-wrap">{row.task}</dd></>}
      {row.needsYou && <><dt className="text-yellow">Asks you</dt><dd className="m-0 whitespace-pre-wrap">{row.needsYou.preview}</dd></>}
      {latest && <><dt className="text-subtext-0">{latest.direction === "to" ? "You wrote" : "It wrote"}</dt><dd className="m-0 whitespace-pre-wrap">{latest.preview}{note && <span className="text-subtext-0"> ({note})</span>}</dd></>}
      {row.report && <><dt className="text-subtext-0">{reportLabel}</dt><dd className="m-0 whitespace-pre-wrap">{row.report.text}<span className="text-subtext-0"> (its own claim, not verified)</span></dd></>}
      {!row.canMessage && <><dt className="text-subtext-0">Messages</dt><dd className="m-0">It cannot receive messages now</dd></>}
    </dl>}
  </li>;
}

/** The lead's family above the composer: one line per sub-session, newest traffic first. The core
 * gathered and ordered the rows (`crew.rs`; layout and fields follow Orca's `CrewRowView` and
 * `CrewRowDetails`, MIT, commit 308b5000, without Mention, its menu or a panel). A row's state, a
 * waiting question, the last message's receipt and the agent's own report are four separate lines,
 * never one status word. */
export function FamilyStrip({ rows, now = Date.now(), onOpen }: { rows: readonly CrewRow[]; now?: number; onOpen: (sessionId: string) => void }) {
  if (!rows.length) return null;
  return <div className="shrink-0 px-4 pb-1" data-testid="native-cli-family">
    <details open className={cn(CHAT_COLUMN, "rounded-soft bg-surface-0 px-3 py-1.5 text-[0.85rem] [&>summary]:cursor-pointer [&>summary]:select-none")}>
      <summary className="font-semibold">Sub-sessions <span className="font-normal text-subtext-0" data-testid="native-cli-family-headline">{headline(rows)}</span></summary>
      <ul aria-label="Sub-sessions" className="m-0 flex list-none flex-col gap-1 p-0 pt-1">
        {rows.map((row) => <Row key={row.sessionId} row={row} now={now} onOpen={onOpen} />)}
      </ul>
    </details>
  </div>;
}
