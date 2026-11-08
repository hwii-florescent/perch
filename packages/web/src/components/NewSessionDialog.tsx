/**
 * NewSessionDialog.tsx — the centered, keyboard-only "New session" picker: Cmd+Shift+T
 * (or the sidebar's New session button) opens it on the project list, Enter picks a
 * project, then the same filterable list offers that project's agents and terminals, a
 * browser and a new file. Type to filter, ↑↓ Enter, 1–9 jump, Backspace on an empty
 * filter goes back, Escape closes. Mounted once in App; opened by NEW_SESSION_EVENT.
 */
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { NEW_SESSION_EVENT } from "../appEvents";
import { openBlankBrowser, useFileTabs } from "../fileTabs";
import { cn } from "../lib/cn";
import { effectiveActiveProject, effectiveWorkspace, usePerchStore, type WorkspaceProject } from "../store";
import { isChatsProject, workspacesForProject } from "../workspaceNav";
import { AgentIcon } from "./AgentIcon";
import { useAgentChoices } from "./AgentPicker";
import { FileEntryMenu } from "./FileEntryMenu";
import { BrowserIcon, FileIcon } from "./TabBar";

interface Row { id: string; label: string; detail?: string; icon?: ReactNode; muted?: boolean; disabled?: boolean; run: () => void }

export function NewSessionDialog() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(NEW_SESSION_EVENT, show);
    return () => window.removeEventListener(NEW_SESSION_EVENT, show);
  }, []);
  return open ? <Dialog onClose={() => setOpen(false)} /> : null;
}

