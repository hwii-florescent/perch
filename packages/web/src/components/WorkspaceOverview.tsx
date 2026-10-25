import { type ReactElement, useEffect, useMemo, useRef, useState } from "react";
import { ADD_PROJECT_EVENT } from "../appEvents";
import { requestCloseSession } from "../closeGuard";
import { createPortal } from "react-dom";
import { usePerchStore, type WorkspaceProject, type WorkspaceRecord } from "../store";
import { StatusDot } from "./StatusDot";
import { sessionDotState } from "../statusDot";
import { menuDivider, menuItem, menuPanel } from "./ui/menu";
import { GHOST_BUTTON, ICON_BUTTON } from "./ui/icon-button";
import { segment } from "./ui/segment";
import { Chevron } from "./ui/chevron";
import { Dialog } from "./ui/dialog";
import { SELECT } from "./ui/settings";
import { cn } from "../lib/cn";
import { WorktreeMenu } from "./WorktreeMenu";
import { ConfirmDialog } from "./ConfirmDialog";
import { DirectoryBrowser } from "./DirectoryBrowser";
import { NewSessionPopover } from "../Sidebar";
import type { SessionSummary, WorktreeJob } from "@perch/shared";
import { isChatsProject, navigateToWorkspace as goToWorkspace, newScratchpad, orderedNests, sessionsForWorkspace, workspacesForProject } from "../workspaceNav";
import { workspaceTabs } from "../workspaceTabs";
import { TAB_ORDER_EVENT } from "../tabOrder";
import { useNestShortcutHints } from "../keybinds";

// Sidebar project list. A few tokens stay as hooks: e2e and the harness select on
// `workspace-project`, `workspace-entry`, `workspace-entry__button(--active)`,
// `workspace-project__workspaces`, `workspace-entry__sessions` and `workspace-overview__add-form`.
const FOCUS = "focus-visible:[outline:1px_solid_var(--overlay-1)] focus-visible:[outline-offset:-1px]";
const FONT = "[font-family:inherit] [font-size:inherit] [font-weight:inherit]";
const ROW_BTN = "flex w-full min-w-0 items-center text-left [border:0] [font-family:inherit]";
const SESSION = `${ROW_BTN} min-h-8 cursor-pointer gap-[0.4rem] rounded-ui bg-transparent px-[0.65rem] py-1 text-[13px] min-[701px]:min-h-7 min-[701px]:text-[12px] hover:bg-surface-1 hover:text-fg ${FOCUS}`;
const SESSION_TITLE = "overflow-hidden text-ellipsis whitespace-nowrap";
const RENAME = "mx-[0.3rem] my-1 w-[calc(100%_-_0.6rem)] rounded-ui border border-accent bg-surface-0 px-[0.3rem] py-[0.2rem] text-[0.76rem] text-fg [font-family:inherit] [font-weight:inherit] [line-height:inherit]";
const DOT = "shrink-0 text-[0.58rem] text-subtext-0";
const ENTRY_BTN = `workspace-entry__button ${ROW_BTN} min-h-8 cursor-pointer gap-[0.45rem] rounded-ui py-[3px] pr-3 pl-3 text-fg ${FOCUS}`;
const STRONG = "overflow-hidden text-[14px] font-semibold text-ellipsis whitespace-nowrap text-fg min-[701px]:text-[12.5px] min-[701px]:font-medium";
const WORKSPACE_TITLE = "min-w-0 overflow-hidden text-[13px] font-medium text-ellipsis whitespace-nowrap min-[701px]:text-[12px]";
const WORKSPACE_TREE = "workspace-tree flex flex-col gap-[2px]";
const SPAN = "overflow-hidden text-[12px] text-ellipsis whitespace-nowrap text-subtext-0";
const BODY = "grid min-w-0 flex-1 gap-[0.1rem]";
const SMALL_BTN = "shrink-0 cursor-pointer rounded-ui border px-[0.3rem] py-[0.14rem] text-[0.58rem] leading-[1.1] [font-family:inherit]";
const JOB_ACTION = `${SMALL_BTN} border-overlay-0 bg-transparent text-subtext-0 hover:border-accent hover:text-accent focus-visible:border-accent focus-visible:text-accent`;
// Glyph buttons at the end of a row: shown on hover of the row (`group/ph`, `group/row`),
// on keyboard focus, always on touch.
const REVEAL = "opacity-0 focus-visible:opacity-100 [@media(hover:none)]:opacity-100";
const GLYPH = `w-[1.7rem] shrink-0 self-stretch cursor-pointer rounded-ui p-0 leading-none [background:none] [border:0] ${FONT} hover:bg-surface-1 hover:text-fg`;
const PROJECT_ICON = `${GLYPH} text-overlay-1 ${REVEAL} group-hover/ph:opacity-100 aria-[expanded=false]:opacity-100`;
const SESSION_CLOSE = `${GLYPH} text-overlay-1 ${REVEAL} group-hover/row:opacity-100`;
const HEADER_PLUS = "h-auto w-[1.7rem] self-stretch rounded-ui p-0 text-[0.95rem] leading-none opacity-0 group-hover/ph:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100";

function basename(path: string): string {
  const parts = path.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || path;
}

type MenuItem = { label: string; testId: string; onSelect: () => void; danger?: boolean } | "divider";

/** Right-click / ⋯ menu for a project or workspace row (Orca's sidebar
 * context menu, trimmed to what perch does). Same look and dismiss rules as
 * `PaneContextMenu`. */
