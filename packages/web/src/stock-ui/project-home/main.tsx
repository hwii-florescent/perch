//! Project home, the stock screen `stock:project-home`: a Project's threads (the sub-sessions of its leads) grouped by
//! state, with the Project's Instructions and memory one click away. Opened as a tab from the sidebar's project menu
//! (`project.home`), or by the person's package chosen for it (`perch mod use stock:project-home <id>`), with the
//! same props.
//!
//! The core owns the groups (Needs you, Working, Ready for review, Landing, Idle, State unknown, Resolved) and the
//! words in them; a thread's state, its question and its report are separate records, never one status word. A
//! pull request is what the person's `gh` login reports, shown as GitHub's claim. This screen only draws what it is
//! given.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:project-home` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside
//! it (docs/MOD-SDK.md).
import { buttonClass as button, cn, type OverviewThread, type ProjectHomeProps } from "@perch/sdk";

const STATE: Record<string, string> = {
  working: "Working", idle: "Idle", done: "Finished its turn", blocked: "Waiting on you", exited: "Exited", unknown: "State unknown",
};

/** One thread's state in words from Perch's records: a pending question first, then the dispatch, then the lifecycle. */
export function stateWord({ row }: OverviewThread): string {
  if (row.needsYou) return "Waiting on you";
  if (row.dispatch === "stopped") return "Stopped";
  if (row.dispatch === "exited") return "Exited";
  if (row.dispatch === "start_unknown" || row.dispatch === "stop_unknown") return "State unknown";
  return STATE[row.lifecycle] ?? "State unknown";
}

function Thread({ thread, onOpen }: { thread: OverviewThread; onOpen: (sessionId: string) => void }) {
  const { row } = thread;
  const name = row.task || row.title || row.provider;
  const note = row.needsYou ? `Waiting for you · ${row.needsYou.preview}` : row.report ? `${row.report.source === "report" ? "Its report" : "Its last words"}: ${row.report.text}` : "";
  return <li className="flex min-w-0 flex-col gap-0.5 rounded-ui px-2 py-1 hover:bg-surface-1" data-testid="project-home-thread" data-session={row.sessionId}>
    <div className="flex min-w-0 items-center gap-2">
      <span className="min-w-0 truncate text-fg">{name}</span>
      {row.pr && <a href={row.pr.url} target="_blank" rel="noreferrer noopener" className="shrink-0 text-subtext-0 underline" data-testid="project-home-pr" data-pr-state={row.pr.state}>PR #{row.pr.number} · {row.pr.state}</a>}
      {row.branch && <span className="hidden shrink-0 text-subtext-0 min-[900px]:inline" data-testid="project-home-branch">{row.branch}</span>}
      <span className={cn("ml-auto shrink-0", row.needsYou ? "text-yellow" : "text-subtext-0")} data-testid="project-home-state">{stateWord(thread)}</span>
      <button type="button" aria-label={`Open ${name}`} className={button({ size: "sm" })} data-testid="project-home-open" onClick={() => onOpen(row.sessionId)}>Open</button>
    </div>
    {note && <p className="m-0 truncate text-[0.8rem] text-subtext-0" data-testid="project-home-note">{note}</p>}
  </li>;
}

export default function ProjectHome({ name, groups, error, onOpen, onInstructions, onMemory }: ProjectHomeProps) {
  const count = groups.reduce((sum, group) => sum + group.threads.length, 0);
  return <div className="flex h-full w-full min-h-0 flex-col gap-3 overflow-auto p-4 text-[0.9rem]" data-testid="project-home">
    <header className="flex flex-wrap items-center gap-2">
      <h2 className="m-0 mr-auto text-[1rem] font-semibold text-fg">{name}</h2>
      <button type="button" className={button({ size: "sm" })} data-testid="project-home-instructions" onClick={onInstructions}>Instructions…</button>
      <button type="button" className={button({ size: "sm" })} data-testid="project-home-memory" onClick={onMemory}>Memory…</button>
    </header>
    {error && <p className="m-0 text-yellow" role="status" data-testid="project-home-error">{error}</p>}
    {!error && count === 0 && <p className="m-0 text-subtext-0" data-testid="project-home-empty">No threads yet. When a lead starts sub-sessions, they appear here grouped by what needs you.</p>}
    {groups.map((group) => <section key={group.key} aria-label={group.label} data-testid="project-home-group" data-group={group.key}>
      <h3 className="m-0 mb-1 text-[0.8rem] font-semibold uppercase tracking-wide text-subtext-0">{group.label} <span className="font-normal">({group.threads.length})</span></h3>
      <ul className="m-0 flex list-none flex-col p-0">
        {group.threads.map((thread) => <Thread key={thread.row.sessionId} thread={thread} onOpen={onOpen} />)}
      </ul>
    </section>)}
  </div>;
}
