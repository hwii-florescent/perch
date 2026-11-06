import { useEffect, useState } from "react";
import type { AgentTurnSummary, GitDiffFile } from "@perch/shared";
import { socket } from "../../ws";
import { newId } from "../../ids";
import { cn } from "../../lib/cn";
import { withHost } from "./useLastTurnChanges";

const MAX_LINES = 200;

type Loaded = { files: GitDiffFile[] } | { error: string };

/** One file's change in this turn, fetched when its row is opened. */
function FileDiff({ workspaceId, hostId, turn, path }: { workspaceId: string; hostId: string; turn: AgentTurnSummary; path: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    const requestId = newId();
    let done = false;
    const stop = socket.onMessage((message) => {
      if (done || !("requestId" in message) || message.requestId !== requestId) return;
      done = true;
      setLoaded(message.type === "git.diff.result" ? { files: message.files } : { error: "This change could not be loaded." });
    });
    socket.send(withHost({ type: "git.diff", requestId, workspaceId, target: { kind: "compare", base: turn.beforeRef, ...(turn.afterRef ? { head: turn.afterRef } : {}) }, path }, hostId));
    return () => { done = true; stop(); };
  }, [workspaceId, hostId, turn.beforeRef, turn.afterRef, path]);
  if (!loaded) return <p className="m-0 text-[12px] text-subtext-0">Loading…</p>;
  if ("error" in loaded) return <p className="m-0 text-[12px] text-red" role="alert">{loaded.error}</p>;
  const lines = loaded.files.flatMap((file) => file.isBinary ? [{ kind: "context" as const, content: "Binary file" }] : file.hunks.flatMap((hunk) => [{ kind: "context" as const, content: hunk.header }, ...hunk.lines]));
  if (!lines.length) return <p className="m-0 text-[12px] text-subtext-0">No textual change.</p>;
  return <pre className="m-0 max-h-72 overflow-auto rounded-ui bg-surface-0 p-2 text-[0.78rem] whitespace-pre-wrap [overflow-wrap:anywhere]" data-testid="native-cli-turn-diff">
    {lines.slice(0, MAX_LINES).map((line, index) => <span key={index} className={cn("block", line.kind === "addition" && "text-green", line.kind === "deletion" && "text-red", line.kind === "context" && "text-subtext-0")}>{line.kind === "addition" ? "+" : line.kind === "deletion" ? "-" : " "}{line.content}</span>)}
    {lines.length > MAX_LINES && <span className="block text-subtext-0">… {lines.length - MAX_LINES} more lines. Open the Git view for the full diff.</span>}
  </pre>;
}

/** What the agent changed in its last turn: the files, each opening to its diff. */
export function ChangedFiles({ turn, workspaceId, hostId }: { turn: AgentTurnSummary; workspaceId: string; hostId: string }) {
  const total = turn.changedPathCount ?? turn.changedPaths.length;
  // A diff is fetched only for a row the user opens, never for every file at once.
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  return <section className="flex flex-col gap-1 rounded-ui border border-overlay-0 bg-panel-bg p-2 text-[0.85rem]" aria-label="Files changed this turn" data-testid="native-cli-changed-files">
    <strong className="font-semibold">Changed {total} {total === 1 ? "file" : "files"}</strong>
    {turn.changedPaths.map((path) => <details key={path} className="[&_summary]:cursor-pointer" onToggle={(event) => { if (event.currentTarget.open) setOpened((before) => new Set(before).add(path)); }}>
      <summary className="truncate" title={path}>{path}</summary>
      {opened.has(path) && <FileDiff workspaceId={workspaceId} hostId={hostId} turn={turn} path={path} />}
    </details>)}
    {total > turn.changedPaths.length && <span className="text-[12px] text-subtext-0">and {total - turn.changedPaths.length} more in the Git view</span>}
  </section>;
}
