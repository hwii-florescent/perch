//! Navigator, the stock screen `stock:navigator`: the command palette (Cmd+P, or Ctrl+K outside a terminal, or the
//! leader chord). One search over the workspace's files, every session, the agents to start and `>` shell commands;
//! state chips filter the sessions. Perch opens it; or the person's package chosen for it
//! (`perch mod use stock:navigator <id>`) with the same props.
//!
//! The data and the actions are Perch's: sessions, the workspace's file search (`actions.searchFiles`, results in
//! `search`), the host's agents, and what a row does (`actions`: switch, open a file, a new terminal, start an agent,
//! run a command after its confirmation). Matching, order, keys (arrows and the `navigator.*` bindings, Enter, Escape;
//! never while an input method is composing) and the look are this screen's. A `>` command asks first with
//! `ConfirmDialog` from `@perch/sdk`, so a copy chosen for `stock:confirm` asks it.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:navigator` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside
//! it (docs/MOD-SDK.md).
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn, ConfirmDialog, SessionDot, shortcutFor, type AgentState, type NavigatorScreenProps, type NavigatorSession } from "@perch/sdk";

const ROW = "flex w-full cursor-pointer items-center gap-2 px-4 py-[0.45rem] text-left [font-family:inherit] text-[0.85rem] text-fg";
const row = (selected: boolean) => cn(ROW, selected ? "bg-surface-1" : "[background:none]");
const ROW_TITLE = "min-w-12 shrink overflow-hidden text-ellipsis whitespace-nowrap";
const ROW_CWD = "ml-auto min-w-0 shrink-[3] overflow-hidden text-ellipsis whitespace-nowrap text-[0.72rem] text-subtext-0";

type FilterChip = "all" | Exclude<AgentState, "unknown">;