function Dialog({ onClose }: { onClose: () => void }) {
  const hostId = usePerchStore((s) => s.activeHostId);
  const allProjects = usePerchStore((s) => s.workspaceProjects);
  const projects = allProjects.filter((p) => p.hostId === hostId);
  const activeProject = usePerchStore(effectiveActiveProject);
  const activeWorkspace = usePerchStore(effectiveWorkspace);
  const createSessionOnHost = usePerchStore((s) => s.createSessionOnHost);
  const focusWorkspace = usePerchStore((s) => s.focusWorkspace);
  const setLastAgentChoice = usePerchStore((s) => s.setLastAgentChoice);
  const manage = usePerchStore((s) => s.openAgentCatalog);
  const { connected, discovery, catalog, choices } = useAgentChoices(hostId);
  const agentsReady = connected && !(discovery && catalog?.state !== "ready");

  // `stage.target` is the chosen project, or null for "No project" (a quickchat in the home folder).
  const [stage, setStage] = useState<{ target: WorkspaceProject | null } | null>(null);
  const [newFile, setNewFile] = useState<{ id: string; path: string } | null>(null);
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState(() => Math.max(0, projects.findIndex((p) => p.path === activeProject?.cwd)));

  // Dismissing returns focus to where it was (the terminal), not to <body>.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => { if (!document.activeElement || document.activeElement === document.body) previous?.focus?.(); };
  }, []);

  function pick(target: WorkspaceProject | null) {
    setStage({ target });
    setFilter("");
    setActive(0);
  }

  let rows: Row[];
  let title: string;
  if (!stage) {
    title = "New session in…";
    rows = [
      ...projects.map((p) => ({ id: p.id, label: p.name || p.path, detail: p.path, run: () => pick(p) })),
      ...(projects.some(isChatsProject) ? [] : [{ id: "none", label: "No project", detail: "Quickchat", muted: true, run: () => pick(null) }]),
    ];
  } else {
    const { target } = stage;
    // The workspace the tab lands in: the one on screen if it belongs to the project, else the project's first.
    const ws = target && (activeWorkspace?.projectId === target.id ? activeWorkspace : workspacesForProject(usePerchStore.getState().workspaces, target.id)[0]);
    const cwd = target ? ws?.path ?? target.path : "~";
    title = `New in ${target ? target.name || target.path : "No project"}`;
    rows = [
      ...choices.map((choice) => ({
        id: choice.id, label: choice.label, icon: <AgentIcon provider={choice.id} />, disabled: !agentsReady,
        run: () => {
          if (choice.id === "claude" || choice.id === "codex") setLastAgentChoice(choice.id);
          createSessionOnHost(hostId, cwd, choice.id);
          onClose();
        },
      })),
      ...(ws ? [
        { id: "browser", label: "New browser", icon: <BrowserIcon />, run: () => { focusWorkspace(ws.id); openBlankBrowser(ws.id); onClose(); } },
        { id: "file", label: "New file", icon: <FileIcon />, run: () => { focusWorkspace(ws.id); setNewFile({ id: ws.id, path: ws.path }); } },
      ] : []),
      ...(discovery ? [{ id: "manage", label: "Manage agents…", muted: true, run: () => { onClose(); manage(); } }] : []),
    ];
  }
  const needle = filter.trim().toLowerCase();
  const visible = needle ? rows.filter((r) => `${r.label} ${r.detail ?? ""}`.toLowerCase().includes(needle)) : rows;
  const run = (row?: Row) => { if (row && !row.disabled) row.run(); };

  if (newFile) {
    return <FileEntryMenu workspaceId={newFile.id} workspacePath={newFile.path} target={null} x={0} y={0} initialStage="newFile"
      onClose={onClose} onOpenFile={(path) => useFileTabs.getState().open(newFile.id, path)} onExpand={() => {}} onRefresh={() => {}} />;
  }

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-start justify-center bg-[rgba(0,0,0,0.55)] pt-[12vh]" onClick={onClose}>
      <div
        className="flex w-[min(480px,calc(100vw_-_2rem))] max-h-[min(420px,calc(100dvh_-_16vh_-_2rem))] flex-col overflow-hidden rounded-ui bg-panel-bg shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
        role="dialog" aria-modal="true" aria-label="New session" data-testid="new-session-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="m-0 shrink-0 px-4 pt-3 text-[0.72rem] text-subtext-0">{title}</p>
        <input
          key={stage ? "action" : "project"}
          type="text" autoFocus role="combobox" aria-expanded="true" aria-controls="new-session-list"
          aria-activedescendant={visible[active] ? `new-session-${visible[active].id}` : undefined}
          aria-label="Filter"
          placeholder="Type to filter, ↑↓ Enter, 1–9"
          data-testid="new-session-filter"
          className="shrink-0 bg-panel-bg px-4 py-2 [font-family:inherit] text-[0.95rem] text-fg [outline:none] placeholder:text-subtext-0"
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") { onClose(); return; }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              if (visible.length) setActive((active + (e.key === "ArrowDown" ? 1 : visible.length - 1)) % visible.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(visible[active]);
            } else if (e.key === "Backspace" && !filter && stage) {
              e.preventDefault();
              setStage(null);
              setActive(Math.max(0, projects.findIndex((p) => p.id === stage.target?.id)));
            } else if (!filter && /^[1-9]$/.test(e.key) && visible[Number(e.key) - 1]) {
              e.preventDefault();
              run(visible[Number(e.key) - 1]);
            }
          }}
        />
        <div id="new-session-list" role="listbox" className="min-h-0 flex-1 overflow-y-auto py-1">
          {visible.map((row, i) => (
            <button type="button" role="option" aria-selected={i === active} tabIndex={-1} key={row.id} id={`new-session-${row.id}`}
              data-testid={`new-session-row-${row.id}`} title={row.detail} disabled={row.disabled}
              className={cn("flex w-full cursor-pointer items-center gap-2 px-4 py-[0.45rem] text-left [font-family:inherit] text-[0.85rem] text-fg disabled:cursor-not-allowed disabled:opacity-40", row.muted && "text-subtext-0", i === active ? "bg-surface-1" : "[background:none]")}
              onMouseMove={() => setActive(i)} onClick={row.run}>
              {row.icon}
              <span className="shrink-0">{row.label}</span>
              {row.detail && <span className="ml-auto min-w-0 truncate text-[0.72rem] text-subtext-0">{row.detail}</span>}
              {!filter && i < 9 && <kbd className={cn("text-[0.7rem] text-subtext-0 [font-family:inherit]", !row.detail && "ml-auto")}>{i + 1}</kbd>}
            </button>
          ))}
          {!visible.length && <p className="m-0 px-4 py-2 text-[0.75rem] text-subtext-0" role="status">No match.</p>}
          {stage && discovery && catalog?.state === "loading" && <p className="m-0 px-4 py-2 text-[0.75rem] text-subtext-0" role="status">Checking agents…</p>}
          {stage && discovery && catalog?.state === "error" && <p className="m-0 px-4 py-2 text-[0.75rem] text-red" role="alert">{catalog.error}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
