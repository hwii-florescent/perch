/**
 * Needs You: the top-row control and its anchored panel (UI-UX-DIRECTION §10).
 * Answers "what requires me right now?", then a collapsed Recent updates list.
 * Opened by a return (Welcome Back) it leads with what changed while you were
 * away. Facts come from the core (`attention.ts`); nothing here guesses.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AttentionEvent } from "@perch/shared";
import { usePerchStore } from "../store";
import { cn } from "../lib/cn";
import { AgentIcon } from "./AgentIcon";
import { Chevron } from "./ui/chevron";
import { GHOST_BUTTON } from "./ui/icon-button";
import { menuPanel } from "./ui/menu";
import {
  ago, certaintyNote, dismissAttention, needsYou, openAttention, openAttentionFile, openAttentionReview, openAttentionWorkspace,
  reasonLabel, recentUpdates, useAttention, welcomeLine, welcomeSummary,
} from "../attention";
import { sessionLabel } from "../workspaceTabs";

const ROW = "grid gap-0.5 rounded-ui px-2 py-1.5 hover:bg-surface-0";
// 44px touch targets on the phone (AGENTS.md).
const LINK = cn(GHOST_BUTTON, "px-1.5 py-0.5 text-[0.75rem] max-[700px]:min-h-11 max-[700px]:px-3");
const FINISHED = { glyph: "✓", color: "var(--subtext-0)", label: "Finished" };
const GLYPH: Record<string, typeof FINISHED> = {
  question: { glyph: "?", color: "var(--yellow)", label: "Waiting for you" },
  failed: { glyph: "!", color: "var(--red)", label: "Failed" },
  finished: FINISHED,
  exited: { glyph: "■", color: "var(--subtext-0)", label: "Exited" },
};

function Row({ event, now }: { event: AttentionEvent; now: number }) {
  const session = usePerchStore((s) => s.sessions.find((sess) => sess.id === event.sessionId));
  const workspace = usePerchStore((s) => s.workspaces.find((w) => w.id === event.workspaceId));
  const project = usePerchStore((s) => s.workspaceProjects.find((p) => p.id === (workspace?.projectId ?? event.projectId)));
  const glyph = GLYPH[event.kind] ?? FINISHED;
  const note = certaintyNote(event);
  const where = [project?.name, workspace && workspace.name !== project?.name ? workspace.name : null].filter(Boolean).join(" / ");
  const live = event.kind === "question" && event.certainty !== "unconfirmed";
  return (
    <li className={ROW} data-testid={`attention-row-${event.kind}`} data-session={event.sessionId}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="w-3 shrink-0 text-center text-[0.8rem] font-semibold" style={{ color: glyph.color }} aria-label={glyph.label} role="img">{glyph.glyph}</span>
        <span className="shrink-0 text-subtext-0"><AgentIcon provider={event.agentId || undefined} size={13} /></span>
        <span className="min-w-0 truncate text-[0.82rem] text-fg">{reasonLabel(event)}</span>
        <span className="ml-auto shrink-0 text-[0.72rem] text-subtext-0" title={new Date(event.occurredAt).toLocaleString()}>{ago(event.occurredAt, now)}</span>
      </div>
      <div className="flex min-w-0 items-center gap-1 pl-5 text-[0.75rem] text-subtext-0">
        <span className="min-w-0 shrink truncate">{session ? sessionLabel(session) : "Closed session"}</span>
        {where && (
          <button type="button" className={cn(GHOST_BUTTON, "min-w-0 shrink truncate px-1 text-[0.75rem]")} title={`Go to ${where}`} data-testid="attention-workspace" disabled={!event.workspaceId} onClick={() => openAttentionWorkspace(event)}>
            {where}
          </button>
        )}
        {!event.read && <span className="size-1.5 shrink-0 rounded-full bg-teal" aria-label="Unread" role="img" />}
      </div>
      {note && <div className="pl-5 text-[0.72rem] italic text-subtext-0">{note}</div>}
      {event.changedPathCount ? (
        <div className="flex min-w-0 flex-wrap items-center gap-x-1 pl-4 text-[0.72rem]">
          {(event.changedPaths ?? []).map((path) => (
            <button key={path} type="button" className={cn(LINK, "max-w-[12rem] truncate")} title={path} onClick={() => openAttentionFile(event, path)}>
              {path.split("/").pop()}
            </button>
          ))}
          {event.changedPathCount > (event.changedPaths?.length ?? 0) && (
            <span className="text-subtext-0">+{event.changedPathCount - (event.changedPaths?.length ?? 0)}</span>
          )}
        </div>
      ) : null}
      <div className="flex items-center gap-1 pl-4">
        {session && (
          <button type="button" className={cn(LINK, "text-fg")} data-testid="attention-open" onClick={() => openAttention(event)}>
            {event.kind === "question" ? "Answer" : "Open"}
          </button>
        )}
        {event.changedPathCount && event.workspaceId ? (
          <button type="button" className={LINK} data-testid="attention-review" onClick={() => openAttentionReview(event)}>
            Review {event.changedPathCount} {event.changedPathCount === 1 ? "file" : "files"}
          </button>
        ) : null}
        {!live && (
          <button type="button" className={cn(LINK, "ml-auto")} data-testid="attention-dismiss" onClick={() => dismissAttention([event.id])}>
            Dismiss
          </button>
        )}
      </div>
    </li>
  );
}

function Panel({ anchor, onClose }: { anchor: HTMLElement | null; onClose: () => void }) {
  const events = useAttention((s) => s.events);
  const welcome = useAttention((s) => s.welcome);
  const sessions = usePerchStore((s) => s.sessions);
  const hosts = usePerchStore((s) => s.hostStates);
  const [showRecent, setShowRecent] = useState(welcome !== null);
  const panel = useRef<HTMLDivElement>(null);
  // Snapshot the order while open: new events do not reorder rows under the pointer.
  const now = useMemo(() => Date.now(), [events]); // eslint-disable-line react-hooks/exhaustive-deps
  const actionable = needsYou(events);
  const recent = recentUpdates(events);
  const line = welcome ? welcomeLine(welcomeSummary(events, sessions, hosts, welcome.since)) : null;

  useEffect(() => {
    const down = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !anchor?.contains(target)) onClose();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onClose();
      anchor?.focus();
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key);
    };
  }, [anchor, onClose]);

  // Right-aligned under the bell, clamped inside the viewport (a phone's bell
  // sits near the middle of a narrow row).
  const rect = anchor?.getBoundingClientRect();
  const width = Math.min(416, window.innerWidth - 16);
  const left = Math.max(8, Math.min((rect?.right ?? window.innerWidth - 8) - width, window.innerWidth - width - 8));
  const style = { top: (rect?.bottom ?? 38) + 6, left, width };
  return createPortal(
    <div
      ref={panel}
      className={cn(menuPanel, "fixed z-[2050] flex max-h-[min(70vh,36rem)] flex-col px-1.5 py-1.5")}
      style={style}
      role="dialog"
      aria-label={welcome ? "Welcome back" : "Needs You"}
      data-testid="needs-you-panel"
    >
      {welcome && (
        <div className="px-2 pt-1 pb-2" data-testid="welcome-back">
          <div className="text-[0.85rem] font-semibold text-fg">Welcome back</div>
          <div className="text-[0.78rem] text-subtext-0">{line ?? "Nothing finished while you were away."}</div>
        </div>
      )}
      <div className="flex items-center px-2 pb-1">
        <span className="text-[0.78rem] font-semibold text-fg">Needs You</span>
        {actionable.length > 0 && <span className="ml-1.5 text-[0.75rem] text-subtext-0">{actionable.length}</span>}
      </div>
      <div className="min-h-0 overflow-y-auto">
        {actionable.length ? (
          <ul className="m-0 grid list-none gap-0.5 p-0" data-testid="needs-you-list">
            {actionable.map((event) => <Row key={event.id} event={event} now={now} />)}
          </ul>
        ) : (
          <p className="m-0 px-2 pb-2 text-[0.78rem] text-subtext-0" data-testid="needs-you-empty">No agent is waiting for you.</p>
        )}
        <div className="mt-1 border-t border-t-overlay-0 pt-1">
          <div className="flex items-center">
            <button
              type="button"
              className={cn(GHOST_BUTTON, "flex flex-1 items-center gap-1 px-2 py-1 text-left text-[0.78rem]")}
              aria-expanded={showRecent}
              data-testid="recent-updates-toggle"
              onClick={() => setShowRecent((v) => !v)}
            >
              <Chevron open={showRecent} />
              Recent updates
              {recent.length > 0 && <span className="text-subtext-0">{recent.length}</span>}
            </button>
            {showRecent && recent.length > 0 && (
              <button type="button" className={LINK} data-testid="recent-updates-clear" onClick={() => dismissAttention(recent.map((event) => event.id))}>
                Clear
              </button>
            )}
          </div>
          {showRecent && (recent.length ? (
            <ul className="m-0 grid list-none gap-0.5 p-0" data-testid="recent-updates-list">
              {recent.map((event) => <Row key={event.id} event={event} now={now} />)}
            </ul>
          ) : (
            <p className="m-0 px-2 py-1 text-[0.78rem] text-subtext-0">No recent updates.</p>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Top-row control: a count only when something needs you, a quiet dot for
 * unread updates, nothing at all when the host lacks `attention.v1`. */
