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
import { usePerchStore } from "../store";
import { StatusDot } from "./StatusDot";
import { sessionDotState, type AgentDotState } from "../statusDot";
import type { SessionSummary } from "@perch/shared";
import { getDockviewController } from "../dockview/dockviewController";

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

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterChip>("all");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open && connected) fetchAgents(hostId); }, [open, connected, fetchAgents, hostId]);
  const current = sessions.find((session) => session.id === sessionId);
  const cwd = current?.cwd ?? activeProject?.cwd;
  const commands = useMemo(() => {
    if (filter !== "all") return [];
    const choices = [
      ...(connected && sessionId && current?.cwd ? [{ id: "terminal", label: "New Terminal", detail: current.cwd, run: () => getDockviewController()?.addTerminalPanel("right") }] : []),
      ...(connected && cwd ? (catalog?.manifests ?? [])
        .filter((entry) => entry.available && entry.enabled !== false && entry.supportedModes.includes("cli") && entry.capabilities.includes("interactiveTerminal"))
        .map((entry) => ({ id: entry.id, label: entry.displayName, detail: cwd, run: () => createSession(hostId, cwd, entry.id, "cli") })) : []),
      { id: "agents", label: "Manage agents", detail: "Installed and available to install", run: manageAgents },
    ];
    const search = query.trim().toLowerCase();
    return choices.filter((choice) => !search || choice.label.toLowerCase().includes(search));
  }, [catalog, connected, createSession, current?.cwd, cwd, filter, hostId, manageAgents, query, sessionId]);

  // Reset transient state every time the Navigator opens.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setFilter("all");
    setSelected(0);
    // Focus the search input once it's mounted.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions
      .filter((s) => !s.archived)
      .filter((s) => filter === "all" || sessionDotState(s) === filter)
      .filter((s) => !q || s.title.toLowerCase().includes(q) || s.cwd.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [sessions, filter, query]);

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
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      // Plain arrows always work; fzf-style Ctrl+j/Ctrl+n (down) and
      // Ctrl+k/Ctrl+p (up) as an alternative that doesn't require leaving
      // home row — deviates from the plan's literal "j/k" wording because
      // bare j/k must remain typeable in the always-focused search input.
      const down = e.key === "ArrowDown" || (e.ctrlKey && (e.key === "j" || e.key === "n"));
      const up = e.key === "ArrowUp" || (e.ctrlKey && (e.key === "k" || e.key === "p"));
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
        if (command) { onClose(); command.run(); return; }
        const target = rows[selected - commands.length];
        if (target) {
          switchSession(target.id);
          onClose();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, rows, commands, selected, switchSession, onClose]);

  if (!open) return null;

  const modal = (
    <div className="navigator__backdrop" onClick={onClose}>
      <div
        className="navigator"
        data-testid="navigator"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          className="navigator__input"
          data-testid="navigator-input"
          placeholder="Search sessions, agents, commands…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="navigator__chips">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={
                "navigator__chip" + (filter === chip.id ? " navigator__chip--active" : "")
              }
              data-testid={`navigator-filter-${chip.id}`}
              onClick={() => setFilter(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="navigator__list" ref={listRef}>
          {commands.map((command, index) => <button key={command.id} type="button"
            className={"navigator__row" + (index === selected ? " navigator__row--selected" : "")}
            data-testid={`navigator-command-${command.id}`} data-selected={index === selected}
            onMouseEnter={() => setSelected(index)} onClick={() => { onClose(); command.run(); }}>
            <span className="navigator__row-title">{command.label}</span><span className="navigator__row-cwd">{command.detail}</span>
          </button>)}
          {rows.length + commands.length === 0 && <div className="navigator__empty">No matches</div>}
          {rows.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={
                "navigator__row" +
                (i + commands.length === selected ? " navigator__row--selected" : "") +
                (s.id === sessionId ? " navigator__row--current" : "")
              }
              data-testid={`navigator-row-${s.id}`}
              data-selected={i + commands.length === selected}
              onMouseEnter={() => setSelected(i + commands.length)}
              onClick={() => {
                switchSession(s.id);
                onClose();
              }}
            >
              <StatusDot session={s} />
              <span className="navigator__row-title">{s.title || "(untitled)"}</span>
              <span className="navigator__row-cwd">{projectLabel(s)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
