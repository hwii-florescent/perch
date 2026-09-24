import { FormEvent, Fragment, type ReactElement, useEffect, useMemo, useState } from "react";
import { usePerchStore, type WorkspaceProject, type WorkspaceRecord } from "../store";
import { StatusDot } from "./StatusDot";
import { WorktreeMenu } from "./WorktreeMenu";
import type { SessionSummary, WorktreeJob } from "@perch/shared";

function basename(path: string): string {
  const parts = path.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || path;
}

function projectDetail(project: WorkspaceProject): string {
  if (project.defaultBranch) return `${project.defaultBranch} · ${project.path}`;
  return project.path;
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

function sessionsForWorkspace(
  sessions: SessionSummary[],
  workspace: WorkspaceRecord,
): SessionSummary[] {
  return sessions
    .filter((session) => {
      if (session.archived) return false;
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

  const [addOpen, setAddOpen] = useState(false);
  const [path, setPath] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (createRequest?.status !== "success") return;
    setPath("");
    setName("");
    setAddOpen(false);
    clearCreateRequest();
  }, [clearCreateRequest, createRequest?.status]);

  const visibleProjects = useMemo(
    () => projects
      .filter((project) => project.hostId === activeHostId && !project.archived)
      .sort((a, b) => {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      }),
    [activeHostId, projects],
  );

  function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!path.trim() || createRequest?.status === "pending") return;
    createWorkspaceProject(path, name, activeHostId);
  }

  function sessionsForProject(projectId: string): SessionSummary[] {
    const projectWorkspaces = workspacesForProject(workspaces, projectId);
    return projectWorkspaces
      .flatMap((workspace) => sessionsForWorkspace(sessions, workspace))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  function navigateToProject(projectId: string) {
    focusWorkspaceProject(projectId);
    const nextSession = sessionsForProject(projectId)[0];
    if (nextSession && nextSession.id !== sessionId) switchSession(nextSession.id);
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
    if (!workspaceSessions.some((candidate) => candidate.id === sessionId) && workspaceSessions[0]) {
      switchSession(workspaceSessions[0].id);
    }
    onNavigate?.();
  }

  return (
    <section
      className={"workspace-overview" + (compact ? " workspace-overview--compact" : "")}
      data-testid="workspace-overview"
      aria-label="Projects and workspaces"
    >
      <div className="workspace-overview__heading">
        <div>
          <span className="workspace-overview__eyebrow">Workspace</span>
          <span className="workspace-overview__count">
            {visibleProjects.length ? `${visibleProjects.length} project${visibleProjects.length === 1 ? "" : "s"}` : "No projects"}
          </span>
        </div>
        <div className="workspace-overview__heading-actions">
          <button
            type="button"
            className="workspace-overview__icon-button"
            title="Refresh workspace"
            aria-label="Refresh workspace"
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
        <form className="workspace-overview__add-form" onSubmit={submitProject}>
          <label>
            <span>Folder path</span>
            <input
              autoFocus
              value={path}
              onChange={(event) => setPath(event.target.value)}
              placeholder="/path/to/project"
              data-testid="workspace-project-path"
            />
          </label>
          <label>
            <span>Name <em>optional</em></span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Project name"
              data-testid="workspace-project-name"
            />
          </label>
          <div className="workspace-overview__form-actions">
            <button type="button" className="workspace-overview__quiet-button" disabled={createRequest?.status === "pending"} onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="workspace-overview__primary-button" disabled={!path.trim() || createRequest?.status === "pending"}>
              Register project
            </button>
          </div>
          {createRequest?.status === "pending" && <span className="workspace-overview__form-status" role="status">Registering folder…</span>}
          {createRequest?.status === "error" && <span className="workspace-overview__form-status workspace-overview__form-status--error" role="alert">{createRequest.error || "Could not register this folder."}</span>}
        </form>
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

      {visibleProjects.length === 0 && snapshot?.state !== "loading" ? (
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
      ) : (
        <div className="workspace-overview__list" data-testid="project-list">
          {visibleProjects.map((project) => {
            const allWorkspaces = workspacesForProject(workspaces, project.id);
            const projectWorkspaces = allWorkspaces.filter((w) => !w.hidden);
            const hiddenWorkspaces = allWorkspaces.filter((w) => w.hidden);
            const projectJobs = project.hostId === "local"
              ? worktreeJobs.filter((job) => job.repoPath === project.repoPath || job.repoPath === project.path)
              : [];
            const projectActive = project.id === activeProjectId;
            return (
              <div
                className={"workspace-project" + (projectActive ? " workspace-project--active" : "")}
                key={project.id}
                data-testid={`workspace-project-${project.id}`}
              >
                <div className="workspace-project__header">
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
                    <span>{projectDetail(project)}</span>
                  </span>
                  <span className="workspace-project__chevron" aria-hidden="true">›</span>
                </button>
                {project.repoPath && <WorktreeMenu hostId={project.hostId} cwd={project.repoPath} projectKey={`${project.hostId}:${project.repoPath}`} />}
                </div>
                {(allWorkspaces.length > 0 || projectJobs.length > 0) && (
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
                        <div className="workspace-entry" data-testid={`workspace-entry-${workspace.id}`}>
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
                            <span className="workspace-entry__state">
                              {workspace.pinned ? "pinned · " : ""}
                              {workspace.state === "sleeping" ? "sleeping" : workspace.dirty ? "dirty" : "ready"}
                            </span>
                          </button>
                          )}
                          <div className="workspace-entry__actions">
                          <button
                            type="button"
                            className="workspace-entry__files"
                            data-testid={`workspace-pin-${workspace.id}`}
                            aria-pressed={workspace.pinned === true}
                            title={workspace.pinned ? "Unpin" : "Pin to the top of the project"}
                            onClick={(event) => {
                              event.stopPropagation();
                              pinWorkspace(workspace.id, !workspace.pinned);
                            }}
                          >
                            {workspace.pinned ? "Unpin" : "Pin"}
                          </button>
                          {workspace.parentWorkspaceId && (
                            <button
                              type="button"
                              className="workspace-entry__files"
                              data-testid={`workspace-hide-${workspace.id}`}
                              title="Hide from the sidebar (the checkout stays)"
                              onClick={(event) => {
                                event.stopPropagation();
                                setWorkspaceHidden(workspace.id, true);
                              }}
                            >
                              Hide
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
                          <button
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
                          </button>
                          </div>
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
                                <button
                                  type="button"
                                  className="workspace-entry__session"
                                  key={session.id}
                                  data-testid={`workspace-session-${session.id}`}
                                  onClick={() => {
                                    switchSession(session.id);
                                    onNavigate?.();
                                  }}
                                >
                                  <StatusDot session={session} />
                                  <span>{session.title || "New session"}</span>
                                </button>
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
        </div>
      )}
    </section>
  );
}
