import { useRef, useState } from "react";
import { cn } from "../lib/cn";
import { DockviewShell } from "../dockview/DockviewShell";
import { usePerchStore } from "../store";
import { fileTabKey, useFileTabs, type FileTab } from "../fileTabs";
import { MIN_PANE_PX, useSplitSets, visibleSplit } from "../splitSets";
import { workspaceTabs } from "../workspaceTabs";
import { WorkspaceFilesView } from "./WorkspaceFiles";
import { WorkspaceGitReviewPane } from "./WorkspaceGitReviewPane";

const STEP = 0.02;

/**
 * The canvas under the one tab strip. Normally the session's Dockview fills it
 * and an open file or review covers it. When the active tab belongs to a split
 * set, the set's members share the width instead, side by side, with
 * draggable dividers. The strip is untouched: every member stays an ordinary
 * tab, and only this area splits.
 *
 * The Dockview stays mounted at one place in the tree (a terminal must never
 * be rebuilt for a layout change); it is only resized, and only while its
 * session is in the set.
 */
export function SplitCanvas() {
  const sessions = usePerchStore((s) => s.sessions);
  const sessionId = usePerchStore((s) => s.sessionId);
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const activeProject = usePerchStore((s) => s.activeProject);
  const activeWorkspaceId = usePerchStore((s) => s.activeWorkspaceId);
  const workspaces = usePerchStore((s) => s.workspaces);
  const fileTabs = useFileTabs((s) => s.tabs);
  const activeKey = useFileTabs((s) => s.active);
  const sets = useSplitSets((s) => s.sets);
  const resize = useSplitSets((s) => s.resize);
  const hostRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<number[] | null>(null);

  const entries = workspaceTabs({ sessions, sessionId, activeHostId, activeProject, activeWorkspaceId, workspaces }, fileTabs);
  const resources = new Map(entries.flatMap((entry) => entry.kind === "resource" ? [[entry.id, entry.tab] as const] : []));
  const fileShown = activeKey !== null && resources.has(activeKey);
  const activeId = fileShown ? activeKey : sessionId;
  // The Dockview shows the current session only: another session's tab is not a visible member.
  const available = entries.filter((entry) => entry.kind === "resource" || entry.id === sessionId).map((entry) => entry.id);
  const split = visibleSplit(sets, available, activeId);
  const sizes = live && split && live.length === split.ids.length ? live : split?.sizes ?? [];
  const lefts = sizes.map((_, i) => sizes.slice(0, i).reduce((sum, size) => sum + size, 0));

  const slot = (id: string): { left: string; width: string } | undefined => {
    const i = split?.ids.indexOf(id) ?? -1;
    return i < 0 ? undefined : { left: `${lefts[i]! * 100}%`, width: `${sizes[i]! * 100}%` };
  };

  const focusSession = () => { if (useFileTabs.getState().active) useFileTabs.getState().showSession(); };
  const focusResource = (tab: FileTab) => { if (fileTabKey(tab) !== useFileTabs.getState().active) useFileTabs.getState().open(tab.workspaceId, tab.path, tab.kind); };

  // Which resource panes to mount: the set's resource members, else the one open file or review.
  const panes = [...resources].filter(([id]) => (split ? split.ids.includes(id) : id === activeKey && fileShown));

  const dragDivider = (i: number, e: React.PointerEvent<HTMLDivElement>) => {
    const host = hostRef.current;
    if (!host || !split) return;
    e.preventDefault();
    const rect = host.getBoundingClientRect();
    const min = MIN_PANE_PX / rect.width;
    const start = sizes.slice();
    const from = lefts[i]!;
    const to = lefts[i + 1]! + start[i + 1]!;
    let latest = start;
    const move = (ev: PointerEvent) => {
      const boundary = Math.min(to - min, Math.max(from + min, (ev.clientX - rect.left) / rect.width));
      latest = start.slice();
      latest[i] = boundary - from;
      latest[i + 1] = to - boundary;
      setLive(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setLive(null);
      resize(split.ids, latest);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const nudgeDivider = (i: number, e: React.KeyboardEvent) => {
    if (!split || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" ? STEP : -STEP;
    const min = MIN_PANE_PX / (hostRef.current?.getBoundingClientRect().width || 1);
    const next = sizes.slice();
    const a = Math.max(min, next[i]! + delta);
    const b = next[i]! + next[i + 1]! - a;
    if (b < min) return;
    next[i] = a;
    next[i + 1] = b;
    resize(split.ids, next);
  };

  const dock = slot(sessionId ?? "");
  // A thin rule marks the focused pane, only while panes are shared.
  const focusBar = (on: boolean) => on && split
    ? <div className="pointer-events-none absolute top-0 right-0 left-0 z-20 h-[2px] bg-overlay-1" data-testid="split-focus-bar" />
    : null;

  return (
    <div ref={hostRef} className="absolute inset-0" data-testid="split-canvas" data-split={split ? split.ids.length : 0}>
      <div
        className={cn("absolute top-0 bottom-0", !dock && "inset-0")}
        style={dock}
        data-testid="split-pane-session"
        onMouseDownCapture={focusSession}
      >
        <DockviewShell />
        {focusBar(!fileShown)}
      </div>
      {panes.map(([id, tab]) => (
        <div
          key={id}
          className={cn("absolute top-0 bottom-0 z-10 flex bg-panel-bg", !split && "inset-0")}
          style={slot(id)}
          data-testid={tab.kind === "review" ? "split-pane-review" : `split-pane-file-${tab.path}`}
          onMouseDownCapture={() => focusResource(tab)}
        >
          {tab.kind === "review" ? (
            <WorkspaceGitReviewPane workspaceId={tab.workspaceId} />
          ) : (
            <WorkspaceFilesView layout="editor" workspaceId={tab.workspaceId} initialPath={tab.path} />
          )}
          {focusBar(id === activeKey)}
        </div>
      ))}
      {split && sizes.slice(0, -1).map((_, i) => (
        <div
          key={split.ids[i + 1]}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize split panes"
          aria-valuenow={Math.round((lefts[i]! + sizes[i]!) * 100)}
          tabIndex={0}
          data-testid={`split-divider-${i}`}
          className="absolute top-0 bottom-0 z-30 w-[5px] cursor-col-resize bg-transparent hover:bg-accent focus-visible:bg-accent"
          style={{ left: `calc(${(lefts[i]! + sizes[i]!) * 100}% - 2px)` }}
          onPointerDown={(e) => dragDivider(i, e)}
          onKeyDown={(e) => nudgeDivider(i, e)}
        />
      ))}
    </div>
  );
}
