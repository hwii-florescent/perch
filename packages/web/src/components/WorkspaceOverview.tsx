import { Fragment, type ReactElement, useEffect, useMemo, useRef, useState } from "react";
import { ADD_PROJECT_EVENT } from "./NoSessionPanel";
import { createPortal } from "react-dom";
import { usePerchStore, type WorkspaceProject, type WorkspaceRecord } from "../store";
import { StatusDot } from "./StatusDot";
import { WorktreeMenu } from "./WorktreeMenu";
import { ConfirmDialog } from "./ConfirmDialog";
import { DirectoryBrowser } from "./DirectoryBrowser";
import { NewSessionPopover } from "../Sidebar";
import type { SessionSummary, WorktreeJob } from "@perch/shared";

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
      className="pane-context-menu"
      role="menu"
      aria-label={label}
      data-testid="row-menu"
      ref={ref}
      style={{ position: "fixed", zIndex: 9999, minWidth: 180, left: Math.min(x, window.innerWidth - 188), top: Math.max(8, Math.min(y, window.innerHeight - height - 8)) }}
    >
      {items.map((item, index) => item === "divider" ? (
        <div key={index} className="pane-context-menu__divider" />
      ) : (
        <button
          key={item.testId}
          type="button"
          role="menuitem"
          className={"pane-context-menu__item" + (item.danger ? " pane-context-menu__item--danger" : "")}
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
    <div className="workspace-hidden">
      <button
        type="button"
        className="workspace-hidden__toggle"
        aria-expanded={open}
        data-testid={`workspace-hidden-${projectId}`}
        onClick={() => setOpen(!open)}
      >
        {count} hidden worktree{count === 1 ? "" : "s"}
      </button>
      {open && workspaces.map((workspace) => (
        <div className="workspace-hidden__row" key={workspace.id} title={workspace.path}>
          <span className="workspace-entry__body">
            <strong>{workspace.branch || basename(workspace.path)}</strong>
            <span>{workspace.path}</span>
          </span>
          <button
            type="button"
            className="worktree-job__action"
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
            className={"workspace-entry worktree-job" + (failed ? " worktree-job--failed" : "")}
            key={job.jobId}
            data-testid={`worktree-job-${job.branch}`}
            role="status"
          >
            <div className="workspace-entry__button worktree-job__row" title={job.path}>
              <span className="workspace-entry__dot" aria-hidden="true">{failed ? "✕" : "◌"}</span>
              <span className="workspace-entry__body">
                <strong>{job.branch}</strong>
                <span data-testid={`worktree-job-phase-${job.branch}`}>{failed ? "Create failed" : `${job.phase}…`}</span>
              </span>
              {job.status === "running" && (
                <button type="button" className="worktree-job__action" data-testid={`worktree-job-cancel-${job.branch}`} onClick={() => cancel(job.jobId)}>
                  Cancel
                </button>
              )}
              {failed && (
                <>
                  <button type="button" className="worktree-job__action" data-testid={`worktree-job-retry-${job.branch}`} onClick={() => retry(job.jobId)}>
                    Retry
                  </button>
                  <button type="button" className="worktree-job__action" data-testid={`worktree-job-dismiss-${job.branch}`} onClick={() => dismiss(job.jobId)}>
                    Dismiss
                  </button>
                </>
              )}
            </div>
            {failed && (
              <div className="worktree-job__error" data-testid={`worktree-job-error-${job.branch}`} title={job.error}>
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
      "divider",
      { label: "Remove project", testId: `workspace-project-remove-${project.id}`, danger: true, onSelect: () => setRemovingProject(project) },
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

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");

  // The home screen's "Add project" (NoSessionPanel.tsx) opens this form.
  useEffect(() => {
    const open = () => setAddOpen(true);
    window.addEventListener(ADD_PROJECT_EVENT, open);
    return () => window.removeEventListener(ADD_PROJECT_EVENT, open);
  }, []);

  useEffect(() => {
    if (createRequest?.status !== "success") return;
    setName("");
    setAddOpen(false);
    clearCreateRequest();
  }, [clearCreateRequest, createRequest?.status]);

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
    createWorkspaceProject(path, name, activeHostId);
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

  function navigateToProject(projectId: string) {
    focusWorkspaceProject(projectId);
    const nextSession = sessionsForProject(projectId)[0];
    if (nextSession) {
      if (nextSession.id !== sessionId) switchSession(nextSession.id);
    } else {
      const state = usePerchStore.getState();
      const project = projects.find((candidate) => candidate.id === projectId);
      const workspace = workspaces.find((candidate) => candidate.id === state.activeWorkspaceId);
      if (project) openEmptyWorkspace(project.hostId, workspace?.path ?? project.path);
    }
    onNavigate?.();
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

  // After the projects, inside their scrolling list (or after the empty state).
  const chatsSection = chatsProject && (() => {
        const chats = sessionsForProject(chatsProject.id);
        const chatsCollapsed = collapsed.includes(chatsProject.id);
        const chatsWorkspace = workspacesForProject(workspaces, chatsProject.id)[0];
        return (
          <div className="workspace-chats" data-testid="workspace-chats">
            <div className="workspace-project__header">
              <button
                type="button"
                className="workspace-chats__title"
                data-testid="workspace-chats-collapse"
                aria-expanded={!chatsCollapsed}
                onClick={() => toggleCollapsed(chatsProject.id)}
              >
                Chats <span aria-hidden="true">{chatsCollapsed ? "›" : "⌄"}</span>
              </button>
              {chats.length > 0 && (
                <button
                  type="button"
                  className="workspace-project__icon"
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
                className="workspace-chats__new"
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
                ✎
              </button>
            </div>
            {!chatsCollapsed && chats.length > 0 && (
              <div className="workspace-chats__list">
                {chats.map((session) => (
                  <div className="workspace-entry__session-row" key={session.id}>
                    <button
                      type="button"
                      className={"workspace-entry__session workspace-chats__chat" + (session.id === sessionId ? " workspace-entry__session--active" : "")}
                      data-testid={`workspace-session-${session.id}`}
                      title={session.title || "New chat"}
                      onClick={() => {
                        switchSession(session.id);
                        onNavigate?.();
                      }}
                    >
                      <StatusDot session={session} />
                      <span>{session.title || "New chat"}</span>
                    </button>
                    <button
                      type="button"
                      className="workspace-entry__session-close"
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
      className={"workspace-overview" + (compact ? " workspace-overview--compact" : "")}
      data-testid="workspace-overview"
      aria-label="Projects and workspaces"
    >
      <div className="workspace-overview__heading">
        <div>
          <span className="workspace-overview__eyebrow">Projects</span>
          <span className="workspace-overview__count">
            {visibleProjects.length ? `${visibleProjects.length} project${visibleProjects.length === 1 ? "" : "s"}` : "No projects"}
          </span>
        </div>
        <div className="workspace-overview__heading-actions">
          <button
            type="button"
            className="workspace-overview__icon-button"
            title="Refresh projects"
            aria-label="Refresh projects"
            data-testid="workspace-refresh"
            onClick={() => fetchWorkspaceSnapshot(activeHostId)}
          >
            ↻
          </button>
          <button
            type="button"
            className="workspace-overview__add-button"
            data-testid="workspace-add-project"
            onClick={() => setAddOpen((open) => !open)}
          >
            + Add
          </button>
        </div>
      </div>

      {addOpen && (
        <div className="workspace-overview__add-form" data-testid="workspace-add-form">
          <label>
            <span>Name <em>optional</em></span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Project name"
              data-testid="workspace-project-name"
            />
          </label>
          {/* Same folder picker as "+ New session"; its "Use this folder" registers. */}
          <DirectoryBrowser hostId={activeHostId} onUseFolder={submitProject} />
          <div className="workspace-overview__form-actions">
            <button type="button" className="workspace-overview__quiet-button" disabled={createRequest?.status === "pending"} onClick={() => setAddOpen(false)}>
              Cancel
            </button>
          </div>
          {createRequest?.status === "pending" && <span className="workspace-overview__form-status" role="status">Registering folder…</span>}
          {createRequest?.status === "error" && <span className="workspace-overview__form-status workspace-overview__form-status--error" role="alert">{createRequest.error || "Could not register this folder."}</span>}
        </div>
      )}

      {snapshot?.state === "loading" && (
        <div className="workspace-overview__state" role="status">Loading workspace…</div>
      )}
      {snapshot?.state === "error" && (
        <div className="workspace-overview__state workspace-overview__state--error" role="alert">
          {snapshot.error || "Workspace could not be loaded."}
          <button type="button" onClick={() => fetchWorkspaceSnapshot(activeHostId)}>Retry</button>
        </div>
      )}

      {visibleProjects.length === 0 && snapshot?.state !== "loading" && (
        <div className="workspace-overview__empty">
          <span className="workspace-overview__empty-mark" aria-hidden="true">＋</span>
          <strong>Register a project</strong>
          <span>Projects keep sessions, checkouts, and files together.</span>
          {!addOpen && (
            <button type="button" onClick={() => setAddOpen(true)} data-testid="workspace-empty-add">
              Register folder
            </button>
          )}
        </div>
      )}
      <div className="workspace-overview__list" data-testid="project-list">
          {visibleProjects.map((project) => {
            const allWorkspaces = workspacesForProject(workspaces, project.id);
            const projectWorkspaces = allWorkspaces.filter((w) => !w.hidden);
            const hiddenWorkspaces = allWorkspaces.filter((w) => w.hidden);
            const projectJobs = project.hostId === "local"
              ? worktreeJobs.filter((job) => job.repoPath === project.repoPath || job.repoPath === project.path)
              : [];
            const projectActive = project.id === activeProjectId;
            const projectCollapsed = collapsed.includes(project.id);
            return (
              <div
                className={"workspace-project" + (projectActive ? " workspace-project--active" : "")}
                key={project.id}
                data-testid={`workspace-project-${project.id}`}
              >
                <div
                  className="workspace-project__header"
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenu({ x: event.clientX, y: event.clientY, label: "Project actions", items: projectMenu(project) });
                  }}
                >
                {renamingProjectId === project.id ? (
                  <input
                    className="workspace-entry__rename"
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
                  className="workspace-project__button"
                  aria-pressed={projectActive}
                  onClick={() => navigateToProject(project.id)}
                  title={project.path}
                >
                  <span className="workspace-project__marker" aria-hidden="true">{project.favorite ? "◆" : "◇"}</span>
                  <span className="workspace-project__body">
                    <strong>{project.name || basename(project.path)}</strong>
                  </span>
                </button>
                )}
                <button
                  type="button"
                  className="workspace-project__icon"
                  data-testid={`workspace-project-collapse-${project.id}`}
                  aria-expanded={!projectCollapsed}
                  title={projectCollapsed ? "Show workspaces and sessions" : "Collapse"}
                  aria-label={projectCollapsed ? "Expand project" : "Collapse project"}
                  onClick={() => toggleCollapsed(project.id)}
                >
                  {projectCollapsed ? "›" : "⌄"}
                </button>
                <button
                  type="button"
                  className="workspace-project__icon"
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
                {project.repoPath ? <WorktreeMenu hostId={project.hostId} cwd={project.repoPath} projectKey={`${project.hostId}:${project.repoPath}`} /> : (
                  <button
                    type="button"
                    className="worktree-menu__btn"
                    data-testid={`workspace-project-new-session-${project.id}`}
                    title="New session in this folder"
                    aria-label="New session"
                    onClick={(event) => setNewSession({ project, rect: event.currentTarget.getBoundingClientRect() })}
                  >
                    +
                  </button>
                )}
                </div>
                {!projectCollapsed && (allWorkspaces.length > 0 || projectJobs.length > 0) && (
                  <div className="workspace-project__workspaces">
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
                          className="workspace-entry"
                          data-testid={`workspace-entry-${workspace.id}`}
                          onContextMenu={(event) => {
                            if ((event.target as HTMLElement).closest(".workspace-entry__sessions")) return;
                            event.preventDefault();
                            setMenu({ x: event.clientX, y: event.clientY, label: "Workspace actions", items: workspaceMenu(project, workspace) });
                          }}
                        >
                          {renamingId === workspace.id ? (
                            <input
                              className="workspace-entry__rename"
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
                          <button
                            type="button"
                            className={"workspace-entry__button" + (workspaceActive ? " workspace-entry__button--active" : "")}
                            aria-pressed={workspaceActive}
                            onClick={() => navigateToWorkspace(workspace.id)}
                            title={workspace.path}
                          >
                            <span className="workspace-entry__dot" aria-hidden="true">{workspace.dirty ? "●" : "○"}</span>
                            <span className="workspace-entry__body">
                              <strong
                                title="Double-click to rename"
                                onDoubleClick={(event) => {
                                  event.stopPropagation();
                                  setRenamingId(workspace.id);
                                }}
                              >
                                {workspace.name || basename(workspace.path)}
                              </strong>
                              <span>{workspace.branch || workspace.path}</span>
                            </span>
                            {/* Only what needs attention; "ready" is the norm. */}
                            {(workspace.pinned || workspace.state === "sleeping" || workspace.dirty) && (
                              <span className="workspace-entry__state">
                                {[workspace.pinned && "pinned", workspace.state === "sleeping" ? "sleeping" : workspace.dirty && "dirty"].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </button>
                          )}
                          {/* Desktop uses the right-click menu; the phone has no
                              right-click, so it keeps these buttons. */}
                          {compact && (
                          <div className="workspace-entry__actions">
                          <button
                            type="button"
                            className="workspace-entry__files workspace-entry__icon"
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
                              className="workspace-entry__files workspace-entry__icon"
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
                              className="workspace-entry__files workspace-entry__icon"
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
                            className="workspace-entry__files"
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
                            className="workspace-entry__files workspace-entry__git"
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
                              className="workspace-entry__restore"
                              onClick={() => restoreWorkspace(workspace.id)}
                            >
                              Restore
                            </button>
                          )}
                          {workspaceSessions.length > 0 && (
                            <div className="workspace-entry__sessions">
                              {workspaceSessions.map((session) => (
                                <div className="workspace-entry__session-row" key={session.id}>
                                  <button
                                    type="button"
                                    className={"workspace-entry__session" + (session.id === sessionId ? " workspace-entry__session--active" : "")}
                                    data-testid={`workspace-session-${session.id}`}
                                    onClick={() => {
                                      switchSession(session.id);
                                      onNavigate?.();
                                    }}
                                  >
                                    <StatusDot session={session} />
                                    <span>{session.title || "New session"}</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="workspace-entry__session-close"
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
                          )}
                        </div>
                        {(children.get(workspace.id) ?? []).length > 0 && depth < 8 && (
                          <div className="workspace-entry__children" data-testid={`workspace-children-${workspace.id}`}>
                            {(children.get(workspace.id) ?? []).map((child) => renderWorkspace(child, depth + 1))}
                          </div>
                        )}
                        </Fragment>
                      );
                      };
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