export function NeedsYouButton({ className }: { className?: string }) {
  const supported = useAttention((s) => s.supported);
  const events = useAttention((s) => s.events);
  const open = useAttention((s) => s.open);
  const setOpen = useAttention((s) => s.setOpen);
  const button = useRef<HTMLButtonElement>(null);
  if (!supported) return null;
  const count = needsYou(events).length;
  const unread = recentUpdates(events).some((event) => !event.read);
  const label = count ? `Needs You: ${count}` : unread ? "Needs You: recent updates" : "Needs You";
  return (
    <>
      <button
        ref={button}
        type="button"
        className={cn(className, "relative gap-1", count > 0 && "text-yellow")}
        title={label}
        aria-label={label}
        aria-expanded={open}
        data-testid="needs-you-toggle"
        onClick={() => setOpen(!open)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
          <path d="M4 6.5a4 4 0 0 1 8 0c0 3 1.3 4.2 1.5 4.5h-11C2.7 10.7 4 9.5 4 6.5Z" />
          <path d="M6.5 13a1.6 1.6 0 0 0 3 0" />
        </svg>
        {count > 0 && <span className="text-[0.75rem] font-semibold" data-testid="needs-you-count">{count}</span>}
        {!count && unread && <span className="absolute top-[0.2rem] right-[0.3rem] size-1.5 rounded-full bg-teal" aria-hidden="true" data-testid="needs-you-unread" />}
      </button>
      {open && <Panel anchor={button.current} onClose={() => setOpen(false)} />}
    </>
  );
}
