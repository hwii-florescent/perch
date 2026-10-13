import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { DockviewShell } from "../dockview/DockviewShell";
import { ChatView } from "../views/Chat";
import { effectiveWorkspace, usePerchStore } from "../store";
import { fileTabKey, restoreSelection, useFileTabs, type FileTab } from "../fileTabs";
import { layout, MIN_PANE_PX, useSplitSets, visibleSplit, type Strip } from "../splitSets";
import { acquirePassthrough } from "../browserNative";
import { activateTab, entryLabel, workspaceTabs } from "../workspaceTabs";
import { closeTab, exitSplit } from "../tiledPanes";
import { GHOST_BUTTON } from "./ui/icon-button";
import { useTabOrderVersion } from "../tabOrder";
import { WorkspaceBrowser } from "./WorkspaceBrowser";
import { WorkspaceFilesView } from "./WorkspaceFiles";
import { WorkspaceGitReviewPane } from "./WorkspaceGitReviewPane";

const STEP = 0.02;

/**
 * The canvas under the one tab strip. Normally the session's Dockview fills it
 * and an open file or review covers it. When the active tab belongs to a split
 * set, the set's members share the canvas instead, side by side or stacked
 * (`set.dir`), with draggable dividers. Any tabs share a set, several
 * terminals included: each has a stable session-bound ChatView. Focusing a
 * tile must not move its xterm between a plain pane and Dockview (that created
 * duplicate PTY attachments and renderer churn on every focus change).
 * Every visible pane is marked `data-pane-id` for the tab drag (`tabDrag.ts`),
 * which splits a pane by a tab dropped on one of its sides. The strip is untouched: every member stays an ordinary
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
  const zoomedId = useSplitSets((s) => s.zoomedId);
  const settingsOpen = usePerchStore((s) => s.settingsOpen);
  const shownWorkspaceId = usePerchStore((s) => effectiveWorkspace(s)?.id ?? null);
  const hostRef = useRef<HTMLDivElement>(null);
  // A saved drag order changes the panes' order: re-render for it.
  useTabOrderVersion();
  const [live, setLive] = useState<{ path: number[]; sizes: number[] } | null>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => setBox({ width: host.clientWidth, height: host.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const entries = workspaceTabs({ sessions, sessionId, activeHostId, activeProject, activeWorkspaceId, workspaces }, fileTabs);
  const resources = new Map(entries.flatMap((entry) => entry.kind === "resource" ? [[entry.id, entry.tab] as const] : []));
  const fileShown = activeKey !== null && resources.has(activeKey);
  const activeId = fileShown ? activeKey : sessionId;
  const editorShown = fileShown && !resources.get(activeKey)?.kind;
  // File tabs can finish loading after activation; focus the editor, not its
  // search field. Session inputs are focused by Dockview after layout restore.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !editorShown || !activeKey || settingsOpen) return;
    let frame = 0;
    const focus = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // A file previewed from the explorer with the keyboard (Space) leaves focus in the list.
        if (document.activeElement?.closest('[data-explorer-keynav="true"]')) return;
        const pane = [...host.querySelectorAll<HTMLElement>("[data-tab-id]")].find((element) => element.dataset.tabId === activeKey);
        const editor = pane?.querySelector<HTMLElement>('[data-testid="workspace-file-editor"]');
        if (!editor) return;
        editor.focus({ preventScroll: true });
        observer.disconnect();
      });
    };
    const observer = new MutationObserver(focus);
    observer.observe(host, { childList: true, subtree: true });
    focus();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [activeKey, editorShown, settingsOpen]);
  const split = visibleSplit(sets, entries.map((entry) => entry.id), activeId);
  const tiledSessions = entries.flatMap((entry) => (entry.kind === "session" && split?.ids.includes(entry.id) ? [entry] : []));
  const zoomed = split?.ids.includes(zoomedId ?? "") && zoomedId === activeId ? zoomedId : null;
  const tileVisible = (id: string) => !zoomed || zoomed === id;
  // Shared rounded edges: no gaps, and no half-pixel canvas compositing.
  const placed = split ? layout(split.tree, { x: 0, y: 0, w: box.width, h: box.height }, { round: true, live }) : null;
  const slot = (id: string) => {
    const r = placed?.panes.get(id);
    if (!r) return undefined;
    if (zoomed) return tileVisible(id) ? { inset: 0 } : { display: "none" };
    return { left: r.x, top: r.y, width: r.w, height: r.h };
  };
  const dividers = placed?.strips.flatMap((strip) => strip.edges.map((edge, i) => ({ strip, i, edge }))) ?? [];

  // Coming back to a project: its selected file or review returns. The session the
  // navigation lands on can arrive after the workspace does (the server confirms it),
  // so this also runs when the session changes, but only when it comes from another
  // workspace's: a click on a session of the same workspace shows that session.
  const previousSession = useRef<string | null>(null);
  useEffect(() => {
    const belongs = (id: string | null) => usePerchStore.getState().sessions.find((session) => session.id === id)?.workspaceId === shownWorkspaceId;
    if (shownWorkspaceId && !belongs(previousSession.current)) restoreSelection(shownWorkspaceId);
    previousSession.current = sessionId;
  }, [shownWorkspaceId, sessionId]);

  // A split set shows its terminal beside the file: if another session is current, bring the set's up.
  const activeSet = fileShown ? sets.find((set) => set.ids.includes(activeKey)) : undefined;
  const partner = activeSet?.ids.includes(sessionId ?? "") ? undefined : activeSet?.ids.find((id) => id !== activeKey && entries.some((entry) => entry.id === id && entry.kind === "session"));
  useEffect(() => {
    const entry = entries.find((candidate) => candidate.id === activeKey);
    if (partner && partner !== sessionId && entry) activateTab(entry);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `entries` is rebuilt each render
  }, [partner, sessionId, activeKey]);

  // A pane is also activated by keyboard focus (while panes are shared); both guard against redundant activation.
  const focusSession = () => { if (useFileTabs.getState().active) useFileTabs.getState().showSession(); };
  const focusResource = (tab: FileTab) => { if (fileTabKey(tab) !== useFileTabs.getState().active) useFileTabs.getState().open(tab.workspaceId, tab.path, tab.kind); };

  // Which resource panes to mount: the set's resource members, else the one open file or review.
  const panes = [...resources].filter(([id]) => (split ? split.ids.includes(id) : id === activeKey && fileShown));

  /** The pane sizes of `strip` with its divider `i` moved to the fraction `at` of the strip. */
  const moved = (strip: Strip, i: number, at: number) => {
    const length = strip.dir === "col" ? strip.rect.h : strip.rect.w;
    const min = MIN_PANE_PX / (length || 1);
    const from = strip.sizes.slice(0, i).reduce((sum, size) => sum + size, 0);
    const to = from + strip.sizes[i]! + strip.sizes[i + 1]!;
    if (to - from < 2 * min) return null;
    const edge = Math.min(to - min, Math.max(from + min, at));
    const next = strip.sizes.slice();
    next[i] = edge - from;
    next[i + 1] = to - edge;
    return next;
  };

  const dragDivider = (strip: Strip, i: number, e: React.PointerEvent<HTMLDivElement>) => {
    const host = hostRef.current;
    if (!host || !split) return;
    e.preventDefault();
    const rect = host.getBoundingClientRect();
    const col = strip.dir === "col";
    const [origin, length] = col ? [strip.rect.y, strip.rect.h] : [strip.rect.x, strip.rect.w];
    // A native browser page would swallow the drag over it.
    const release = acquirePassthrough();
    let latest: number[] | null = null;
    const move = (ev: PointerEvent) => {
      const next = moved(strip, i, ((col ? ev.clientY - rect.top : ev.clientX - rect.left) - origin) / (length || 1));
      if (!next) return;
      latest = next;
      setLive({ path: strip.path, sizes: next });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      release();
      setLive(null);
      if (latest) resize(split.ids, latest, strip.path);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const nudgeDivider = (strip: Strip, i: number, e: React.KeyboardEvent) => {
    const [less, more] = strip.dir === "col" ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
    if (!split || (e.key !== less && e.key !== more)) return;
    e.preventDefault();
    const at = strip.sizes.slice(0, i + 1).reduce((sum, size) => sum + size, 0) + (e.key === more ? STEP : -STEP);
    const next = moved(strip, i, at);
    if (next) resize(split.ids, next, strip.path);
  };

  // Dockview retains the session layout underneath, but not a second primary terminal.
  const primaryHidden = !!split;
  useEffect(() => {
    if (!split || !activeId || settingsOpen) return;
    const host = hostRef.current;
    if (!host) return;
    let frame = 0;
    const focus = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const pane = [...host.querySelectorAll<HTMLElement>("[data-pane-id]")].find((el) => el.dataset.paneId === activeId);
        const input = pane?.querySelector<HTMLElement>(".xterm-helper-textarea, textarea");
        if (input) { input.focus({ preventScroll: true }); observer.disconnect(); }
      });
    };
    const observer = new MutationObserver(focus);
    observer.observe(host, { childList: true, subtree: true });
    focus();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [activeId, primaryHidden, settingsOpen]);
  // A thin rule marks the focused pane, only while panes are shared.
  const focusBar = (on: boolean) => on && split
    ? <div className="pointer-events-none absolute top-0 right-0 left-0 z-20 h-[2px] bg-overlay-1" data-testid="split-focus-bar" />
    : null;

  return (
    <div ref={hostRef} className="absolute inset-0" data-testid="split-canvas" data-split={split ? split.ids.length : 0}>
      <div
        className={cn("absolute inset-0", primaryHidden && "hidden")}
        data-testid={primaryHidden ? "split-dock-parked" : "split-pane-session"}
        data-pane-id={primaryHidden ? undefined : sessionId ?? undefined}
        data-pane-visible={!primaryHidden && !fileShown}
        onMouseDownCapture={focusSession}
        onFocusCapture={split ? focusSession : undefined}
      >
        <DockviewShell primaryHidden={primaryHidden} />
        {focusBar(!fileShown)}
      </div>
      {tiledSessions.map((entry) => (
        <div
          key={entry.id}
          className="absolute z-10 flex min-h-0 min-w-0 flex-col bg-panel-bg"
          style={slot(entry.id)}
          data-testid={entry.id === sessionId ? "split-pane-session" : `split-pane-session-${entry.id}`}
          data-pane-id={entry.id}
          data-pane-visible={tileVisible(entry.id)}
          onMouseDownCapture={() => { if (activeId !== entry.id) activateTab(entry); }}
          onFocusCapture={() => { if (activeId !== entry.id) activateTab(entry); }}
        >
          <ChatView sessionId={entry.id} />
          {focusBar(entry.id === activeId)}
        </div>
      ))}
      {panes.map(([id, tab]) => (
        <div
          key={id}
          className={cn("absolute z-10 flex bg-panel-bg", !split && "inset-0")}
          style={slot(id)}
          data-pane-id={id}
          data-pane-visible={tileVisible(id)}
          data-testid={tab.kind === "review" ? "split-pane-review" : tab.kind === "browser" ? "split-pane-browser" : `split-pane-file-${tab.path}`}
          data-tab-id={id}
          onMouseDownCapture={() => focusResource(tab)}
          onFocusCapture={split ? () => focusResource(tab) : undefined}
        >
          {tab.kind === "review" ? (
            <WorkspaceGitReviewPane workspaceId={tab.workspaceId} />
          ) : tab.kind === "browser" ? (
            <WorkspaceBrowser tabId={id} initialUrl={tab.path} />
          ) : (
            <WorkspaceFilesView layout="editor" workspaceId={tab.workspaceId} initialPath={tab.path} />
          )}
          {focusBar(id === activeKey)}
        </div>
      ))}
      {split && entries.filter((entry) => split.ids.includes(entry.id) && tileVisible(entry.id)).map((entry) => (
        <div key={`controls-${entry.id}`} className="pointer-events-none absolute z-40" style={slot(entry.id)}>
          <div className="pointer-events-auto absolute top-1 right-1 flex gap-1 rounded-ui bg-panel-bg" data-testid={`tile-controls-${entry.id}`}>
            <button type="button" className={cn(GHOST_BUTTON, "flex h-7 w-7 items-center justify-center p-0 text-fg")} title="Exit split — show this tab full size" aria-label={`Exit split for ${entryLabel(entry)}`} data-testid={`tile-expand-${entry.id}`} onClick={() => exitSplit(entry.id)}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M6 2H2v4m8-4h4v4M2 10v4h4m8-4v4h-4" /></svg>
            </button>
            <button type="button" className={cn(GHOST_BUTTON, "flex h-7 w-7 items-center justify-center p-0 text-fg")} title="Close this tab" aria-label={`Close ${entryLabel(entry)}`} data-testid={`tile-close-${entry.id}`} onClick={() => closeTab(entry.id)}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" /></svg>
            </button>
          </div>
        </div>
      ))}
      {split && !zoomed && dividers.map(({ strip, i, edge }, n) => {
        const col = strip.dir === "col";
        return (
          <div
            key={`${strip.path.join(".")}/${i}`}
            role="separator"
            aria-orientation={col ? "horizontal" : "vertical"}
            aria-label="Resize split panes"
            aria-valuenow={Math.round(strip.sizes.slice(0, i + 1).reduce((sum, size) => sum + size, 0) * 100)}
            tabIndex={0}
            data-testid={`split-divider-${n}`}
            className={cn("absolute z-30 bg-transparent hover:bg-accent focus-visible:bg-accent", col ? "h-[5px] cursor-row-resize" : "w-[5px] cursor-col-resize")}
            style={col ? { top: edge - 2, left: strip.rect.x, width: strip.rect.w } : { left: edge - 2, top: strip.rect.y, height: strip.rect.h }}
            onPointerDown={(e) => dragDivider(strip, i, e)}
            onKeyDown={(e) => nudgeDivider(strip, i, e)}
          />
        );
      })}
    </div>
  );
}
