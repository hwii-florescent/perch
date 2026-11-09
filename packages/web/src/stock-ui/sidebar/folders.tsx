//! The sidebar's list for a host without projects (no `workspace.snapshot`), part of the stock screen
//! `stock:sidebar`: one row per folder its sessions run in (the most urgent state, the name, the git branch or a
//! short path, the count), the shown folder's sessions under it. A git folder has its worktree menu here unless a
//! registered project owns it; Git & review opens through a session's workspace when the host has it; × closes
//! every session of the folder after a confirmation. Legacy mods keep their `project-row` and `session-row` slots.
import { useState } from "react";
import { agentStateColor, cn, CloseIcon, ConfirmDialog, runCommand, SessionDot, Slot, useSessionFolders, WorktreeMenu, type AgentState, type SessionFolder, type SessionInfo } from "@perch/sdk";
import { basename } from "./parts";

const ICON_BUTTON = "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent";
const GLYPH: Record<AgentState, string> = { blocked: "●", working: "●", done: "●", idle: "○", unknown: "·" };

function relativeTime(createdAt: number): string {
  const diffSec = Math.floor((Date.now() - createdAt) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

/** A row's second line when no git branch is known. */
function shortCwd(cwd: string): string {
  const parts = cwd.replace(/\/+$/, "").split("/").filter(Boolean);
  return parts.length <= 2 ? cwd : `…/${parts.slice(-2).join("/")}`;
}

function SessionItem({ session }: { session: SessionInfo }) {
  const open = () => runCommand("session.open", { id: session.id });
  // One click, no confirmation: the person asked for an immediate delete here.
  const remove = () => runCommand("session.close", { id: session.id });
  const data = { id: session.id, title: session.title, status: session.status, blocked: session.blocked, unseen: session.unseen, createdAt: session.createdAt, cwd: session.cwd, branch: session.branch, active: session.active };
  return (
    <Slot name="session-row" data={data} actions={{ open, remove }} className="pl-[0.85rem]">
      <div className="group relative flex items-stretch pl-[0.85rem]">
        <button
          type="button"
          className={cn(
            "flex w-full min-w-0 flex-1 cursor-pointer items-start gap-[0.45rem] rounded-ui px-[0.65rem] py-[0.3rem] text-left text-[0.82rem] text-fg [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-1",
            session.active ? "session-item--active bg-surface-0" : "bg-transparent",
          )}
          data-session-id={session.id}
          onClick={open}
        >
          <SessionDot id={session.id} />
          <div className="min-w-0 flex-1">
            <div className="overflow-hidden text-[0.82rem] leading-[1.3] text-ellipsis whitespace-nowrap">{session.title || "(new session)"}</div>
            <div className="mt-[0.15rem] flex gap-[0.4rem] overflow-hidden text-[0.7rem] whitespace-nowrap text-subtext-0">
              <span className="ml-auto shrink-0">{relativeTime(session.createdAt)}</span>
            </div>
          </div>
        </button>
        <button
          type="button"
          className="hidden w-[1.6rem] shrink-0 cursor-pointer items-center justify-center rounded-ui bg-transparent p-0 text-[0.85rem] text-subtext-0 [transition:color_0.1s_ease,background_0.1s_ease] group-focus-within:flex group-hover:flex hover:bg-surface-1 hover:text-red"
          data-testid={`session-delete-icon-${session.id}`}
          title="Delete session"
          aria-label="Delete session"
          onClick={(e) => {
            e.stopPropagation();
            remove();
          }}
        >
          🗑
        </button>
      </div>
    </Slot>
  );
}

/** The branch with ↑ahead / ↓behind, else a short path. */
function FolderSubline({ folder, hostId }: { folder: SessionFolder; hostId: string }) {
  const { git } = folder;
  if (!git) return <span className="overflow-hidden text-[0.7rem] text-ellipsis whitespace-nowrap text-subtext-0" title={folder.cwd}>{shortCwd(folder.cwd)}</span>;
  return (
    <span className="flex min-w-0 items-center gap-[0.3rem] overflow-hidden text-[0.7rem] text-subtext-0" data-testid={`workspace-git-${hostId}`} title={git.branch}>
      <span className="max-w-32 overflow-hidden text-ellipsis whitespace-nowrap">{git.branch}</span>
      {git.ahead > 0 && <span className="shrink-0 font-semibold" style={{ color: "var(--green)" }}>↑{git.ahead}</span>}
      {git.behind > 0 && <span className="shrink-0 font-semibold" style={{ color: "var(--red)" }}>↓{git.behind}</span>}
    </span>
  );
}

/** A git folder's worktree menu; a registered project's own list owns it. Not a git folder: a disabled glyph that
 * says why, never a menu that would ask for worktrees of a non-repository. */
function FolderWorktrees({ folder, hostId }: { folder: SessionFolder; hostId: string }) {
  if (folder.registered) return null;
  if (!folder.git) {
    return (
      <span
        className={cn("worktree-menu__btn", ICON_BUTTON, "cursor-default text-overlay-0 opacity-60 hover:bg-transparent hover:text-overlay-0")}
        data-testid={`worktree-menu-disabled-${hostId}-${folder.cwd}`}
        title="Not a git repository — worktrees unavailable"
        aria-disabled="true"
      >
        ⑂
      </span>
    );
  }
  return <WorktreeMenu hostId={hostId} path={folder.cwd} />;
}

function FolderRow({ folder, hostId }: { folder: SessionFolder; hostId: string }) {
  const [confirmingCloseAll, setConfirmingCloseAll] = useState(false);
  const name = basename(folder.cwd);
  const count = folder.sessions.length;
  const select = () => runCommand("folder.select", { cwd: folder.cwd, host: hostId });
  return (
    <div className="mb-1">
      <div className="sidebar__project-header flex items-stretch gap-[2px] px-[3px]">
        <Slot
          name="project-row"
          className="flex min-w-0 flex-1"
          data={{ cwd: folder.cwd, name, state: folder.state, sessionCount: count, active: folder.active, hostId }}
          actions={{ open: select, closeAll: () => setConfirmingCloseAll(true) }}
        >
          <button
            type="button"
            className={cn(
              "flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-ui px-3 py-[3px] text-left text-fg [font-family:inherit] [transition:background_0.1s_ease]",
              // An active row keeps its fill under the pointer.
              folder.active ? "bg-surface-0" : "bg-transparent hover:bg-surface-1",
            )}
            data-testid="project-row"
            data-project-cwd={folder.cwd}
            aria-current={folder.active ? "true" : undefined}
            title={folder.cwd}
            onClick={select}
          >
            <span className={`agent-status-dot agent-status-dot--${folder.state} shrink-0 text-[0.7rem] leading-none`} style={{ color: agentStateColor(folder.state) }} title={`status: ${folder.state}`} aria-hidden="true">
              {GLYPH[folder.state]}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-[0.1rem]">
              <span className="min-w-0 overflow-hidden text-[0.82rem] font-semibold text-ellipsis whitespace-nowrap text-fg" title={folder.cwd}>{name}</span>
              <span className="flex min-w-0 items-center overflow-hidden"><FolderSubline folder={folder} hostId={hostId} /></span>
            </span>
            <span className="shrink-0 rounded-ui bg-surface-1 px-[0.35rem] py-[0.05rem] text-[0.68rem] text-subtext-0">{count}</span>
          </button>
        </Slot>
        <FolderWorktrees folder={folder} hostId={hostId} />
        {folder.reviewWorkspaceId && (
          <button
            type="button"
            className={cn("worktree-menu__btn", ICON_BUTTON)}
            data-testid={`project-git-review-${hostId}`}
            title="Git & review"
            aria-label="Open Git and review"
            onClick={(event) => {
              event.stopPropagation();
              runCommand("workspace.git", { id: folder.reviewWorkspaceId });
            }}
          >
            ±
          </button>
        )}
        <button
          type="button"
          className={cn(ICON_BUTTON, "self-center")}
          data-testid="project-close-all"
          title="Close all sessions in this project"
          aria-label="Close all sessions in this project"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmingCloseAll(true);
          }}
        >
          <CloseIcon size={12} />
        </button>
      </div>
      {folder.active && folder.sessions.map((session) => <SessionItem key={session.id} session={session} />)}
      {confirmingCloseAll && (
        <ConfirmDialog
          message={`Close all ${count} session${count === 1 ? "" : "s"} in "${name}"? Their agents and shells end; the folder and the agents' transcripts stay on disk.`}
          confirmLabel="Close all"
          cancelLabel="Cancel"
          onConfirm={() => {
            // The folder's own sessions at click time, never another folder's.
            for (const session of folder.sessions) runCommand("session.close", { id: session.id });
            setConfirmingCloseAll(false);
          }}
          onCancel={() => setConfirmingCloseAll(false)}
        />
      )}
    </div>
  );
}

/** The session list of a host without projects: the sidebar's fallback, and the phone switcher's. */
export function FolderList() {
  const { hostId, folders } = useSessionFolders();
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-[3px] py-[3px]" data-testid="project-list">
      {folders.length === 0
        ? <p className="mx-[0.65rem] my-[0.6rem] text-[0.72rem] text-subtext-0">No projects yet.</p>
        : folders.map((folder) => <FolderRow key={folder.key} folder={folder} hostId={hostId} />)}
    </div>
  );
}