const FILTER_CHIPS: { id: FilterChip; label: string }[] = [
  { id: "all", label: "All" },
  { id: "working", label: "Working" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
  { id: "idle", label: "Idle" },
];

function projectLabel(s: NavigatorSession): string {
  const host = s.hostId && s.hostId !== "local" ? `${s.hostId}:` : "";
  return `${host}${s.cwd}`;
}

export default function Navigator({ open, onClose, sessions, currentSessionId: sessionId, connected, workspace, supportsSearch, supportsRun, search: searchResult, agents, agentCwd: cwd, terminalCwd, actions }: NavigatorScreenProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterChip>("all");
  const [selected, setSelected] = useState(0);
  const [runTarget, setRunTarget] = useState<{ workspaceId: string; cwd: string; command: string } | null>(null);
  const [running, setRunning] = useState(false);
  const runPending = useRef(false);
  const [runError, setRunError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const runMode = query.trimStart().startsWith(">");
  const fileQuery = runMode ? "" : query.trim();
  const searchActive = open && connected && supportsSearch && !!workspace && filter === "all" && !!fileQuery;
  useEffect(() => {
    if (!searchActive || !workspace) return;
    const timer = setTimeout(() => actions.searchFiles(fileQuery), 180);
    return () => clearTimeout(timer);
  }, [searchActive, workspace?.id, fileQuery]);
  const matchingSearch = searchActive && searchResult?.query === fileQuery ? searchResult : undefined;
  const commands = useMemo(() => {
    if (runMode) {
      const command = query.trimStart().slice(1).trim();
      return command && connected && supportsRun && workspace ? [{
        id: "run", label: `Run ${command}`, detail: workspace.path,
        run: () => { setRunError(null); setRunTarget({ workspaceId: workspace.id, cwd: workspace.path, command }); },
      }] : [];
    }
    if (filter !== "all") return [];
    const files = matchingSearch?.state === "ready" && workspace ? matchingSearch.entries.slice(0, 50).map((file) => ({
      id: `file:${file.path}`, label: file.name, detail: file.path,
      run: () => actions.openFile(file.path),
    })) : [];
    const choices = [
      ...(connected && terminalCwd ? [{ id: "terminal", label: "New Terminal", detail: terminalCwd, run: actions.newTerminal }] : []),
      ...(connected && cwd ? agents.map((agent) => ({ id: agent.id, label: agent.label, detail: cwd, run: () => actions.startAgent(agent.id) })) : []),
      { id: "agents", label: "Manage agents", detail: "Installed and available to install", run: actions.manageAgents },
    ];
    const search = query.trim().toLowerCase();
    return [...files, ...choices.filter((choice) => !search || choice.label.toLowerCase().includes(search))];
  }, [agents, actions, connected, terminalCwd, cwd, filter, query, matchingSearch, workspace, runMode, supportsRun]);

  // Reset transient state every time the Navigator opens.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setFilter("all");
    setSelected(0);
    setRunError(null);
    setRunTarget(null);
    // Focus the search input once it's mounted.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (runMode) return [];
    return sessions
      .filter((s) => filter === "all" || s.state === filter)
      .filter((s) => !q || s.title.toLowerCase().includes(q) || s.cwd.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [sessions, filter, query, runMode]);

  // Clamp selection whenever the filtered row set shrinks/grows.
  useEffect(() => {
    setSelected((prev) => {
      if (rows.length + commands.length === 0) return 0;
      return Math.min(prev, rows.length + commands.length - 1);
    });
  }, [rows.length, commands.length]);

  // Keep the selected row scrolled into view.
  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
    row?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  useEffect(() => {
    if (!open || runTarget) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      // Arrows are native interaction. Optional home-row commands resolve Settings;
      // bare letters remain typeable in the always-focused search input.
      const commandShortcut = shortcutFor(e, "navigator");
      const down = e.key === "ArrowDown" || commandShortcut?.id === "navigator.next" || commandShortcut?.id === "navigator.nextAlt";
      const up = e.key === "ArrowUp" || commandShortcut?.id === "navigator.previous" || commandShortcut?.id === "navigator.previousAlt";
      if (down) {
        e.preventDefault();
        setSelected((prev) => (rows.length + commands.length === 0 ? 0 : (prev + 1) % (rows.length + commands.length)));
        return;
      }
      if (up) {
        e.preventDefault();
        setSelected((prev) => (rows.length + commands.length === 0 ? 0 : (prev - 1 + rows.length + commands.length) % (rows.length + commands.length)));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const command = commands[selected];
        if (command) { if (command.id !== "run") onClose(); command.run(); return; }
        const target = rows[selected - commands.length];
        if (target) {
          actions.switchTo(target.id);
          onClose();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, rows, commands, selected, actions, onClose, runTarget]);

  if (!open) return null;
  if (runTarget) return <ConfirmDialog
    message={`Run in a new terminal?\n\nHost: This computer\nFolder: ${runTarget.cwd}\n\n${runTarget.command}`}
    confirmLabel="Run" busy={running}
    onCancel={() => { setRunTarget(null); requestAnimationFrame(() => inputRef.current?.focus()); }}
    onConfirm={() => {
      if (runPending.current) return;
      runPending.current = true; setRunning(true);
      void actions.run(runTarget.workspaceId, runTarget.command).then(() => onClose(), (error: unknown) => { setRunError(error instanceof Error ? error.message : String(error)); }).finally(() => {
        runPending.current = false; setRunning(false); setRunTarget(null);
      });
    }}
  />;

  const modal = (
    <div className="fixed inset-0 z-[2000] flex items-start justify-center bg-[rgba(0,0,0,0.55)] pt-[12vh]" onClick={onClose}>
      <div
        className="flex w-[min(560px,calc(100vw_-_2rem))] max-h-[min(480px,calc(100dvh_-_16vh_-_2rem))] flex-col overflow-hidden rounded-ui bg-panel-bg shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
        role="dialog"
        aria-modal="true"
        aria-label="Navigator"
        data-testid="navigator"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          className="shrink-0 bg-surface-1 px-4 py-3 [font-family:inherit] text-[0.95rem] text-fg [outline:none]"
          data-testid="navigator-input"
          aria-label="Search files, sessions and commands"
          placeholder="Search files, sessions, agents… or > command"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="flex shrink-0 gap-[0.3rem] px-4 py-2">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={cn(
                "cursor-pointer rounded-ui bg-surface-1 px-[0.55rem] py-[0.15rem] [font-family:inherit] text-[0.72rem] text-subtext-0 [transition:color_0.12s_ease,background_0.12s_ease]",
                filter === chip.id && "bg-surface-0 text-accent",
              )}
              data-testid={`navigator-filter-${chip.id}`}
              onClick={() => setFilter(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto py-[0.3rem]" ref={listRef}>
          {runError && <p className="m-0 px-4 py-2 text-[0.78rem] text-red" role="alert">{runError}</p>}
          {runMode && <p className="m-0 px-4 py-2 text-[0.78rem] text-subtext-0" role="status">{!connected ? "Reconnect to run commands." : !workspace ? "Select a workspace first." : !supportsRun ? "Run needs an updated local core. Remote owned runs are not supported yet." : "Enter a shell command after >. You’ll confirm the host, folder and command before it starts in a new terminal."}</p>}
          {commands.map((command, index) => <button key={command.id} type="button"
            className={row(index === selected)}
            data-testid={`navigator-command-${command.id}`} data-selected={index === selected}
            onMouseEnter={() => setSelected(index)} onClick={() => { if (command.id !== "run") onClose(); command.run(); }}>
            <span className={ROW_TITLE}>{command.label}</span><span className={ROW_CWD}>{command.detail}</span>
          </button>)}
          {searchActive && (!matchingSearch || matchingSearch.state === "loading") && <p className="m-0 px-4 py-2 text-[0.78rem] text-subtext-0" role="status">Searching files…</p>}
          {matchingSearch?.state === "error" && <p className="m-0 px-4 py-2 text-[0.78rem] text-red" role="alert">{matchingSearch.error}</p>}
          {rows.length + commands.length === 0 && (!searchActive || matchingSearch?.state === "ready") && <div className="p-4 text-center text-[0.82rem] text-subtext-0">No matches</div>}
          {rows.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={row(i + commands.length === selected)}
              data-testid={`navigator-row-${s.id}`}
              data-selected={i + commands.length === selected}
              onMouseEnter={() => setSelected(i + commands.length)}
              onClick={() => {
                actions.switchTo(s.id);
                onClose();
              }}
            >
              <SessionDot id={s.id} />
              <span className={cn(ROW_TITLE, s.id === sessionId && "font-semibold")}>{s.title || "(untitled)"}</span>
              <span className={ROW_CWD}>{projectLabel(s)}</span>
            </button>
          ))}
        </div>
        {searchActive && <p className="m-0 shrink-0 px-4 py-2 text-[0.72rem] [overflow-wrap:anywhere] text-subtext-0" role="status">
          Files in {workspace?.path}. Skips VCS, dependency and build folders; not .gitignore.
          {(matchingSearch?.truncated || (matchingSearch?.entries.length ?? 0) > 50) && " Results limited; narrow your search."}
        </p>}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
