import { Fragment, type ReactElement, useEffect, useMemo, useRef, useState } from "react";
import { ADD_PROJECT_EVENT } from "./NoSessionPanel";
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

// Sidebar project list. A few tokens stay as hooks: e2e and the harness select on
// `workspace-project`, `workspace-entry`, `workspace-entry__button(--active)`,
// `workspace-project__workspaces`, `workspace-entry__sessions` and `workspace-overview__add-form`.
const FOCUS = "focus-visible:[outline:1px_solid_var(--overlay-1)] focus-visible:[outline-offset:-1px]";
const FONT = "[font-family:inherit] [font-size:inherit] [font-weight:inherit]";
const ROW_BTN = "flex w-full min-w-0 items-center text-left [border:0] [font-family:inherit]";
const SESSION = `${ROW_BTN} cursor-pointer gap-[0.4rem] rounded-none bg-transparent px-[0.65rem] py-[0.3rem] text-[0.7rem] hover:bg-surface-1 hover:text-fg ${FOCUS}`;
const SESSION_TITLE = "overflow-hidden text-ellipsis whitespace-nowrap";
const RENAME = "mx-[0.3rem] my-1 w-[calc(100%_-_0.6rem)] rounded-ui border border-accent bg-surface-0 px-[0.3rem] py-[0.2rem] text-[0.76rem] text-fg [font-family:inherit] [font-weight:inherit] [line-height:inherit]";
const DOT = "shrink-0 text-[0.58rem] text-subtext-0";
const ENTRY_BTN = `workspace-entry__button ${ROW_BTN} cursor-pointer gap-[0.35rem] rounded-none py-[0.4rem] pr-[0.3rem] pl-[1.5rem] text-fg ${FOCUS}`;
const STRONG = "overflow-hidden text-[0.76rem] font-bold text-ellipsis whitespace-nowrap text-fg";
const SPAN = "overflow-hidden text-[0.63rem] text-ellipsis whitespace-nowrap text-subtext-0";
const BODY = "grid min-w-0 flex-1 gap-[0.1rem]";
const SMALL_BTN = "shrink-0 cursor-pointer rounded-ui border px-[0.3rem] py-[0.14rem] text-[0.58rem] leading-[1.1] [font-family:inherit]";
const JOB_ACTION = `${SMALL_BTN} border-overlay-0 bg-transparent text-subtext-0 hover:border-accent hover:text-accent focus-visible:border-accent focus-visible:text-accent`;
// Glyph buttons at the end of a row: shown on hover of the row (`group/ph`, `group/row`),
// on keyboard focus, always on touch.
const REVEAL = "opacity-0 focus-visible:opacity-100 [@media(hover:none)]:opacity-100";
const GLYPH = `w-[1.7rem] shrink-0 self-stretch cursor-pointer rounded-none p-0 leading-none [background:none] [border:0] ${FONT} hover:bg-surface-1 hover:text-fg`;
const PROJECT_ICON = `${GLYPH} text-overlay-1 ${REVEAL} group-hover/ph:opacity-100 aria-[expanded=false]:opacity-100`;
const SESSION_CLOSE = `${GLYPH} text-overlay-1 ${REVEAL} group-hover/row:opacity-100`;
const HEADER_PLUS = "h-auto w-[1.7rem] self-stretch rounded-none p-0 text-[0.95rem] leading-none opacity-0 group-hover/ph:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100";
const FILES_BTN = `workspace-entry__files rounded-ui border border-transparent bg-surface-1 px-[0.28rem] py-[0.14rem] text-[0.58rem] leading-[1.1] text-subtext-0 [font-family:inherit] cursor-pointer opacity-0 [transition:opacity_0.12s_ease,border-color_0.12s_ease,color_0.12s_ease] group-hover/entry:opacity-100 hover:border-accent hover:text-accent focus-visible:border-accent focus-visible:text-accent focus-visible:opacity-100 ${FOCUS} [@media(max-width:700px)]:static [@media(max-width:700px)]:mt-0 [@media(max-width:700px)]:mr-[0.3rem] [@media(max-width:700px)]:mb-[0.35rem] [@media(max-width:700px)]:ml-[1.45rem] [@media(max-width:700px)]:min-h-[2.75rem] [@media(max-width:700px)]:px-[0.6rem] [@media(max-width:700px)]:py-[0.45rem] [@media(max-width:700px)]:text-left [@media(max-width:700px)]:opacity-100 [@media(max-width:700px)]:border-overlay-0 [@media(max-width:700px)]:hover:border-accent`;

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
  const height = items.length * 30;
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
          className={menuItem({ danger: !!item.danger })}
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

