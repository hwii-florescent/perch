/**
 * Navigator.tsx — Phase 4 (Keybindings + Navigator) fuzzy-finder over
 * sessions[]. Opened via `Ctrl/Cmd+K` or the leader chord `Ctrl+Space, g`
 * (see `../keybinds.ts`).
 *
 * Portal-rendered into `document.body` (same pattern as `ModelChip`'s
 * popover) so it always sits above dockview/xterm regardless of ancestor
 * stacking contexts. Unlike `ModelChip`'s popover (anchored to a trigger
 * element), this is a viewport-centered modal — closer to `SettingsModal`'s
 * backdrop+panel structure, just portal-rendered instead of rendered inline.
 *
 * Search matches session title or cwd (case-insensitive substring — a full
 * fuzzy-match scorer is more machinery than a personal single-user tool
 * needs). State-filter chips (all/working/blocked/done/idle) are mouse-only
 * — see keybinds.ts's module doc for why single-letter shortcuts for these
 * were dropped (they would collide with normal typing in the search input,
 * which is always focused while the Navigator is open).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { effectiveWorkspace, usePerchStore } from "../store";
import { useWorkspaceFilesStore } from "../filesystemStore";
import { useFileTabs } from "../fileTabs";
import { cn } from "../lib/cn";
import { StatusDot } from "./StatusDot";
import { sessionDotState, type AgentDotState } from "../statusDot";
import type { SessionSummary } from "@perch/shared";
import { splitActiveTab } from "../tiledPanes";
import { shortcutFor } from "../keybinds";
import { ConfirmDialog } from "./ConfirmDialog";
import { runInWorkspace } from "../runs";

const ROW = "flex w-full cursor-pointer items-center gap-2 px-4 py-[0.45rem] text-left [font-family:inherit] text-[0.85rem] text-fg";
const row = (selected: boolean) => cn(ROW, selected ? "bg-surface-1" : "[background:none]");
const ROW_TITLE = "min-w-12 shrink overflow-hidden text-ellipsis whitespace-nowrap";
const ROW_CWD = "ml-auto min-w-0 shrink-[3] overflow-hidden text-ellipsis whitespace-nowrap text-[0.72rem] text-subtext-0";

export interface NavigatorProps {
  open: boolean;
  onClose: () => void;
}

type FilterChip = "all" | AgentDotState;

const FILTER_CHIPS: { id: FilterChip; label: string }[] = [
  { id: "all", label: "All" },
  { id: "working", label: "Working" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
  { id: "idle", label: "Idle" },
];

function projectLabel(s: SessionSummary): string {
  const host = s.hostId && s.hostId !== "local" ? `${s.hostId}:` : "";
  return `${host}${s.cwd}`;
}

export function Navigator({ open, onClose }: NavigatorProps) {
  const sessions = usePerchStore((s) => s.sessions);
  const sessionId = usePerchStore((s) => s.sessionId);
  const switchSession = usePerchStore((s) => s.switchSession);
  const hostId = usePerchStore((s) => s.activeHostId);
  const activeProject = usePerchStore((s) => s.activeProject);
  const catalog = usePerchStore((s) => s.agentManifestsByHost[hostId]);
  const fetchAgents = usePerchStore((s) => s.fetchAgentManifests);
  const createSession = usePerchStore((s) => s.createSessionOnHost);
  const manageAgents = usePerchStore((s) => s.openAgentCatalog);
  const connected = usePerchStore((s) => s.connected);
  const workspace = usePerchStore(effectiveWorkspace);
  const supportsSearch = usePerchStore((s) => (workspace?.hostId === "local" ? s.serverInfo?.capabilities : s.workspaceCapabilitiesByHost[workspace?.hostId ?? ""])?.includes("fs.search") === true);
  const searchResult = useWorkspaceFilesStore((s) => workspace ? s.searches[workspace.id] : undefined);
  const supportsRun = usePerchStore((s) => workspace?.hostId === "local" && s.serverInfo?.capabilities?.includes("workspace.run.v1") === true);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterChip>("all");
  const [selected, setSelected] = useState(0);
  const [runTarget, setRunTarget] = useState<{ workspaceId: string; cwd: string; command: string } | null>(null);
  const [running, setRunning] = useState(false);
  const runPending = useRef(false);
  const [runError, setRunError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open && connected) fetchAgents(hostId); }, [open, connected, fetchAgents, hostId]);
  const current = sessions.find((session) => session.id === sessionId);
  const cwd = current?.cwd ?? activeProject?.cwd;
  const runMode = query.trimStart().startsWith(">");
  const fileQuery = runMode ? "" : query.trim();
  const searchActive = open && connected && supportsSearch && !!workspace && filter === "all" && !!fileQuery;
  useEffect(() => {
    if (!searchActive || !workspace) return;
    const timer = setTimeout(() => useWorkspaceFilesStore.getState().searchFiles(workspace.id, fileQuery), 180);
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
      run: () => useFileTabs.getState().open(workspace.id, file.path),
    })) : [];
    const choices = [
      ...(connected && sessionId && current?.cwd ? [{ id: "terminal", label: "New Terminal", detail: current.cwd, run: () => splitActiveTab("right") }] : []),
      ...(connected && cwd ? (catalog?.manifests ?? [])
        .filter((entry) => entry.available && entry.enabled !== false && entry.supportedModes.includes("cli") && entry.capabilities.includes("interactiveTerminal"))
        .map((entry) => ({ id: entry.id, label: entry.displayName, detail: cwd, run: () => createSession(hostId, cwd, entry.id) })) : []),
      { id: "agents", label: "Manage agents", detail: "Installed and available to install", run: manageAgents },
    ];
    const search = query.trim().toLowerCase();
    return [...files, ...choices.filter((choice) => !search || choice.label.toLowerCase().includes(search))];
  }, [catalog, connected, createSession, current?.cwd, cwd, filter, hostId, manageAgents, query, sessionId, matchingSearch, workspace, runMode, supportsRun]);

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
      .filter((s) => filter === "all" || sessionDotState(s) === filter)
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
          switchSession(target.id);
          onClose();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, rows, commands, selected, switchSession, onClose, runTarget]);

  if (!open) return null;
  if (runTarget) return <ConfirmDialog
    message={`Run in a new terminal?\n\nHost: This computer\nFolder: ${runTarget.cwd}\n\n${runTarget.command}`}
    confirmLabel="Run" busy={running}
    onCancel={() => { setRunTarget(null); requestAnimationFrame(() => inputRef.current?.focus()); }}
    onConfirm={() => {
      if (runPending.current) return;
      runPending.current = true; setRunning(true);
      void runInWorkspace(runTarget.workspaceId, runTarget.command).then((id) => {
        usePerchStore.getState().startCli(id, "terminal");
        useFileTabs.getState().showSession();
        switchSession(id); onClose();
      }, (error: unknown) => { setRunError(error instanceof Error ? error.message : String(error)); }).finally(() => {
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
                switchSession(s.id);
                onClose();
              }}
            >
              <StatusDot session={s} />
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