function RowMenu({ x, y, label, items, onClose }: { x: number; y: number; label: string; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const click = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) onClose(); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", click);
      document.removeEventListener("keydown", key);
    };
  }, [onClose]);
  const height = items.length * (window.innerWidth <= 700 ? 44 : 30);
  return createPortal(
    <div
      className={menuPanel}
      role="menu"
      aria-label={label}
      data-testid="row-menu"
      ref={ref}
      style={{ position: "fixed", zIndex: 9999, minWidth: 180, left: Math.min(x, window.innerWidth - 188), top: Math.max(8, Math.min(y, window.innerHeight - height - 8)) }}
    >
      {items.map((item, index) => item === "divider" ? (
        <div key={index} className={menuDivider} />
      ) : (
        <button
          key={item.testId}
          type="button"
          role="menuitem"
          className={cn(menuItem({ danger: !!item.danger }), "max-[700px]:min-h-11")}
          data-testid={item.testId}
          onClick={() => { onClose(); item.onSelect(); }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

/** The phone's right-click: hold a row for half a second. Spread the result on
 * the row; the click that ends the hold is swallowed so it doesn't also navigate.
 * Touch/pen only, a mouse keeps its real contextmenu. Scrolling cancels it
 * (pointercancel), as does moving more than a few pixels. */
let heldTimer: number | undefined;
let held = false;
function longPress(open: (x: number, y: number) => void) {
  const cancel = () => window.clearTimeout(heldTimer);
  let from = { x: 0, y: 0 };
  return {
    onPointerDown: (event: React.PointerEvent) => {
      held = false;
      if (event.pointerType === "mouse") return;
      cancel();
      from = { x: event.clientX, y: event.clientY };
      heldTimer = window.setTimeout(() => { held = true; open(from.x, from.y); }, 450);
    },
    onPointerMove: (event: React.PointerEvent) => {
      if (Math.hypot(event.clientX - from.x, event.clientY - from.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onClickCapture: (event: React.MouseEvent) => {
      if (!held) return;
      held = false;
      event.stopPropagation();
      event.preventDefault();
    },
  };
}
/** Stops iOS from selecting text / showing its callout while a row is held. */
const HOLDABLE = "select-none [-webkit-touch-callout:none]";

function copyText(text: string) {
  void navigator.clipboard?.writeText(text).catch(() => { /* no clipboard: nothing to do */ });
}

const COLLAPSED_KEY = "perch.sidebar.collapsedProjects";
function readCollapsed(): string[] {
  try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]") as string[]; } catch { return []; }
}

const MAX_DOTS = 3;
type SessionView = "compact" | "list";
const SESSION_VIEW_KEY = "perch.sidebar.sessionView";
function readSessionView(): SessionView {
  try { return localStorage.getItem(SESSION_VIEW_KEY) === "list" ? "list" : "compact"; } catch { return "compact"; }
}

/** Compact sessions: one harness/status badge per session, on a second line under the
 * row's name (`flex-wrap` on the row). Click switches to it, right-click
 * closes it; the tooltip names it and its state. */
function SessionDots({ sessions, activeId, onPick, onMenu }: {
  sessions: SessionSummary[];
  activeId: string | null;
  onPick: (id: string) => void;
  onMenu: (session: SessionSummary, x: number, y: number) => void;
}) {
  // Desktop: up to MAX_DOTS chips sit at the right end of the row (Nests inside the Birdhouse,
  // docs/DECISIONS.md 2026-10-24). A crowded row keeps the strip on its own line under the name,
  // like the phone, so no session is ever hidden.
  const inline = sessions.length <= MAX_DOTS;
  return (
    <span className={cn("order-last w-full min-w-0 pb-1", inline && "min-[701px]:order-none min-[701px]:ml-auto min-[701px]:w-auto min-[701px]:shrink-0 min-[701px]:self-center min-[701px]:pb-0")}>
    <span
      className={cn("mx-auto flex w-[85%] min-w-0 cursor-default items-stretch gap-0 overflow-hidden rounded-ui border border-overlay-1 bg-transparent px-1", inline && "min-[701px]:mx-0 min-[701px]:w-auto min-[701px]:items-center min-[701px]:border-0 min-[701px]:px-0")}
      data-testid="session-dots"
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
    >
      {sessions.map((session) => (
        <button
          key={session.id}
          type="button"
          className={cn("group grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full bg-transparent p-0 [border:0] focus-visible:outline-none", inline && "min-[701px]:h-6 min-[701px]:w-6", session.id === activeId && "workspace-entry__session--active")}
          data-testid={`workspace-session-${session.id}`}
          title={`${session.title || "New session"} · ${sessionDotState(session)}`}
          aria-label={`${session.title || "New session"}, ${sessionDotState(session)}`}
          aria-current={session.id === activeId ? "true" : undefined}
          onClick={(event) => { event.stopPropagation(); onPick(session.id); }}
          onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onMenu(session, event.clientX, event.clientY); }}
        >
          <StatusDot session={session} className={cn("h-[18px] w-[18px] group-hover:bg-surface-0 group-focus-visible:[outline:1px_solid_var(--text)] group-focus-visible:outline-offset-1", session.id === activeId && "[outline:1px_solid_var(--text)] outline-offset-1")} />
        </button>
      ))}
    </span>
    </span>
  );
}

type Organize = "project" | "list";
const ORGANIZE_KEY = "perch.sidebar.organize";
const ORGANIZE_LABELS: Record<Organize, string> = { project: "By project", list: "In one list" };
function readOrganize(): Organize {
  try { return localStorage.getItem(ORGANIZE_KEY) === "list" ? "list" : "project"; } catch { return "project"; }
}

/** Orca's hidden-worktrees card: worktrees perch discovered but did not
 * create (or that were hidden) stay out of the tree until shown here. */
function HiddenWorktrees({ workspaces, projectId }: { workspaces: WorkspaceRecord[]; projectId: string }) {
  const [open, setOpen] = useState(false);
  const setWorkspaceHidden = usePerchStore((state) => state.setWorkspaceHidden);
  const count = workspaces.length;
  return (
    <div>
      <button
        type="button"
        className={`w-full cursor-pointer pt-1 pr-[0.45rem] pb-1 pl-[1.45rem] text-left text-[0.62rem] text-overlay-1 [background:none] [border:0] [font-family:inherit] hover:text-accent focus-visible:text-accent`}
        aria-expanded={open}
        data-testid={`workspace-hidden-${projectId}`}
        onClick={() => setOpen(!open)}
      >
        {count} hidden worktree{count === 1 ? "" : "s"}
      </button>
      {open && workspaces.map((workspace) => (
        <div className="flex items-center gap-[0.35rem] py-[3px] pr-3 pl-[1.45rem]" key={workspace.id} title={workspace.path}>
          <span className={BODY}>
            <strong className={STRONG}>{workspace.branch || basename(workspace.path)}</strong>
            <span className={SPAN}>{workspace.path}</span>
          </span>
          <button
            type="button"
            className={JOB_ACTION}
            data-testid={`workspace-show-${workspace.id}`}
            onClick={() => setWorkspaceHidden(workspace.id, false)}
          >
            Show
          </button>
        </div>
      ))}
    </div>
  );
}

/** Background worktree creates for one project (`server/worktree_jobs.rs`):
 * Orca's sidebar progress row, with Cancel while running and Retry / Dismiss
 * once a create failed. */
function WorktreeJobRows({ jobs }: { jobs: WorktreeJob[] }) {
  const cancel = usePerchStore((state) => state.cancelWorktreeJob);
  const retry = usePerchStore((state) => state.retryWorktreeJob);
  const dismiss = usePerchStore((state) => state.dismissWorktreeJob);
  return (
    <>
      {jobs.map((job) => {
        const failed = job.status === "failed";
        return (
          <div
            className="workspace-entry relative border-l border-l-overlay-0"
            key={job.jobId}
            data-testid={`worktree-job-${job.branch}`}
            role="status"
          >
            <div className={cn(ENTRY_BTN, "cursor-default bg-transparent")} title={job.path}>
              <span className={cn(DOT, failed && "text-red")} aria-hidden="true">{failed ? "✕" : "◌"}</span>
              <span className={BODY}>
                <strong className={STRONG}>{job.branch}</strong>
                <span className={cn(SPAN, failed && "text-red")} data-testid={`worktree-job-phase-${job.branch}`}>{failed ? "Create failed" : `${job.phase}…`}</span>
              </span>
              {job.status === "running" && (
                <button type="button" className={JOB_ACTION} data-testid={`worktree-job-cancel-${job.branch}`} onClick={() => cancel(job.jobId)}>
                  Cancel
                </button>
              )}
              {failed && (
                <>
                  <button type="button" className={JOB_ACTION} data-testid={`worktree-job-retry-${job.branch}`} onClick={() => retry(job.jobId)}>
                    Retry
                  </button>
                  <button type="button" className={JOB_ACTION} data-testid={`worktree-job-dismiss-${job.branch}`} onClick={() => dismiss(job.jobId)}>
                    Dismiss
                  </button>
                </>
              )}
            </div>
            {failed && (
              <div className="mt-0 mr-[0.3rem] mb-[0.3rem] ml-[1.45rem] overflow-hidden text-[0.6rem] text-red [display:-webkit-box] [overflow-wrap:anywhere] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]" data-testid={`worktree-job-error-${job.branch}`} title={job.error}>
                {job.error}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export interface WorkspaceOverviewProps {
  /** Compact mode is used inside the mobile switcher where the containing
   * panel already owns the title and close affordance. */
  compact?: boolean;
  /** Called after a project/workspace/session is selected by a containing
   * mobile switcher so the navigation panel can close itself. */
  onNavigate?: () => void;
}

export function WorkspaceOverview({ compact = false, onNavigate }: WorkspaceOverviewProps) {
  const nestHints = useNestShortcutHints();
  const showNestHints = nestHints.some(Boolean);
  const numberedNests = orderedNests().slice(0, nestHints.length);
  function nestHint(workspaceId: string) {
    const label = nestHints[numberedNests.findIndex((nest) => nest.id === workspaceId)];
    return label ? <kbd className="pointer-events-none absolute top-[7px] right-3 w-8 text-right text-[11px] leading-[18px] font-semibold text-accent tabular-nums [font-family:inherit]" data-testid={`workspace-shortcut-${workspaceId}`} aria-label={`Jump to workspace: ${label}`}>{label}</kbd> : null;
  }
  const [, refreshTabOrder] = useState(0);
  useEffect(() => {
    const refresh = () => refreshTabOrder((version) => version + 1);
    window.addEventListener(TAB_ORDER_EVENT, refresh);
    return () => window.removeEventListener(TAB_ORDER_EVENT, refresh);
  }, []);
  function tabOrderedSessions(workspace: WorkspaceRecord): SessionSummary[] {
    return workspaceTabs({ ...usePerchStore.getState(), activeHostId: workspace.hostId, activeWorkspaceId: workspace.id }, [])
      .flatMap((entry) => entry.kind === "session" ? [entry.session] : []);
  }
  const activeHostId = usePerchStore((state) => state.activeHostId);
  const projects = usePerchStore((state) => state.workspaceProjects);
  const workspaces = usePerchStore((state) => state.workspaces);
  const sessions = usePerchStore((state) => state.sessions);
  const worktreeJobs = usePerchStore((state) => state.worktreeJobs);
  const activeWorkspaceId = usePerchStore((state) => state.activeWorkspaceId);
  const snapshot = usePerchStore((state) => state.workspaceSnapshotByHost[activeHostId]);
  const fetchWorkspaceSnapshot = usePerchStore((state) => state.fetchWorkspaceSnapshot);
  const createWorkspaceProject = usePerchStore((state) => state.createWorkspaceProject);
  const setActiveHost = usePerchStore((state) => state.setActiveHost);
  const sshHosts = usePerchStore((state) => state.hosts);
  const hostStates = usePerchStore((state) => state.hostStates);
  // Which host the Add project dialog registers on; starts as the active one.
  const [addHostId, setAddHostId] = useState(activeHostId);
  const focusWorkspace = usePerchStore((state) => state.focusWorkspace);
  const restoreWorkspace = usePerchStore((state) => state.restoreWorkspace);
  const renameWorkspace = usePerchStore((state) => state.renameWorkspace);
  const pinWorkspace = usePerchStore((state) => state.pinWorkspace);
  const setWorkspaceHidden = usePerchStore((state) => state.setWorkspaceHidden);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const openWorkspaceFiles = usePerchStore((state) => state.openWorkspaceFiles);
  const openWorkspaceGitReview = usePerchStore((state) => state.openWorkspaceGitReview);
  const switchSession = usePerchStore((state) => state.switchSession);
  const sessionId = usePerchStore((state) => state.sessionId);
  const createRequest = usePerchStore((state) => state.workspaceProjectCreate);
  const clearCreateRequest = usePerchStore((state) => state.clearWorkspaceProjectCreate);
  const deleteSession = usePerchStore((state) => state.deleteSession);
  const removeWorkspaceProject = usePerchStore((state) => state.removeWorkspaceProject);
  const requestWorktreeMenu = usePerchStore((state) => state.requestWorktreeMenu);
  const [removingProject, setRemovingProject] = useState<WorkspaceProject | null>(null);
  const renameWorkspaceProject = usePerchStore((state) => state.renameWorkspaceProject);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; label: string; items: MenuItem[] } | null>(null);
  const createSessionOnHost = usePerchStore((state) => state.createSessionOnHost);
  // A folder that isn't a git repo has no worktrees, so its "+" starts a session there.
  const [newSession, setNewSession] = useState<{ project: WorkspaceProject; rect: DOMRect } | null>(null);
  // Collapsed projects hide their workspaces and sessions (per viewer).
  const [collapsed, setCollapsed] = useState<string[]>(readCollapsed);
  function toggleCollapsed(projectId: string) {
    setCollapsed((current) => {
      const next = current.includes(projectId) ? current.filter((id) => id !== projectId) : [...current, projectId];
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)); } catch { /* per-viewer convenience */ }
      return next;
    });
  }

  function projectMenu(project: WorkspaceProject): MenuItem[] {
    const projectSessions = sessionsForProject(project.id);
    return [
      { label: "Rename", testId: `workspace-project-rename-${project.id}`, onSelect: () => setRenamingProjectId(project.id) },
      { label: "Copy path", testId: `workspace-project-copy-${project.id}`, onSelect: () => copyText(project.path) },
      ...(projectSessions.length > 0
        ? [{ label: "Close all sessions", testId: `workspace-project-close-all-${project.id}`, onSelect: () => { for (const session of projectSessions) deleteSession(session.id); } }]
        : []),
      ...singleExtras(project),
      ...(compact ? [] : [{
        label: sessionViewStored === "compact" ? "Show session list" : "Show compact sessions",
        testId: `workspace-project-session-view-${project.id}`,
        onSelect: () => chooseSessionView(sessionViewStored === "compact" ? "list" : "compact"),
      }]),
      "divider",
      { label: "Remove birdhouse", testId: `workspace-project-remove-${project.id}`, danger: true, onSelect: () => setRemovingProject(project) },
    ];
  }

  /** A project with one checkout has no row of its own for it (the project row
   * stands in), so Files and Git for that checkout live on the project menu. */
  function singleWorkspaceOf(project: WorkspaceProject): WorkspaceRecord | undefined {
    if (compact) return undefined;
    const visible = workspacesForProject(workspaces, project.id).filter((w) => !w.hidden);
    const [only] = visible;
    return only && visible.length === 1 && !only.parentWorkspaceId ? only : undefined;
  }
  function singleExtras(project: WorkspaceProject): MenuItem[] {
    const workspace = singleWorkspaceOf(project);
    if (!workspace) return [];
    const open = (tool: "files" | "git") => {
      focusWorkspace(workspace.id);
      if (tool === "files") openWorkspaceFiles(workspace.id);
      else openWorkspaceGitReview(workspace.id);
    };
    return [
      "divider",
      { label: "Files", testId: `workspace-menu-files-${workspace.id}`, onSelect: () => open("files") },
      ...(workspace.branch || project.repoPath ? [{ label: "Git", testId: `workspace-menu-git-${workspace.id}`, onSelect: () => open("git") }] : []),
    ];
  }

  function workspaceMenu(project: WorkspaceProject, workspace: WorkspaceRecord): MenuItem[] {
    const linked = Boolean(workspace.parentWorkspaceId);
    const open = (tool: "files" | "git") => {
      focusWorkspace(workspace.id);
      if (tool === "files") openWorkspaceFiles(workspace.id);
      else openWorkspaceGitReview(workspace.id);
      onNavigate?.();
    };
    return [
      { label: "Rename", testId: `workspace-rename-item-${workspace.id}`, onSelect: () => setRenamingId(workspace.id) },
      { label: "Copy path", testId: `workspace-copy-${workspace.id}`, onSelect: () => copyText(workspace.path) },
      ...(workspace.branch ? [{ label: "Copy branch name", testId: `workspace-copy-branch-${workspace.id}`, onSelect: () => copyText(workspace.branch!) }] : []),
      { label: workspace.pinned ? "Unpin" : "Pin", testId: `workspace-pin-${workspace.id}`, onSelect: () => pinWorkspace(workspace.id, !workspace.pinned) },
      "divider",
      { label: "Files", testId: `workspace-menu-files-${workspace.id}`, onSelect: () => open("files") },
      ...(workspace.branch || project.repoPath ? [{ label: "Git", testId: `workspace-menu-git-${workspace.id}`, onSelect: () => open("git") }] : []),
      ...(linked ? ["divider" as const, { label: "Hide from sidebar", testId: `workspace-hide-${workspace.id}`, onSelect: () => setWorkspaceHidden(workspace.id, true) }] : []),
      ...(linked && project.repoPath
        ? [{ label: "Delete worktree", testId: `workspace-delete-${workspace.id}`, danger: true, onSelect: () => requestWorktreeMenu(`${project.hostId}:${project.repoPath}`, { path: workspace.path, branch: workspace.branch || undefined }) }]
        : []),
    ];
  }

  function sessionRows(list: SessionSummary[]): ReactElement {
    return (
      <div className="workspace-entry__sessions pt-0 pb-1">
        {list.map((session) => (
          <div className="group/row flex items-stretch" key={session.id}>
            <button
              type="button"
              className={cn(SESSION, "pl-[1.9rem]", session.id === sessionId ? "workspace-entry__session--active bg-surface-1 font-semibold text-fg" : "text-subtext-0")}
              data-testid={`workspace-session-${session.id}`}
              onClick={() => pickSession(session.id)}
            >
              <StatusDot session={session} />
              <span className={SESSION_TITLE}>{session.title || "New session"}</span>
            </button>
            <button
              type="button"
              className={SESSION_CLOSE}
              data-testid={`workspace-session-close-${session.id}`}
              title="Close session"
              aria-label={`Close ${session.title || "session"}`}
              onClick={() => requestCloseSession(session.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    );
  }

  const [organize, setOrganize] = useState<Organize>(readOrganize);
  const [sessionViewStored, setSessionView] = useState<SessionView>(readSessionView);
  // The phone keeps full rows: dots are too small a touch target.
  const sessionView: SessionView = compact ? "list" : sessionViewStored;
  function chooseSessionView(next: SessionView) {
    setSessionView(next);
    try { localStorage.setItem(SESSION_VIEW_KEY, next); } catch { /* per-viewer convenience */ }
  }
  function sessionMenu(session: SessionSummary, x: number, y: number) {
    setMenu({ x, y, label: "Session actions", items: [
      { label: "Close session", testId: `workspace-session-close-${session.id}`, danger: true, onSelect: () => requestCloseSession(session.id) },
    ] });
  }
  function pickSession(id: string) {
    switchSession(id);
    onNavigate?.();
  }
  function chooseOrganize(next: Organize) {
    setOrganize(next);
    try { localStorage.setItem(ORGANIZE_KEY, next); } catch { /* per-viewer convenience */ }
  }
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");

  // The desktop app can also pick a local folder with the OS dialog, but only
  // when asked for inside the Add project dialog (Orca's "Browse folder").
  const tauriInvoke = (window as { __TAURI_INTERNALS__?: { invoke: (cmd: string, args: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__?.invoke;
  async function browseNative() {
    try {
      const picked = await tauriInvoke?.("plugin:dialog|open", { options: { directory: true, title: "Add project" } });
      if (typeof picked === "string") submitProject(picked);
    } catch { /* cancelled or unavailable: the directory browser below still works */ }
  }
  // The home screen's "Add project" (NoSessionPanel.tsx) starts the same flow.
  useEffect(() => {
    const open = () => { setAddHostId(usePerchStore.getState().activeHostId); setAddOpen(true); };
    window.addEventListener(ADD_PROJECT_EVENT, open);
    return () => window.removeEventListener(ADD_PROJECT_EVENT, open);
  }, []);

  useEffect(() => {
    if (createRequest?.status !== "success") return;
    // The sidebar lists one host at a time: follow the project to its host.
    if (createRequest.hostId !== activeHostId) setActiveHost(createRequest.hostId);
    setName("");
    setAddOpen(false);
    clearCreateRequest();
  }, [clearCreateRequest, createRequest?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const hostProjects = useMemo(
    () => projects
      .filter((project) => project.hostId === activeHostId)
      .sort((a, b) => {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      }),
    [activeHostId, projects],
  );
  const chatsProject = hostProjects.find(isChatsProject);
  const visibleProjects = hostProjects.filter((project) => !isChatsProject(project));

  function submitProject(path: string) {
    if (!path.trim() || createRequest?.status === "pending") return;
    createWorkspaceProject(path, name, addHostId);
  }

  function sessionsForProject(projectId: string): SessionSummary[] {
    const projectWorkspaces = workspacesForProject(workspaces, projectId);
    return projectWorkspaces
      .flatMap((workspace) => sessionsForWorkspace(sessions, workspace))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  function navigateToWorkspace(workspaceId: string) {
    goToWorkspace(workspaceId);
    onNavigate?.();
  }

  // "In one list": every session on this host, projects and Chats alike, newest first.
  const allSessions = useMemo(
    () => sessions.filter((session) => (session.hostId ?? "local") === activeHostId).sort((a, b) => b.createdAt - a.createdAt),
    [sessions, activeHostId],
  );
  const listView = (
    <div className="py-[0.2rem]" data-testid="workspace-session-list">
      {allSessions.length === 0 && <div className="px-[0.3rem] py-2 text-[0.7rem] text-subtext-0">Nothing in the Scratchpad yet.</div>}
      {allSessions.map((session) => {
        const owner = projects.find((project) => project.id === session.projectId);
        return (
          <div className="group/row flex items-stretch" key={session.id}>
            <button
              type="button"
              className={cn(SESSION, session.id === sessionId ? "workspace-entry__session--active font-semibold text-fg" : "text-subtext-0")}
              data-testid={`workspace-session-${session.id}`}
              title={session.cwd}
              onClick={() => {
                switchSession(session.id);
                onNavigate?.();
              }}
            >
              <StatusDot session={session} />
              <span className={SESSION_TITLE}>{session.title || "New chat"}</span>
              {owner && !isChatsProject(owner) && <span className="shrink-0 text-[0.62rem] text-overlay-1">{owner.name || basename(owner.path)}</span>}
            </button>
            <button
              type="button"
              className={SESSION_CLOSE}
              data-testid={`workspace-session-close-${session.id}`}
              title="Close chat"
              aria-label={`Close ${session.title || "chat"}`}
              onClick={() => requestCloseSession(session.id)}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );

  // After the projects, inside their scrolling list (or after the empty state).
  const chatsSection = chatsProject && (() => {
        const chats = sessionsForProject(chatsProject.id);
        const chatsCollapsed = collapsed.includes(chatsProject.id);
        return (
          <div className="pb-1" data-testid="workspace-chats">
            <div className="group/ph flex items-stretch rounded-ui hover:bg-surface-1">
              <button
                type="button"
                className="flex min-h-8 flex-1 cursor-pointer items-center gap-[0.35rem] rounded-ui py-1 pr-[0.55rem] pl-[0.75rem] text-left text-[14px] font-semibold text-subtext-0 [background:none] [border:0] [font-family:inherit] [line-height:inherit] hover:text-fg focus-visible:text-fg min-[701px]:pl-4 min-[701px]:text-[0.62rem] min-[701px]:tracking-[0.045em] min-[701px]:uppercase"
                data-testid="workspace-chats-collapse"
                aria-expanded={!chatsCollapsed}
                onClick={() => toggleCollapsed(chatsProject.id)}
              >
                Scratchpad
                <Chevron open={!chatsCollapsed} />
              </button>
              {chats.length > 0 && (
                <button
                  type="button"
                  className={PROJECT_ICON}
                  data-testid="workspace-chats-menu"
                  title="Scratchpad actions"
                  aria-label="Scratchpad actions"
                  aria-haspopup="menu"
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setMenu({ x: rect.left, y: rect.bottom + 4, label: "Scratchpad actions", items: [
                      { label: "Close all chats", testId: "workspace-chats-close-all", danger: true, onSelect: () => { for (const chat of chats) deleteSession(chat.id); } },
                    ] });
                  }}
                >
                  ⋯
                </button>
              )}
              <button
                type="button"
                className={`${GLYPH} text-subtext-0 focus-visible:bg-surface-1 focus-visible:text-fg`}
                data-testid="workspace-chats-new"
                title="New chat"
                aria-label="New chat"
                onClick={() => {
                  newScratchpad();
                  onNavigate?.();
                }}
              >
                <svg className="mx-auto" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8 3H4.5A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13h7a1.5 1.5 0 0 0 1.5-1.5V8M11.2 2.8a1.2 1.2 0 0 1 1.7 1.7L8.5 8.9 6 9.5l.6-2.5z" />
                </svg>
              </button>
            </div>
            {!chatsCollapsed && chats.length > 0 && (
              <div className="pt-0 pr-[0.3rem] pb-1 pl-[0.4rem]">
                {chats.map((session) => (
                  <div className="group/row flex items-stretch" key={session.id}>
                    <button
                      type="button"
                      className={cn(SESSION, session.id === sessionId ? "workspace-entry__session--active font-semibold text-fg" : "text-subtext-0")}
                      data-testid={`workspace-session-${session.id}`}
                      title={session.title || "New chat"}
                      onClick={() => {
                        switchSession(session.id);
                        onNavigate?.();
                      }}
                    >
                      <StatusDot session={session} />
                      <span className={SESSION_TITLE}>{session.title || "New chat"}</span>
                    </button>
                    <button
                      type="button"
                      className={SESSION_CLOSE}
                      data-testid={`workspace-session-close-${session.id}`}
                      title="Close chat"
                      aria-label={`Close ${session.title || "chat"}`}
                      onClick={() => requestCloseSession(session.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
  })();

  return (
    <section
      className={cn(
        // The phone keeps 6px; the desktop sidebar uses the shell's soft corner.
        "workspace-overview flex flex-col overflow-hidden [--radius:6px] min-[701px]:[--radius:var(--radius-pane)]",
        // compact = the phone switcher, where the panel owns the bottom edge
        compact ? "min-h-full flex-1" : "min-h-0 flex-1 max-[700px]:border-b max-[700px]:border-b-overlay-0",
      )}
      data-testid="workspace-overview"
      aria-label="Birdhouses and nests"
    >
      <div className="flex shrink-0 items-stretch justify-between gap-[0.45rem] pl-[0.75rem] min-[701px]:pr-1 min-[701px]:pl-4">
        <div className="flex min-w-0 items-center gap-[0.45rem] py-[0.55rem]">
          <span className="text-[0.72rem] font-bold tracking-[0.08em] text-fg uppercase min-[701px]:text-[0.62rem] min-[701px]:font-semibold min-[701px]:tracking-[0.045em] min-[701px]:text-subtext-0">{organize === "list" ? "Sessions" : "Birdhouses"}</span>
          <span className="text-[0.65rem] whitespace-nowrap text-subtext-0 min-[701px]:hidden">
            {organize === "list"
              ? `${allSessions.length} session${allSessions.length === 1 ? "" : "s"}`
              : visibleProjects.length ? `${visibleProjects.length} birdhouse${visibleProjects.length === 1 ? "" : "s"}` : "No birdhouses"}
          </span>
        </div>
        <div className="flex shrink-0 items-stretch">
          <button
            type="button"
            className={cn(segment(), "grid w-9 place-items-center p-0 min-[701px]:my-[3px] min-[701px]:rounded-ui [@media(max-width:700px)]:h-[2.75rem] [@media(max-width:700px)]:w-[2.75rem] [@media(max-width:700px)]:min-w-[2.75rem]")}
            title="Organize sidebar"
            aria-label="Organize sidebar"
            aria-haspopup="menu"
            data-testid="workspace-organize"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setMenu({ x: rect.left, y: rect.bottom + 4, label: "Organize sidebar", items: [
                ...(Object.keys(ORGANIZE_LABELS) as Organize[]).map((key) => (
                  { label: `${organize === key ? "✓ " : "   "}${ORGANIZE_LABELS[key]}`, testId: `workspace-organize-${key}`, onSelect: () => chooseOrganize(key) }
                )),
                "divider" as const,
                { label: `${sessionViewStored === "compact" ? "✓ " : "   "}Compact sessions`, testId: "workspace-sessions-compact", onSelect: () => chooseSessionView("compact") },
                { label: `${sessionViewStored === "list" ? "✓ " : "   "}Session list`, testId: "workspace-sessions-list", onSelect: () => chooseSessionView("list") },
              ] });
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2.5 4.5h11M4.5 8h7M6.5 11.5h3" />
            </svg>
          </button>
          <button
            type="button"
            className={cn(segment(), "px-[0.8rem] text-[0.68rem] font-bold text-fg min-[701px]:my-[3px] min-[701px]:mr-2 min-[701px]:rounded-ui [@media(max-width:700px)]:min-h-[2.75rem] [@media(max-width:700px)]:px-[0.65rem]")}
            data-testid="workspace-add-project"
            title="Add birdhouse"
            aria-label="Add birdhouse"
            onClick={() => { setAddHostId(activeHostId); setAddOpen((open) => !open); }}
          >
            + Add
          </button>
        </div>
      </div>

      {addOpen && (
        <Dialog title="Add birdhouse" onClose={() => setAddOpen(false)} testId="workspace-add-form">
          <label className="grid gap-[0.16rem] text-[0.7rem] text-subtext-0">
            <span>Name <em className="text-overlay-1 not-italic">optional</em></span>
            <input
              className="w-full min-w-0 rounded-ui border border-overlay-0 bg-surface-0 px-[0.5rem] py-[0.4rem] text-fg focus:border-overlay-1 focus:outline-none"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Birdhouse name"
              data-testid="workspace-project-name"
            />
          </label>
          {sshHosts.length > 0 && (
            <label className="grid gap-[0.16rem] text-[0.7rem] text-subtext-0">
              <span>Host</span>
              <select className={SELECT} data-testid="workspace-add-host" value={addHostId} onChange={(event) => setAddHostId(event.target.value)}>
                <option value="local">This machine</option>
                {sshHosts.filter((host) => host.enabled).map((host) => {
                  const state = hostStates[host.id]?.state ?? "connecting";
                  return <option key={host.id} value={host.id} disabled={state !== "connected"}>{host.name}{state === "connected" ? "" : ` (${state})`}</option>;
                })}
              </select>
            </label>
          )}
          {tauriInvoke && addHostId === "local" && (
            <button type="button" className={cn(GHOST_BUTTON, "px-[0.6rem] py-[0.4rem] text-left text-[0.8rem] text-fg")} data-testid="workspace-add-browse-native" onClick={() => void browseNative()}>
              Browse folder…
            </button>
          )}
          {/* Same folder picker as "+ New session"; its "Use this folder" registers. */}
          <DirectoryBrowser key={addHostId} hostId={addHostId} onUseFolder={submitProject} />
          {createRequest?.status === "pending" && <span className="text-[0.7rem] text-subtext-0" role="status">Registering folder…</span>}
          {createRequest?.status === "error" && <span className="text-[0.7rem] text-red" role="alert">{createRequest.error || "Could not register this folder."}</span>}
          <div className="flex justify-end">
            <button type="button" className={cn(GHOST_BUTTON, "px-[0.6rem] py-[0.3rem] text-[0.75rem]", FOCUS)} disabled={createRequest?.status === "pending"} onClick={() => setAddOpen(false)}>
              Cancel
            </button>
          </div>
        </Dialog>
      )}

      {snapshot?.state === "loading" && (
        <div className="shrink-0 px-[0.65rem] py-[0.55rem] text-[0.7rem] text-subtext-0" role="status">Loading workspace…</div>
      )}
      {snapshot?.state === "error" && (
        <div className="flex shrink-0 items-center gap-[0.45rem] px-[0.65rem] py-[0.55rem] text-[0.7rem] text-red" role="alert">
          {snapshot.error || "Workspace could not be loaded."}
          <button type="button" className={`ml-auto cursor-pointer rounded-ui border border-current bg-transparent px-[0.38rem] py-[0.2rem] text-inherit [font:inherit] ${FOCUS}`} onClick={() => fetchWorkspaceSnapshot(activeHostId)}>Retry</button>
        </div>
      )}

      {organize === "project" && visibleProjects.length === 0 && snapshot?.state !== "loading" && (
        <div className="grid justify-items-start gap-[0.32rem] px-3 py-[1.1rem] text-[0.68rem] text-subtext-0">
          <span className="text-[1.3rem] leading-none text-accent" aria-hidden="true">＋</span>
          <strong className="text-[0.77rem] text-fg">Add a birdhouse</strong>
          <span>A birdhouse keeps its nests, sessions and files together.</span>
          {!addOpen && (
            <button type="button" className="mt-[0.18rem] cursor-pointer rounded-ui border border-overlay-0 bg-surface-1 px-[0.45rem] py-[0.28rem] text-accent [font-family:inherit] hover:border-accent focus-visible:border-accent" onClick={() => setAddOpen(true)} data-testid="workspace-empty-add">
              Register folder
            </button>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-[3px] py-[3px]" data-testid="project-list">
          {organize === "list" && !showNestHints ? listView : <>
          {visibleProjects.map((project) => {
            const allWorkspaces = workspacesForProject(workspaces, project.id);
            const projectWorkspaces = allWorkspaces.filter((w) => !w.hidden);
            const hiddenWorkspaces = allWorkspaces.filter((w) => w.hidden);
            const projectJobs = project.hostId === "local"
              ? worktreeJobs.filter((job) => job.repoPath === project.repoPath || job.repoPath === project.path)
              : [];
            const projectCollapsed = collapsed.includes(project.id) && !showNestHints;
            const single = singleWorkspaceOf(project);
            const shortcutHint = single ? nestHint(single.id) : null;
            const projectSessions = sessionsForProject(project.id);
            // With nothing to fold away, the header opens the checkout instead.
            const collapsible = single ? sessionView === "list" && projectSessions.length > 0 : true;
            const showHeaderDots = projectSessions.length > 0 && (projectCollapsed || (single && sessionView === "compact"));
            const onHeaderClick = () => (collapsible || !single ? toggleCollapsed(project.id) : navigateToWorkspace(single.id));
            return (
              <div
                className="workspace-project pb-1"
                key={project.id}
                data-testid={`workspace-project-${project.id}`}
              >
                <div
                  {...longPress((x, y) => setMenu({ x, y, label: "Project actions", items: projectMenu(project) }))}
                  className={cn("group/ph relative flex cursor-pointer flex-wrap items-stretch rounded-ui hover:bg-surface-1", HOLDABLE, single && "workspace-entry", single && single.id === activeWorkspaceId && "bg-surface-1")}
                  data-testid={single ? `workspace-entry-${single.id}` : undefined}
                  onClick={(event) => {
                    if (renamingProjectId === project.id || (event.target as HTMLElement).closest("button, input, a")) return;
                    onHeaderClick();
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenu({ x: event.clientX, y: event.clientY, label: "Project actions", items: projectMenu(project) });
                  }}
                >
                {renamingProjectId === project.id ? (
                  <input
                    className={RENAME}
                    data-testid={`workspace-project-rename-input-${project.id}`}
                    aria-label="Project name"
                    autoFocus
                    defaultValue={project.name || basename(project.path)}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Enter") {
                        renameWorkspaceProject(project.id, event.currentTarget.value);
                        setRenamingProjectId(null);
                      } else if (event.key === "Escape") {
                        setRenamingProjectId(null);
                      }
                    }}
                    onBlur={() => setRenamingProjectId(null)}
                  />
                ) : (
                <button
                  type="button"
                  className={cn(
                    ROW_BTN,
                    "min-h-8 flex-1 cursor-pointer gap-[0.45rem] rounded-ui bg-transparent py-[3px] pr-3 pl-3 text-fg",
                    single && "workspace-entry__button",
                    single && single.id === activeWorkspaceId && "workspace-entry__button--active",
                    FOCUS,
                  )}
                  data-testid={`project-toggle-${project.id}`}
                  aria-expanded={collapsible ? !projectCollapsed : undefined}
                  onClick={onHeaderClick}
                  title={project.path}
                >
                  {collapsible && <Chevron open={!projectCollapsed} size={10} className="-ml-1 hidden shrink-0 text-subtext-0 min-[701px]:block" />}
                  <svg className="h-3 w-3 shrink-0 text-subtext-0" data-testid="project-folder-icon" viewBox="0 0 16 16" fill={project.favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    <path d="M2 5V4a1 1 0 0 1 1-1h3l2 2h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5Z" />
                  </svg>
                  <span className="grid min-w-0 gap-[0.1rem]">
                    <strong className={STRONG}>{project.name || basename(project.path)}</strong>
                  </span>
                  {single?.branch && single.branch !== (project.name || basename(project.path)) && <span className={cn(SPAN, "min-w-0 shrink-[3]")}>{single.branch}</span>}
                  {single?.dirty && <span className={DOT} title="Uncommitted changes" aria-label="Uncommitted changes">●</span>}
                  {collapsible && <Chevron open={!projectCollapsed} className="shrink-0 text-subtext-0 min-[701px]:hidden" />}
                  {shortcutHint}
                </button>
                )}
                {showHeaderDots && (
                  <SessionDots sessions={allWorkspaces.flatMap(tabOrderedSessions)} activeId={sessionId} onPick={pickSession} onMenu={sessionMenu} />
                )}
                <button
                  type="button"
                  className={cn(PROJECT_ICON, shortcutHint && "invisible")}
                  data-testid={`workspace-project-menu-${project.id}`}
                  title="Birdhouse actions"
                  aria-label="Birdhouse actions"
                  aria-haspopup="menu"
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setMenu({ x: rect.left, y: rect.bottom + 4, label: "Project actions", items: projectMenu(project) });
                  }}
                >
                  ⋯
                </button>
                {project.repoPath ? <WorktreeMenu hostId={project.hostId} cwd={project.repoPath} projectKey={`${project.hostId}:${project.repoPath}`} className={cn(HEADER_PLUS, shortcutHint && "invisible")} /> : (
                  <button
                    type="button"
                    className={cn("worktree-menu__btn", ICON_BUTTON, HEADER_PLUS, shortcutHint && "invisible")}
                    data-testid={`workspace-project-new-session-${project.id}`}
                    title="New session in this folder"
                    aria-label="New session"
                    onClick={(event) => setNewSession({ project, rect: event.currentTarget.getBoundingClientRect() })}
                  >
                    +
                  </button>
                )}
                </div>
                {(!projectCollapsed || (single && !collapsible)) && (allWorkspaces.length > 0 || projectJobs.length > 0) && (
                  <div className="workspace-project__workspaces flex flex-col gap-[2px]">
                    {(() => {
                      // Orca's parent nesting: a worktree whose parent is another
                      // linked worktree renders under it; children of the primary
                      // workspace stay top level.
                      const byId = new Map(projectWorkspaces.map((w) => [w.id, w]));
                      const children = new Map<string, WorkspaceRecord[]>();
                      const roots: WorkspaceRecord[] = [];
                      for (const w of projectWorkspaces) {
                        const parent = w.parentWorkspaceId ? byId.get(w.parentWorkspaceId) : undefined;
                        if (parent?.parentWorkspaceId) children.set(parent.id, [...(children.get(parent.id) ?? []), w]);
                        else roots.push(w);
                      }
                      const renderWorkspace = (workspace: WorkspaceRecord, depth: number): ReactElement => {
                      const workspaceActive = workspace.id === activeWorkspaceId;
                      const workspaceSessions = sessionsForWorkspace(sessions, workspace);
                      const nested = children.get(workspace.id) ?? [];
                      return (
                        <div className="flex flex-col gap-[2px]" data-testid={`workspace-node-${workspace.id}`} key={workspace.id}>
                        <div
                          {...longPress((x, y) => setMenu({ x, y, label: "Workspace actions", items: workspaceMenu(project, workspace) }))}
                          className={cn("workspace-entry group/entry relative cursor-pointer rounded-ui hover:bg-surface-1", HOLDABLE, workspaceActive && "bg-surface-1")}
                          data-testid={`workspace-entry-${workspace.id}`}
                          onClick={(event) => {
                            if (renamingId === workspace.id || (event.target as HTMLElement).closest("button, input, a")) return;
                            navigateToWorkspace(workspace.id);
                          }}
                          onContextMenu={(event) => {
                            if ((event.target as HTMLElement).closest(".workspace-entry__sessions")) return;
                            event.preventDefault();
                            setMenu({ x: event.clientX, y: event.clientY, label: "Workspace actions", items: workspaceMenu(project, workspace) });
                          }}
                        >
                          {renamingId === workspace.id ? (
                            <input
                              className={RENAME}
                              data-testid={`workspace-rename-${workspace.id}`}
                              aria-label="Workspace name"
                              autoFocus
                              defaultValue={workspace.name || basename(workspace.path)}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                                if (event.key === "Enter") {
                                  renameWorkspace(workspace.id, event.currentTarget.value);
                                  setRenamingId(null);
                                } else if (event.key === "Escape") {
                                  setRenamingId(null);
                                }
                              }}
                              onBlur={() => setRenamingId(null)}
                            />
                          ) : (
                          <div className={cn("flex flex-wrap items-stretch rounded-ui hover:bg-surface-1", workspaceActive && "bg-surface-1")}>
                          <button
                            type="button"
                            className={cn(
                              ENTRY_BTN,
                              "flex-1 bg-transparent pr-12",
                              workspaceActive && "workspace-entry__button--active",
                            )}
                            aria-pressed={workspaceActive}
                            onClick={() => navigateToWorkspace(workspace.id)}
                            title={workspace.path}
                          >
                            <svg className="h-3 w-3 shrink-0 text-subtext-0" data-testid="workspace-checkout-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                              {workspace.parentWorkspaceId ? <>
                                <circle cx="4" cy="3" r="1.5" />
                                <circle cx="4" cy="13" r="1.5" />
                                <circle cx="12" cy="3" r="1.5" />
                                <path d="M4 4.5v7M4 9h4a4 4 0 0 0 4-4v-.5" />
                              </> : <path d="M8 3l5 5-5 5-5-5z" />}
                            </svg>
                            <span className={cn(BODY, "flex items-baseline gap-[0.35rem]")}>
                              <strong
                                className={cn(WORKSPACE_TITLE, workspaceActive ? "text-fg" : "text-subtext-0")}
                                title="Double-click to rename"
                                onDoubleClick={(event) => {
                                  event.stopPropagation();
                                  setRenamingId(workspace.id);
                                }}
                              >
                                {workspace.name || basename(workspace.path)}
                              </strong>
                              {/* A branch only when it tells checkouts apart; the path is in the tooltip. */}
                              {workspace.branch && workspace.branch !== (workspace.name || basename(workspace.path)) && <span className={cn(SPAN, "min-w-0 shrink-[3]")}>{workspace.branch}</span>}
                            </span>
                            {workspace.dirty && <span className={DOT} title="Uncommitted changes" aria-label="Uncommitted changes">●</span>}
                            {/* A collapsed nest keeps only its session count; the active one lists them below. */}
                            {sessionView === "list" && !workspaceActive && !compact && workspaceSessions.length > 0 && (
                              <span className="shrink-0 text-[0.62rem] text-subtext-0 tabular-nums" data-testid={`workspace-session-count-${workspace.id}`} title={`${workspaceSessions.length} sessions`}>{workspaceSessions.length}</span>
                            )}
                            {nestHint(workspace.id)}
                            {/* Only what needs attention; "ready" is the norm. */}
                            {(workspace.pinned || workspace.state === "sleeping") && (
                              <span className="shrink-0 text-[0.58rem] text-subtext-0">
                                {[workspace.pinned && "pinned", workspace.state === "sleeping" && "sleeping"].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </button>
                          {sessionView === "compact" && workspaceSessions.length > 0 && (
                            <SessionDots sessions={tabOrderedSessions(workspace)} activeId={sessionId} onPick={pickSession} onMenu={sessionMenu} />
                          )}
                          </div>
                          )}
                          {workspace.state === "sleeping" && (
                            <button
                              type="button"
                              className={`mt-0 mr-[0.3rem] mb-[0.3rem] ml-[0.5rem] cursor-pointer rounded-ui border border-yellow bg-transparent px-[0.35rem] py-[0.18rem] text-[0.6rem] text-yellow [font-family:inherit] ${FOCUS}`}
                              onClick={() => restoreWorkspace(workspace.id)}
                            >
                              Restore
                            </button>
                          )}
                          {sessionView === "list" && workspaceSessions.length > 0 && (workspaceActive || compact) && sessionRows(tabOrderedSessions(workspace))}
                        </div>
                        {nested.length > 0 && depth < 8 && (
                          <div className={`${WORKSPACE_TREE} ml-[0.9rem]`} data-testid={`workspace-children-${workspace.id}`}>
                            {nested.map((child) => renderWorkspace(child, depth + 1))}
                          </div>
                        )}
                        </div>
                      );
                      };
                      if (single) {
                        return (
                          <>
                            {single.state === "sleeping" && (
                              <button
                                type="button"
                                className={`mt-0 mr-[0.3rem] mb-[0.3rem] ml-[0.5rem] cursor-pointer rounded-ui border border-yellow bg-transparent px-[0.35rem] py-[0.18rem] text-[0.6rem] text-yellow [font-family:inherit] ${FOCUS}`}
                                onClick={() => restoreWorkspace(single.id)}
                              >
                                Restore
                              </button>
                            )}
                            {sessionView === "list" && !projectCollapsed && sessionsForWorkspace(sessions, single).length > 0 && sessionRows(tabOrderedSessions(single))}
                          </>
                        );
                      }
                      return (
                        <div className={WORKSPACE_TREE} data-testid="workspace-tree-root">
                          {roots.map((workspace) => renderWorkspace(workspace, 0))}
                        </div>
                      );
                    })()}
                    <WorktreeJobRows jobs={projectJobs} />
                    {hiddenWorkspaces.length > 0 && (
                      <HiddenWorktrees workspaces={hiddenWorkspaces} projectId={project.id} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {chatsSection}
          </>}
      </div>
      {menu && <RowMenu {...menu} onClose={() => setMenu(null)} />}
      {newSession && (
        <NewSessionPopover
          hostId={newSession.project.hostId}
          projectCwds={[newSession.project.path]}
          anchorRect={newSession.rect}
          onClose={() => setNewSession(null)}
          onSelect={(cwd, agent) => createSessionOnHost(newSession.project.hostId, cwd, agent)}
        />
      )}
      {removingProject && (
        <ConfirmDialog
          message={`Remove "${removingProject.name || basename(removingProject.path)}" from perch? Its sessions close (their agents and shells end); the folder and the agents' transcripts stay on disk.`}
          confirmLabel="Remove"
          onConfirm={() => {
            removeWorkspaceProject(removingProject.id);
            setRemovingProject(null);
          }}
          onCancel={() => setRemovingProject(null)}
        />
      )}
    </section>
  );
}