function copyText(text: string) {
  void navigator.clipboard?.writeText(text).catch(() => { /* no clipboard: nothing to do */ });
}

const COLLAPSED_KEY = "perch.sidebar.collapsedProjects";
function readCollapsed(): string[] {
  try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]") as string[]; } catch { return []; }
}

type SessionView = "compact" | "list";
const SESSION_VIEW_KEY = "perch.sidebar.sessionView";
function readSessionView(): SessionView {
  try { return localStorage.getItem(SESSION_VIEW_KEY) === "list" ? "list" : "compact"; } catch { return "compact"; }
}

/** Compact sessions: one status dot per session on the row's own line. Click
 * switches to it, right-click closes it; the tooltip names it and its state. */
function SessionDots({ sessions, activeId, onPick, onMenu }: {
  sessions: SessionSummary[];
  activeId: string | null;
  onPick: (id: string) => void;
  onMenu: (session: SessionSummary, x: number, y: number) => void;
}) {
  return (
    <span className="flex min-w-0 shrink items-stretch gap-0 self-stretch overflow-hidden" data-testid="session-dots">
      {sessions.map((session) => (
        <button
          key={session.id}
          type="button"
          className={cn("grid w-[1.6rem] shrink-0 self-stretch cursor-pointer place-items-center rounded-none bg-transparent p-0 [border:0] hover:bg-overlay-0", FOCUS, session.id === activeId && "workspace-entry__session--active bg-overlay-0")}
          data-testid={`workspace-session-${session.id}`}
          title={`${session.title || "New session"} · ${sessionDotState(session)}`}
          aria-label={`${session.title || "New session"}, ${sessionDotState(session)}`}
          aria-current={session.id === activeId ? "true" : undefined}
          onClick={(event) => { event.stopPropagation(); onPick(session.id); }}
          onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onMenu(session, event.clientX, event.clientY); }}
        >
          <StatusDot session={session} className="mt-0 text-[0.8rem]" />
        </button>
      ))}
    </span>
  );
}

type Organize = "project" | "list";
const ORGANIZE_KEY = "perch.sidebar.organize";
const ORGANIZE_LABELS: Record<Organize, string> = { project: "By project", list: "In one list" };
function readOrganize(): Organize {
  try { return localStorage.getItem(ORGANIZE_KEY) === "list" ? "list" : "project"; } catch { return "project"; }
}

function workspacesForProject(
  workspaces: WorkspaceRecord[],
  projectId: string,
): WorkspaceRecord[] {
  return workspaces
    .filter((workspace) => workspace.projectId === projectId && workspace.state !== "archived")
    .sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      if (a.state !== b.state) return a.state === "active" ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
}

/** The Chats project: the scratch folder "No project" sessions run in
 * (`session::chats_pair`). Listed as a flat chat list after the projects. */
function isChatsProject(project: WorkspaceProject): boolean {
  return project.path.endsWith("/.perch/scratch");
}

function sessionsForWorkspace(
  sessions: SessionSummary[],
  workspace: WorkspaceRecord,
): SessionSummary[] {
  return sessions
    .filter((session) => {
      if (session.workspaceId) return session.workspaceId === workspace.id;
      return (session.hostId ?? "local") === workspace.hostId && session.cwd === workspace.path;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
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
        <div className="flex items-center gap-[0.35rem] py-[0.2rem] pr-[0.45rem] pl-[1.45rem]" key={workspace.id} title={workspace.path}>
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
  const activeHostId = usePerchStore((state) => state.activeHostId);
  const projects = usePerchStore((state) => state.workspaceProjects);
  const workspaces = usePerchStore((state) => state.workspaces);
  const sessions = usePerchStore((state) => state.sessions);
  const worktreeJobs = usePerchStore((state) => state.worktreeJobs);
  const activeProjectId = usePerchStore((state) => state.activeProjectId);
  const activeWorkspaceId = usePerchStore((state) => state.activeWorkspaceId);
  const snapshot = usePerchStore((state) => state.workspaceSnapshotByHost[activeHostId]);
  const fetchWorkspaceSnapshot = usePerchStore((state) => state.fetchWorkspaceSnapshot);
  const createWorkspaceProject = usePerchStore((state) => state.createWorkspaceProject);
  const setActiveHost = usePerchStore((state) => state.setActiveHost);
  const sshHosts = usePerchStore((state) => state.hosts);
  const hostStates = usePerchStore((state) => state.hostStates);
  // Which host the Add project dialog registers on; starts as the active one.
  const [addHostId, setAddHostId] = useState(activeHostId);
  const focusWorkspaceProject = usePerchStore((state) => state.focusWorkspaceProject);
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
      "divider",
      { label: "Remove project", testId: `workspace-project-remove-${project.id}`, danger: true, onSelect: () => setRemovingProject(project) },
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
              onClick={() => deleteSession(session.id)}
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
      { label: "Close session", testId: `workspace-session-close-${session.id}`, danger: true, onSelect: () => deleteSession(session.id) },
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

  /** A clicked workspace with no sessions never keeps showing another
   * workspace's session: it starts the agent set in Settings → "Empty
   * workspace opens", else shows its start picker (`NoSessionPanel`). */
  function openEmptyWorkspace(hostId: string, path: string) {
    const state = usePerchStore.getState();
    const agent = state.settings?.emptyWorkspaceAgent;
    if (agent) createSessionOnHost(hostId, path, agent);
    else state.showWorkspaceHome();
  }

  function navigateToWorkspace(workspaceId: string) {
    focusWorkspace(workspaceId);
    const workspace = workspaces.find((candidate) => candidate.id === workspaceId);
    if (!workspace) {
      onNavigate?.();
      return;
    }
    const workspaceSessions = sessionsForWorkspace(sessions, workspace);
    if (!workspaceSessions.some((candidate) => candidate.id === sessionId)) {
      if (workspaceSessions[0]) switchSession(workspaceSessions[0].id);
      else openEmptyWorkspace(workspace.hostId, workspace.path);
    }
    onNavigate?.();
  }

  // "In one list": every session on this host, projects and Chats alike, newest first.
  const allSessions = useMemo(
    () => sessions.filter((session) => (session.hostId ?? "local") === activeHostId).sort((a, b) => b.createdAt - a.createdAt),
    [sessions, activeHostId],
  );
  const listView = (
    <div className="py-[0.2rem]" data-testid="workspace-session-list">
      {allSessions.length === 0 && <div className="px-[0.3rem] py-2 text-[0.7rem] text-subtext-0">No chats yet.</div>}
      {allSessions.map((session) => {
        const owner = projects.find((project) => project.id === session.projectId);
        return (
          <div className="group/row flex items-stretch" key={session.id}>
            <button
              type="button"
              className={cn(SESSION, "px-[0.65rem] py-[0.3rem] text-[0.7rem]", session.id === sessionId ? "workspace-entry__session--active font-semibold text-fg" : "text-subtext-0")}
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
              onClick={() => deleteSession(session.id)}
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
        const chatsWorkspace = workspacesForProject(workspaces, chatsProject.id)[0];
        return (
          <div className="pb-1" data-testid="workspace-chats">
            <div className="group/ph flex items-stretch hover:bg-surface-1">
              <button
                type="button"
                className="flex flex-1 cursor-pointer items-center gap-[0.35rem] py-[0.5rem] pr-[0.55rem] pl-[0.75rem] text-left text-[0.76rem] leading-[1.3rem] font-bold text-subtext-0 [background:none] [border:0] [font-family:inherit] [line-height:inherit] hover:text-fg focus-visible:text-fg"
                data-testid="workspace-chats-collapse"
                aria-expanded={!chatsCollapsed}
                onClick={() => toggleCollapsed(chatsProject.id)}
              >
                Chats
                <Chevron open={!chatsCollapsed} />
              </button>
              {chats.length > 0 && (
                <button
                  type="button"
                  className={PROJECT_ICON}
                  data-testid="workspace-chats-menu"
                  title="Chats actions"
                  aria-label="Chats actions"
                  aria-haspopup="menu"
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setMenu({ x: rect.left, y: rect.bottom + 4, label: "Chats actions", items: [
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
                  if (chatsWorkspace) focusWorkspace(chatsWorkspace.id);
                  else focusWorkspaceProject(chatsProject.id);
                  openEmptyWorkspace(chatsProject.hostId, chatsWorkspace?.path ?? chatsProject.path);
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
                      className={cn(SESSION, "px-[0.65rem] py-[0.3rem] text-[0.7rem]", session.id === sessionId ? "workspace-entry__session--active font-semibold text-fg" : "text-subtext-0")}
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
                      onClick={() => deleteSession(session.id)}
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
        "workspace-overview flex flex-col overflow-hidden",
        // compact = the phone switcher, where the panel owns the bottom edge
        compact ? "min-h-full flex-1" : "min-h-0 flex-1 border-b border-b-overlay-0",
      )}
      data-testid="workspace-overview"
      aria-label="Projects and workspaces"
    >
      <div className="flex shrink-0 items-stretch justify-between gap-[0.45rem] border-b border-b-[color:color-mix(in_srgb,var(--overlay-0)_72%,transparent)] pl-[0.75rem]">
        <div className="flex min-w-0 items-center gap-[0.45rem] py-[0.55rem]">
          <span className="text-[0.72rem] font-bold tracking-[0.08em] text-fg uppercase">{organize === "list" ? "Chats" : "Projects"}</span>
          <span className="text-[0.65rem] whitespace-nowrap text-subtext-0">
            {organize === "list"
              ? `${allSessions.length} chat${allSessions.length === 1 ? "" : "s"}`
              : visibleProjects.length ? `${visibleProjects.length} project${visibleProjects.length === 1 ? "" : "s"}` : "No projects"}
          </span>
        </div>
        <div className="flex shrink-0 items-stretch">
          <button
            type="button"
            className={cn(segment(), "grid w-9 place-items-center p-0 [@media(max-width:700px)]:h-[2.75rem] [@media(max-width:700px)]:w-[2.75rem] [@media(max-width:700px)]:min-w-[2.75rem]")}
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
            className={cn(segment(), "px-[0.8rem] text-[0.68rem] font-bold text-fg [@media(max-width:700px)]:min-h-[2.75rem] [@media(max-width:700px)]:px-[0.65rem]")}
            data-testid="workspace-add-project"
            onClick={() => { setAddHostId(activeHostId); setAddOpen((open) => !open); }}
          >
            + Add
          </button>
        </div>
      </div>

      {addOpen && (
        <Dialog title="Add project" onClose={() => setAddOpen(false)} testId="workspace-add-form">
          <label className="grid gap-[0.16rem] text-[0.7rem] text-subtext-0">
            <span>Name <em className="text-overlay-1 not-italic">optional</em></span>
            <input
              className="w-full min-w-0 rounded-ui border border-overlay-0 bg-surface-0 px-[0.5rem] py-[0.4rem] text-fg focus:border-overlay-1 focus:outline-none"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Project name"
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
          <strong className="text-[0.77rem] text-fg">Register a project</strong>
          <span>Projects keep sessions, checkouts, and files together.</span>
          {!addOpen && (
            <button type="button" className="mt-[0.18rem] cursor-pointer rounded-ui border border-overlay-0 bg-surface-1 px-[0.45rem] py-[0.28rem] text-accent [font-family:inherit] hover:border-accent focus-visible:border-accent" onClick={() => setAddOpen(true)} data-testid="workspace-empty-add">
              Register folder
            </button>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto py-[0.28rem]" data-testid="project-list">
          {organize === "list" ? listView : <>
          {visibleProjects.map((project) => {
            const allWorkspaces = workspacesForProject(workspaces, project.id);
            const projectWorkspaces = allWorkspaces.filter((w) => !w.hidden);
            const hiddenWorkspaces = allWorkspaces.filter((w) => w.hidden);
            const projectJobs = project.hostId === "local"
              ? worktreeJobs.filter((job) => job.repoPath === project.repoPath || job.repoPath === project.path)
              : [];
            const projectCollapsed = collapsed.includes(project.id);
            const single = singleWorkspaceOf(project);
            const projectSessions = sessionsForProject(project.id);
            // With nothing to fold away, the header opens the checkout instead.
            const collapsible = single ? sessionView === "list" && projectSessions.length > 0 : true;
            const showHeaderDots = projectSessions.length > 0 && (projectCollapsed || (single && sessionView === "compact"));
            const onHeaderClick = () => (collapsible || !single ? toggleCollapsed(project.id) : navigateToWorkspace(single.id));
            return (
              <div
                className="workspace-project pb-[0.2rem]"
                key={project.id}
                data-testid={`workspace-project-${project.id}`}
              >
                <div
                  className={cn("group/ph flex items-stretch hover:bg-surface-1", single && "workspace-entry", single && single.id === activeWorkspaceId && "bg-surface-1")}
                  data-testid={single ? `workspace-entry-${single.id}` : undefined}
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
                    "flex-1 cursor-pointer gap-[0.45rem] bg-transparent py-[0.5rem] pr-[0.4rem] pl-[0.75rem] text-fg",
                    single && "workspace-entry__button",
                    single && single.id === activeWorkspaceId && "workspace-entry__button--active",
                    FOCUS,
                  )}
                  data-testid={`project-toggle-${project.id}`}
                  aria-expanded={collapsible ? !projectCollapsed : undefined}
                  onClick={onHeaderClick}
                  title={project.path}
                >
                  <span className="w-3 shrink-0 text-center text-[0.65rem] text-subtext-0" aria-hidden="true">{project.favorite ? "◆" : "◇"}</span>
                  <span className="grid min-w-0 gap-[0.1rem]">
                    <strong className={STRONG}>{project.name || basename(project.path)}</strong>
                  </span>
                  {single?.branch && single.branch !== (project.name || basename(project.path)) && <span className={cn(SPAN, "min-w-0 shrink-[3]")}>{single.branch}</span>}
                  {single?.dirty && <span className={DOT} title="Uncommitted changes" aria-label="Uncommitted changes">●</span>}
                  {collapsible && <Chevron open={!projectCollapsed} className="shrink-0 text-subtext-0" />}
                </button>
                )}
                {showHeaderDots && (
                  <SessionDots sessions={projectSessions} activeId={sessionId} onPick={pickSession} onMenu={sessionMenu} />
                )}
                <button
                  type="button"
                  className={PROJECT_ICON}
                  data-testid={`workspace-project-menu-${project.id}`}
                  title="Project actions"
                  aria-label="Project actions"
                  aria-haspopup="menu"
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setMenu({ x: rect.left, y: rect.bottom + 4, label: "Project actions", items: projectMenu(project) });
                  }}
                >
                  ⋯
                </button>
                {project.repoPath ? <WorktreeMenu hostId={project.hostId} cwd={project.repoPath} projectKey={`${project.hostId}:${project.repoPath}`} className={HEADER_PLUS} /> : (
                  <button
                    type="button"
                    className={cn("worktree-menu__btn", ICON_BUTTON, HEADER_PLUS)}
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
                  <div className="workspace-project__workspaces pt-0 pb-[0.2rem]">
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
                      return (
                        <Fragment key={workspace.id}>
                        <div
                          className="workspace-entry group/entry relative"
                          data-testid={`workspace-entry-${workspace.id}`}
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
                          <div className={cn("flex items-stretch hover:bg-surface-1", workspaceActive && "bg-surface-1")}>
                          <button
                            type="button"
                            className={cn(
                              ENTRY_BTN,
                              "flex-1 bg-transparent",
                              workspaceActive && "workspace-entry__button--active",
                            )}
                            aria-pressed={workspaceActive}
                            onClick={() => navigateToWorkspace(workspace.id)}
                            title={workspace.path}
                          >
                            <span className={BODY}>
                              <strong
                                className={STRONG}
                                title="Double-click to rename"
                                onDoubleClick={(event) => {
                                  event.stopPropagation();
                                  setRenamingId(workspace.id);
                                }}
                              >
                                {workspace.name || basename(workspace.path)}
                              </strong>
                              {/* A branch only when it tells checkouts apart; the path is in the tooltip. */}
                              {workspace.branch && workspace.branch !== (workspace.name || basename(workspace.path)) && <span className={SPAN}>{workspace.branch}</span>}
                            </span>
                            {workspace.dirty && <span className={DOT} title="Uncommitted changes" aria-label="Uncommitted changes">●</span>}
                            {/* Only what needs attention; "ready" is the norm. */}
                            {(workspace.pinned || workspace.state === "sleeping") && (
                              <span className="shrink-0 text-[0.58rem] text-subtext-0">
                                {[workspace.pinned && "pinned", workspace.state === "sleeping" && "sleeping"].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </button>
                          {sessionView === "compact" && workspaceSessions.length > 0 && (
                            <SessionDots sessions={workspaceSessions} activeId={sessionId} onPick={pickSession} onMenu={sessionMenu} />
                          )}
                          </div>
                          )}
                          {/* Desktop uses the right-click menu; the phone has no
                              right-click, so it keeps these buttons. */}
                          {compact && (
                          <div className="absolute top-[0.3rem] right-[0.3rem] flex gap-[0.2rem]">
                          <button
                            type="button"
                            className={cn(FILES_BTN, "px-[0.3rem] py-[0.05rem] text-[0.78rem] leading-[1.1]")}
                            data-testid={`workspace-pin-${workspace.id}`}
                            aria-pressed={workspace.pinned === true}
                            title={workspace.pinned ? "Unpin" : "Pin to the top of the project"}
                            aria-label={workspace.pinned ? "Unpin" : "Pin"}
                            onClick={(event) => {
                              event.stopPropagation();
                              pinWorkspace(workspace.id, !workspace.pinned);
                            }}
                          >
                            {workspace.pinned ? "⇣" : "⇡"}
                          </button>
                          {workspace.parentWorkspaceId && project.repoPath && (
                            <button
                              type="button"
                              className={cn(FILES_BTN, "px-[0.3rem] py-[0.05rem] text-[0.78rem] leading-[1.1]")}
                              data-testid={`workspace-delete-${workspace.id}`}
                              title="Delete this worktree and its branch"
                              aria-label="Delete worktree"
                              onClick={(event) => {
                                event.stopPropagation();
                                requestWorktreeMenu(`${project.hostId}:${project.repoPath}`, { path: workspace.path, branch: workspace.branch || undefined });
                              }}
                            >
                              {"\u{1F5D1}\u{FE0E}"}
                            </button>
                          )}
                          {workspace.parentWorkspaceId && (
                            <button
                              type="button"
                              className={cn(FILES_BTN, "px-[0.3rem] py-[0.05rem] text-[0.78rem] leading-[1.1]")}
                              data-testid={`workspace-hide-${workspace.id}`}
                              title="Hide from the sidebar (the checkout stays)"
                              aria-label="Hide worktree"
                              onClick={(event) => {
                                event.stopPropagation();
                                setWorkspaceHidden(workspace.id, true);
                              }}
                            >
                              ⊖
                            </button>
                          )}
                          <button
                            type="button"
                            className={FILES_BTN}
                            data-testid={`workspace-files-${workspace.id}`}
                            title={`Open files for ${workspace.name || basename(workspace.path)}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              focusWorkspace(workspace.id);
                              openWorkspaceFiles(workspace.id);
                              onNavigate?.();
                            }}
                          >
                            Files
                          </button>
                          {(workspace.branch || project.repoPath) && <button
                            type="button"
                            className={FILES_BTN}
                            data-testid={`workspace-git-${workspace.id}`}
                            title={`Open Git and review for ${workspace.name || basename(workspace.path)}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              focusWorkspace(workspace.id);
                              openWorkspaceGitReview(workspace.id);
                              onNavigate?.();
                            }}
                          >
                            Git
                          </button>}
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
                          {sessionView === "list" && workspaceSessions.length > 0 && sessionRows(workspaceSessions)}
                        </div>
                        {(children.get(workspace.id) ?? []).length > 0 && depth < 8 && (
                          <div className="ml-[0.9rem]" data-testid={`workspace-children-${workspace.id}`}>
                            {(children.get(workspace.id) ?? []).map((child) => renderWorkspace(child, depth + 1))}
                          </div>
                        )}
                        </Fragment>
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
                            {sessionView === "list" && !projectCollapsed && sessionsForWorkspace(sessions, single).length > 0 && sessionRows(sessionsForWorkspace(sessions, single))}
                          </>
                        );
                      }
                      return roots.map((workspace) => renderWorkspace(workspace, 0));
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
