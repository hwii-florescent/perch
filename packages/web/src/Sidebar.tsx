/**
 * Sidebar.tsx — herdr-style "spaces" navigation.
 *
 * Three stacked levels, top to bottom:
 *
 *  1. **Host switcher** — the environment chip is a button; clicking it opens
 *     a popover listing "local" plus every configured federated host with its
 *     live connection state. Picking one makes it the *active host*; the rest
 *     of the sidebar (and the tab bar) re-scopes to it. This replaces the old
 *     layout, which stacked one section per host vertically and showed every
 *     host's sessions at once.
 *  2. **Project list** — one row per distinct session cwd on the active host,
 *     styled after herdr's spaces list (aggregate status dot, project name,
 *     dimmer second line carrying the git branch, or a shortened cwd when the
 *     project isn't a git checkout). Clicking a row makes it the *active
 *     project*.
 *  3. **Sessions of the active project** — rendered inline under that row;
 *     every other project stays a compact one-row entry.
 *
 * `activeHostId` / `activeProject` live in the zustand store (persisted to
 * localStorage) so the tab bar, the leader-key chords and the sidebar all
 * agree on one scope — see `effectiveActiveProject` in `store.ts`.
 *
 * Host add/remove/enable/disable still live in Settings → SSH Hosts (they
 * always have); the switcher popover carries an inline enabled checkbox per
 * remote host plus a "Manage hosts…" shortcut into that section so nothing
 * became less reachable when the per-host sidebar sections went away.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  usePerchStore,
  projectsForHost,
  effectiveActiveProject,
  sessionIdsForProject,
  type ProjectGroup,
} from "./store";
import { StatusDot } from "./components/StatusDot";
import { WorktreeMenu } from "./components/WorktreeMenu";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { AgentPicker, useAgentChoices } from "./components/AgentPicker";
import { AgentIcon } from "./components/AgentIcon";
import { menuItem } from "./components/ui/menu";
import { CATALOG_ACTION } from "./components/ui/settings";
import { WorkspaceOverview } from "./components/WorkspaceOverview";
import { HostStateDot } from "./components/HostStateDot";
import { cn } from "./lib/cn";
import { ICON_BUTTON } from "./components/ui/icon-button";
import { segment } from "./components/ui/segment";
import { sessionDotState, DOT_GLYPH, type AgentDotState } from "./statusDot";
import type { SessionSummary, SshHostEntry, HostConnectionState } from "@perch/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(createdAt: number): string {
  const diffMs = Date.now() - createdAt;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

/** Extract the last path segment as a project display name. */
function basename(cwd: string): string {
  const parts = cwd.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || cwd;
}

/** Compact fallback for a project row's second line when no git branch is
 * known (non-git cwd, or the server's poll hasn't reported one yet). */
function shortCwd(cwd: string): string {
  const parts = cwd.replace(/\/+$/, "").split("/").filter(Boolean);
  if (parts.length <= 2) return cwd;
  return `…/${parts.slice(-2).join("/")}`;
}

// ---------------------------------------------------------------------------
// EnvHeader — the local host's chip content (badge + hostname + os + cwd)
// ---------------------------------------------------------------------------

interface EnvHeaderProps {
  hostname: string | undefined;
  isSsh: boolean | undefined;
  platform: string | undefined;
  cwd: string | undefined;
  branch: string | undefined;
}

const ENV_BADGE = "sidebar__env-badge shrink-0 rounded-ui border px-[0.4rem] py-[0.15rem] text-[0.65rem] font-bold tracking-[0.06em] uppercase";
const ENV_BADGE_LOCAL = `${ENV_BADGE} border-[color:color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-accent`;
const ENV_BADGE_REMOTE = `${ENV_BADGE} border-[color:color-mix(in_srgb,var(--yellow)_30%,transparent)] bg-[color-mix(in_srgb,var(--yellow)_15%,transparent)] text-yellow`;
const ENV_BADGE_SSH = `${ENV_BADGE} border-[color:color-mix(in_srgb,var(--blue)_30%,transparent)] bg-[color-mix(in_srgb,var(--blue)_15%,transparent)] text-blue`;
const ENV_ROW = "flex flex-wrap items-center gap-[0.4rem]";
const ENV_HOST = "sidebar__env-host min-w-0 overflow-hidden text-[0.75rem] font-medium text-ellipsis whitespace-nowrap text-fg";
const ENV_PLATFORM = "ml-auto text-[0.7rem] text-subtext-0";
const ENV_CWD = "sidebar__env-cwd mt-[0.3rem] overflow-hidden text-[0.7rem] text-ellipsis whitespace-nowrap text-subtext-0";
// Lives inside the host-switcher button, which owns the bottom border.
const ENV = "min-w-0 flex-1 px-[0.65rem] pt-[0.6rem] pb-2";

function envBadgeClass(isSsh: boolean | undefined): string {
  if (isSsh) return ENV_BADGE_SSH;
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") return ENV_BADGE_LOCAL;
  return ENV_BADGE_REMOTE;
}

function envBadgeLabel(isSsh: boolean | undefined): string {
  if (isSsh) return "SSH";
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") return "LOCAL";
  return "REMOTE";
}

function EnvHeader({ hostname, isSsh, platform, cwd, branch }: EnvHeaderProps) {
  const badgeClass = envBadgeClass(isSsh);
  const badgeLabel = envBadgeLabel(isSsh);

  return (
    <div className={ENV}>
      <div className={ENV_ROW}>
        <span className={badgeClass}>{badgeLabel}</span>
        {hostname && <span className={ENV_HOST}>{hostname}</span>}
        {platform && <span className={ENV_PLATFORM}>{platform}</span>}
      </div>
      {cwd && (
        <div className={ENV_CWD} title={cwd}>
          {cwd}
          {branch ? ` (${branch})` : ""}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Host switcher
// ---------------------------------------------------------------------------

interface HostChoice {
  id: string;
  name: string;
  state: HostConnectionState;
  error?: string;
  /** Secondary line: ssh target / direct URL for remotes, platform for local. */
  detail?: string;
  /** Remote hosts only — drives the inline enabled checkbox. */
  entry?: SshHostEntry;
  /** True for `mode: "direct"` hosts (no perch on the remote; hosted turns
   *  run detached over SSH). Surfaced as a badge so it's obvious *which*
   *  kind of remote a session is about to be created on — the two behave
   *  very differently on disconnect. */
  direct?: boolean;
}

const POPOVER_PICK = "flex w-full cursor-pointer flex-col bg-transparent px-3 pt-[0.45rem] pb-[0.35rem] text-left text-[0.82rem] font-semibold text-fg [font-family:inherit] [border:none] [transition:background_0.1s_ease] hover:bg-surface-1";
const POPOVER_PICK_CWD = "mt-[0.1rem] overflow-hidden text-[0.7rem] font-normal text-ellipsis whitespace-nowrap text-subtext-0";
const POPOVER_ITEM = "flex min-w-0 flex-1 cursor-pointer items-center gap-[0.45rem] bg-transparent px-[0.6rem] py-[0.45rem] text-left text-[0.8rem] text-fg [font-family:inherit] [border:none] hover:bg-surface-1";

function HostSwitcherPopover({
  choices,
  activeHostId,
  anchorRect,
  onClose,
  onSelect,
  onToggleEnabled,
  onManage,
}: {
  choices: HostChoice[];
  activeHostId: string;
  anchorRect: DOMRect;
  onClose: () => void;
  onSelect: (hostId: string) => void;
  onToggleEnabled: (entry: SshHostEntry) => void;
  onManage: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);

  const top = anchorRect.bottom + 4;
  const style: React.CSSProperties = {
    position: "fixed",
    top,
    left: anchorRect.left,
    zIndex: 9999,
    minWidth: Math.max(anchorRect.width, 200),
    maxHeight: `min(70vh, calc(100vh - ${top}px - 12px))`,
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current?.contains(e.target as Node)) return;
      onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="flex max-w-[320px] min-w-[200px] flex-col overflow-hidden rounded-ui border border-accent bg-panel-bg shadow-[0_8px_24px_rgba(0,0,0,0.45)]" data-testid="host-switcher-popover" ref={popoverRef} style={style}>
      <div className="min-h-0 overflow-y-auto">
        {choices.map((choice) => (
          <div
            key={choice.id}
            className={cn("host-switcher-popover__row flex flex-col", choice.id === activeHostId && "bg-surface-0")}
          >
            <div className="flex items-center">
              <button
                type="button"
                className={POPOVER_ITEM}
                data-testid={`host-option-${choice.id}`}
                title={choice.detail ?? choice.name}
                onClick={() => {
                  onSelect(choice.id);
                  onClose();
                }}
              >
                <HostStateDot state={choice.state} error={choice.error} />
                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{choice.name}</span>
                {choice.direct && (
                  <span
                    className="shrink-0 rounded-[3px] px-[0.3rem] py-[0.05rem] text-[0.6rem] tracking-[0.04em] text-mauve uppercase"
                    data-testid={`host-direct-badge-${choice.id}`}
                    title="Direct mode: no perch on the remote — turns run detached over SSH and survive disconnects"
                  >
                    direct
                  </span>
                )}
                <span className="shrink-0 text-[0.66rem] tracking-[0.04em] text-subtext-0 uppercase">{choice.state}</span>
              </button>
              {choice.entry && (
                <label className="flex cursor-pointer items-center pr-2" title="Enabled">
                  <input
                    type="checkbox"
                    data-testid={`host-toggle-${choice.id}`}
                    checked={choice.entry.enabled}
                    onChange={() => onToggleEnabled(choice.entry as SshHostEntry)}
                  />
                </label>
              )}
            </div>
            {choice.state === "error" && choice.error && (
              <div
                className="overflow-hidden pr-[0.6rem] pb-[0.4rem] pl-[1.55rem] text-[0.68rem] text-ellipsis whitespace-nowrap text-red"
                data-testid={`host-error-${choice.id}`}
                title={choice.error}
              >
                {choice.error}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="h-px bg-overlay-0" />
      <button
        type="button"
        className="cursor-pointer bg-transparent px-[0.6rem] py-[0.45rem] text-left text-[0.75rem] text-accent [font-family:inherit] [border:none] hover:bg-surface-1"
        data-testid="host-switcher-manage"
        onClick={() => {
          onManage();
          onClose();
        }}
      >
        Manage hosts…
      </button>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// SessionItem
// ---------------------------------------------------------------------------

interface SessionItemProps {
  session: SessionSummary;
  isActive: boolean;
  onSwitch: (id: string) => void;
  onDelete: (sessionId: string) => void;
}

function SessionItem({ session, isActive, onSwitch, onDelete }: SessionItemProps) {
  return (
    <div className="group relative flex items-stretch pl-[0.85rem]">
      <button
        type="button"
        className={cn(
          "flex w-full min-w-0 flex-1 cursor-pointer items-start gap-[0.45rem] border-current px-[0.65rem] py-[0.3rem] text-left text-[0.82rem] text-fg [font-family:inherit] [border-style:none_none_none_solid] border-l-2 [transition:background_0.1s_ease,border-color_0.1s_ease] hover:bg-surface-1",
          isActive ? "session-item--active bg-surface-0 border-l-accent" : "bg-transparent border-l-transparent",
        )}
        data-session-id={session.id}
        onClick={() => onSwitch(session.id)}
      >
        <StatusDot session={session} />
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden text-[0.82rem] leading-[1.3] text-ellipsis whitespace-nowrap">
            {session.title || "(new session)"}
          </div>
          <div className="mt-[0.15rem] flex gap-[0.4rem] overflow-hidden text-[0.7rem] whitespace-nowrap text-subtext-0">
            <span className="ml-auto shrink-0">{relativeTime(session.createdAt)}</span>
          </div>
        </div>
      </button>
      {/* No confirmation: the user asked for a one-click, immediate delete
       * (unlike the multi-tab terminal-group close and worktree-remove
       * confirmations, which still route through ConfirmDialog). */}
      <button
        type="button"
        className="hidden w-[1.6rem] shrink-0 cursor-pointer items-center justify-center border-current bg-transparent p-0 text-[0.85rem] text-subtext-0 [border-style:none_none_none_solid] border-l border-l-transparent [transition:color_0.1s_ease,background_0.1s_ease] group-focus-within:flex group-hover:flex hover:bg-surface-1 hover:text-red"
        data-testid={`session-delete-icon-${session.id}`}
        title="Delete session"
        aria-label="Delete session"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(session.id);
        }}
      >
        🗑
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project rows
// ---------------------------------------------------------------------------

/** Renders `branch` (if known) plus `↑n`/`↓n` glyphs (ahead/behind), only
 * showing the glyphs when non-zero. Returns `null` entirely when no git
 * status has been received yet for this project (e.g. non-git cwd, or the
 * poll hasn't run yet) — the row then falls back to a shortened cwd. */
function ProjectGitStatus({ projectKey, hostId }: { projectKey: string; hostId: string }) {
  const git = usePerchStore((s) => s.workspaceGit[projectKey]);
  if (!git || !git.branch) return null;
  return (
    <span className="flex min-w-0 items-center gap-[0.3rem] overflow-hidden text-[0.7rem] text-subtext-0" data-testid={`workspace-git-${hostId}`} title={git.branch}>
      <span className="max-w-32 overflow-hidden text-ellipsis whitespace-nowrap">{git.branch}</span>
      {git.ahead > 0 && (
        <span className="shrink-0 font-semibold" style={{ color: "var(--green)" }}>
          ↑{git.ahead}
        </span>
      )}
      {git.behind > 0 && (
        <span className="shrink-0 font-semibold" style={{ color: "var(--red)" }}>
          ↓{git.behind}
        </span>
      )}
    </span>
  );
}

/** The dimmer second line of a project row: git branch when the project is a
 * git checkout, a shortened cwd otherwise (herdr's spaces list always has a
 * subtitle, so never leave the row a lone name). */
function ProjectSubline({ projectKey, hostId, cwd }: { projectKey: string; hostId: string; cwd: string }) {
  const git = usePerchStore((s) => s.workspaceGit[projectKey]);
  if (git?.branch) return <ProjectGitStatus projectKey={projectKey} hostId={hostId} />;
  return (
    <span className="overflow-hidden text-[0.7rem] text-ellipsis whitespace-nowrap text-subtext-0" title={cwd}>
      {shortCwd(cwd)}
    </span>
  );
}

/** Renders the Wave 2 worktree affordance for a project, but only when the
 * project cwd is inside a git repo. `workspaceGit[projectKey].branch` is the
 * signal: the server's background poll only reports a branch for a cwd that
 * resolves to a `.git` (see `status::get_branch`), so its presence is exactly
 * "this project is a git checkout" — no extra probe needed. Rendered on every
 * project row, active or not, so the menu (and leader,W) stays reachable
 * without first switching projects. */
function ProjectWorktrees({ projectKey, hostId, cwd }: { projectKey: string; hostId: string; cwd: string }) {
  const git = usePerchStore((s) => s.workspaceGit[projectKey]);
  const registered = usePerchStore((s) => s.workspaceProjects.some((project) => project.hostId === hostId && project.repoPath === cwd));
  if (registered) return null; // The project rail owns this menu and shortcut.
  // Non-git projects have no worktrees (backend `worktree.rs list` errors on a
  // non-git cwd, matching herdr's `not_git_worktree` guard). Rather than hide
  // the affordance entirely — which left users guessing why the branch glyph
  // was missing — render a disabled, non-interactive glyph whose tooltip says
  // why. No menu is wired, so it can never fire a doomed `worktree.list`.
  if (!git || !git.branch)
    return (
      <span
        className={cn("worktree-menu__btn", ICON_BUTTON, "cursor-default text-overlay-0 opacity-60 hover:bg-transparent hover:text-overlay-0")}
        data-testid={`worktree-menu-disabled-${hostId}-${cwd}`}
        title="Not a git repository — worktrees unavailable"
        aria-disabled="true"
      >
        ⑂
      </span>
    );
  return <WorktreeMenu hostId={hostId} cwd={cwd} projectKey={projectKey} />;
}

/** Urgency ordering for the project's aggregate dot — the most attention-
 * needing session in the project wins, mirroring herdr's per-space glyph. */
const DOT_URGENCY: AgentDotState[] = ["blocked", "working", "done", "idle", "unknown"];

function aggregateDotState(sessions: SessionSummary[]): AgentDotState {
  let best: AgentDotState = "unknown";
  let bestRank = DOT_URGENCY.length;
  for (const s of sessions) {
    const state = sessionDotState(s);
    const rank = DOT_URGENCY.indexOf(state);
    if (rank !== -1 && rank < bestRank) {
      best = state;
      bestRank = rank;
    }
  }
  return best;
}

/** Git & review for a project known only through its sessions: a remote
 * host's checkout has no local workspace row, but its sessions carry the
 * owning host's workspace id, and `git.*` requests route by that id. */
function ProjectGitReviewButton({ hostId, sessions }: { hostId: string; sessions: SessionSummary[] }) {
  const supported = usePerchStore((s) =>
    (hostId === "local" ? s.serverInfo?.capabilities : s.workspaceCapabilitiesByHost[hostId])?.includes("git.status") === true,
  );
  const openWorkspaceGitReview = usePerchStore((s) => s.openWorkspaceGitReview);
  const workspaceId = sessions.find((session) => session.workspaceId)?.workspaceId;
  if (!supported || !workspaceId) return null;
  return (
    <button
      type="button"
      className={cn("worktree-menu__btn", ICON_BUTTON)}
      data-testid={`project-git-review-${hostId}`}
      title="Git & review"
      aria-label="Open Git and review"
      onClick={(event) => {
        event.stopPropagation();
        openWorkspaceGitReview(workspaceId);
      }}
    >
      ±
    </button>
  );
}

function ProjectRow({
  group,
  hostId,
  isActiveProject,
  sessionId,
  onSelectProject,
  onSwitch,
  onDelete,
}: {
  group: ProjectGroup;
  hostId: string;
  isActiveProject: boolean;
  sessionId: string | null;
  onSelectProject: (cwd: string) => void;
  onSwitch: (id: string) => void;
  onDelete: (sessionId: string) => void;
}) {
  const dotState = aggregateDotState(group.sessions);
  const { glyph, color } = DOT_GLYPH[dotState];
  // Bulk "close all sessions in this project". Requires an explicit inline
  // confirm (never `window.confirm`, which blocks the page) naming the exact
  // count before anything happens.
  const [confirmingCloseAll, setConfirmingCloseAll] = useState(false);
  const sessionCount = group.sessions.length;

  return (
    <div className="mb-1">
      <div className="sidebar__project-header flex items-stretch gap-1 px-[0.35rem]">
        <button
          type="button"
          className={cn(
            "flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-ui border-current px-[0.3rem] py-[0.4rem] text-left text-fg [font-family:inherit] [border-style:none_none_none_solid] border-l-2 [transition:background_0.1s_ease,border-color_0.1s_ease]",
            // The legacy active rule outranked :hover, so an active row keeps its fill under the pointer.
            isActiveProject ? "bg-surface-0 border-l-accent" : "bg-transparent border-l-transparent hover:bg-surface-1",
          )}
          data-testid="project-row"
          data-project-cwd={group.cwd}
          aria-current={isActiveProject ? "true" : undefined}
          title={group.cwd}
          onClick={() => onSelectProject(group.cwd)}
        >
          <span
            className={`agent-status-dot agent-status-dot--${dotState} shrink-0 text-[0.7rem] leading-none`}
            style={{ color }}
            title={`status: ${dotState}`}
            aria-hidden="true"
          >
            {glyph}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-[0.1rem]">
            <span className="min-w-0 overflow-hidden text-[0.82rem] font-semibold text-ellipsis whitespace-nowrap text-fg" title={group.cwd}>
              {basename(group.cwd)}
            </span>
            <span className="flex min-w-0 items-center overflow-hidden">
              <ProjectSubline projectKey={group.key} hostId={hostId} cwd={group.cwd} />
            </span>
          </span>
          <span className="shrink-0 rounded-ui border border-overlay-0 bg-surface-1 px-[0.35rem] py-[0.05rem] text-[0.68rem] text-subtext-0">{sessionCount}</span>
        </button>
        <ProjectWorktrees projectKey={group.key} hostId={hostId} cwd={group.cwd} />
        <ProjectGitReviewButton hostId={hostId} sessions={group.sessions} />
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
          ✕
        </button>
      </div>
      {isActiveProject &&
        group.sessions.map((s) => (
          <SessionItem
            key={s.id}
            session={s}
            isActive={s.id === sessionId}
            onSwitch={onSwitch}
            onDelete={onDelete}
          />
        ))}
      {confirmingCloseAll && (
        <ConfirmDialog
          message={`Close all ${sessionCount} session${sessionCount === 1 ? "" : "s"} in "${basename(group.cwd)}"? Their agents and shells end; the folder and the agents' transcripts stay on disk.`}
          confirmLabel="Close all"
          cancelLabel="Cancel"
          onConfirm={() => {
            // sessionIdsForProject re-derives membership from group.sessions'
            // own ids at click time rather than reusing the array reference,
            // matching the pure selection logic unit-tested in store.test.ts.
            for (const id of sessionIdsForProject(group.sessions, hostId, group.cwd)) {
              onDelete(id);
            }
            setConfirmingCloseAll(false);
          }}
          onCancel={() => setConfirmingCloseAll(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NewSessionPopover — portal popover for the "+" buttons (also used by TabBar)
// ---------------------------------------------------------------------------

export interface NewSessionPopoverProps {
  hostId: string;
  /** Known project cwds for this host, derived from existing sessions. */
  projectCwds: string[];
  /** A scoped launcher chooses only the harness, never a different project. */
  fixedCwd?: string;
  anchorRect: DOMRect;
  onClose: () => void;
  /** Provider selected before opening a session in the chosen directory. */
  onSelect: (cwd: string | undefined, agent: string) => void;
}

export function NewSessionPopover({ hostId, projectCwds, fixedCwd, anchorRect, onClose, onSelect }: NewSessionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const lastAgentChoice = usePerchStore((s) => s.lastAgentChoice);
  const setLastAgentChoice = usePerchStore((s) => s.setLastAgentChoice);
  const [selectedAgent, setSelectedAgent] = useState<string>(lastAgentChoice);
  const { connected, discovery, catalog, choices } = useAgentChoices(hostId);
  const manage = usePerchStore((s) => s.openAgentCatalog);

  // Position: open below the anchor button, left-aligned. Clamped to the
  // viewport: the project list grows one row per listed project.
  // `.new-session-popover` is a flex column (see styles/session-picker.css); this cap makes
  // the `__projects` list scroll internally.
  const top = anchorRect.bottom + 4;
  const style: React.CSSProperties = {
    position: "fixed",
    top,
    left: Math.max(12, Math.min(anchorRect.left, window.innerWidth - 344)),
    zIndex: 9999,
    minWidth: 200,
    maxHeight: `min(70vh, calc(100vh - ${top}px - 12px))`,
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current?.contains(e.target as Node)) return;
      onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="new-session-popover flex max-w-[min(320px,calc(100vw_-_24px))] min-w-[200px] flex-col overflow-hidden rounded-ui border border-accent bg-panel-bg shadow-[0_8px_24px_rgba(0,0,0,0.45)]" ref={popoverRef} style={style}>
      {fixedCwd !== undefined ? (
        <div className="min-h-0 overflow-y-auto py-1">
          {choices.map((choice) => (
            <button type="button" key={choice.id} className={cn(menuItem(), "flex items-center gap-2")}
              data-testid={`new-session-provider-${choice.id}`}
              disabled={!connected || (discovery && catalog?.state !== "ready")}
              onClick={() => {
                if (choice.id === "claude" || choice.id === "codex") setLastAgentChoice(choice.id);
                onSelect(fixedCwd, choice.id);
                onClose();
              }}>
              <AgentIcon provider={choice.id} />
              {choice.label}
            </button>
          ))}
          {discovery && catalog?.state === "loading" && <p className="mx-3 text-[0.75rem] text-subtext-0" role="status">Checking agents…</p>}
          {discovery && catalog?.state === "error" && <p className="mx-3 text-[0.75rem] text-red" role="alert">{catalog.error}</p>}
          {discovery && catalog?.state === "ready" && !choices.length && <p className="mx-3 text-[0.75rem] text-subtext-0" role="status">Enable or install an agent in Manage agents.</p>}
          {discovery && <button type="button" className={cn(CATALOG_ACTION, "mx-3")} onClick={() => { onClose(); manage(); }}>Manage agents</button>}
        </div>
      ) : <>
      <AgentPicker
        hostId={hostId}
        onManage={onClose}
        value={selectedAgent}
        onChange={(a) => {
          setSelectedAgent(a);
          if (a === "claude" || a === "codex") setLastAgentChoice(a);
        }}
        testIdPrefix="new-session-popover-agent"
        className="m-2 mb-1 w-[calc(100%_-_1rem)]"
        wrapClassName="max-h-[35vh] shrink-0 overflow-y-auto"
      />
      {projectCwds.length > 0 && (
        <div className="max-h-[190px] min-h-0 shrink overflow-y-auto">
          {projectCwds.map((cwd, i) => (
            <button
              key={cwd}
              type="button"
              className={POPOVER_PICK}
              data-testid={`project-option-${i}`}
              onClick={() => { onSelect(cwd, selectedAgent); onClose(); }}
              title={cwd}
            >
              {basename(cwd)}
              <span className={POPOVER_PICK_CWD}>{cwd}</span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className={cn(POPOVER_PICK, "shrink-0 font-normal text-subtext-0")}
        data-testid="project-option-none"
        onClick={() => { onSelect("~", selectedAgent); onClose(); }}
      >
        No project
        <span className={POPOVER_PICK_CWD}>Chats</span>
      </button>
      </>}
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function Sidebar() {
  const connected = usePerchStore((s) => s.connected);
  const sessionId = usePerchStore((s) => s.sessionId);
  const sessions = usePerchStore((s) => s.sessions);
  const workspaceProjects = usePerchStore((s) => s.workspaceProjects);
  const serverInfo = usePerchStore((s) => s.serverInfo);
  const status = usePerchStore((s) => s.status);
  const hosts = usePerchStore((s) => s.hosts);
  const hostStates = usePerchStore((s) => s.hostStates);
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const activeProject = usePerchStore((s) => s.activeProject);
  const createSessionOnHost = usePerchStore((s) => s.createSessionOnHost);
  const switchSession = usePerchStore((s) => s.switchSession);
  const setSettingsOpen = usePerchStore((s) => s.setSettingsOpen);
  const setActiveHost = usePerchStore((s) => s.setActiveHost);
  const setActiveProject = usePerchStore((s) => s.setActiveProject);
  const upsertHost = usePerchStore((s) => s.upsertHost);
  const deleteSession = usePerchStore((s) => s.deleteSession);
  const workspaceCapabilities = usePerchStore((s) => s.workspaceCapabilities);
  const workspaceCapabilitiesByHost = usePerchStore((s) => s.workspaceCapabilitiesByHost);

  const [hostAnchor, setHostAnchor] = useState<DOMRect | null>(null);
  const [newAnchor, setNewAnchor] = useState<DOMRect | null>(null);

  const activeHostEntry = hosts.find((h: SshHostEntry) => h.id === activeHostId);
  const activeHostInfo = hostStates[activeHostId];
  const activeHostState: HostConnectionState =
    activeHostId === "local"
      ? connected
        ? "connected"
        : "connecting"
      : activeHostInfo
        ? activeHostInfo.state
        : activeHostEntry?.enabled
          ? "connecting"
          : "disabled";

  const navState = { sessions, sessionId, activeHostId, activeProject };
  const projects = projectsForHost(navState, activeHostId);
  const active = effectiveActiveProject(navState);
  const workspaceNavigationEnabled = (activeHostId === "local"
    ? workspaceCapabilities
    : workspaceCapabilitiesByHost[activeHostId] ?? []
  ).includes("workspace.snapshot");

  // New sessions start in a listed project or in Chats, never an unadded folder.
  const projectCwds = workspaceProjects
    .filter((project) => project.hostId === activeHostId)
    .map((project) => project.path);

  const choices: HostChoice[] = [
    {
      id: "local",
      name: serverInfo?.hostname ? `local (${serverInfo.hostname})` : "local",
      state: connected ? "connected" : "connecting",
      detail: serverInfo?.platform,
    },
    ...hosts.map((h: SshHostEntry) => {
      const info = hostStates[h.id];
      const state: HostConnectionState = info ? info.state : h.enabled ? "connecting" : "disabled";
      return {
        id: h.id,
        name: h.name,
        state,
        error: info?.error,
        detail:
          h.mode === "direct"
            ? `${h.sshHost} (direct)`
            : h.directUrl || `${h.sshHost}:${h.remotePort}`,
        entry: h,
        direct: h.mode === "direct",
      };
    }),
  ];

  const canCreate = connected && (activeHostId === "local" || activeHostState === "connected");

  return (
    <aside className="sidebar flex w-[var(--sidebar-width,240px)] shrink-0 flex-col overflow-hidden border-r border-r-overlay-0 bg-surface-0 max-[700px]:hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* A local-only install has nothing to switch between (UI-UX-DIRECTION.md §11). */}
        {(hosts.length > 0 || activeHostId !== "local") && <button
          type="button"
          className="flex w-full shrink-0 cursor-pointer items-start gap-[0.3rem] border-current bg-transparent text-left text-fg [font-family:inherit] [border-style:none_none_solid] border-b border-b-overlay-0 [transition:background_0.12s_ease] hover:bg-surface-1"
          data-testid="host-switcher"
          title="Switch host"
          aria-haspopup="true"
          aria-expanded={hostAnchor != null}
          onClick={(e) => setHostAnchor(e.currentTarget.getBoundingClientRect())}
        >
          {activeHostId === "local" ? (
            <EnvHeader
              hostname={serverInfo?.hostname}
              isSsh={serverInfo?.isSsh}
              platform={serverInfo?.platform}
              cwd={status?.cwd}
              branch={status?.branch}
            />
          ) : (
            <div className={ENV}>
              <div className={ENV_ROW}>
                <span className={ENV_BADGE_SSH}>HOST</span>
                <span className={ENV_HOST}>{activeHostEntry?.name ?? activeHostId}</span>
                <span className={ENV_PLATFORM}>{activeHostState}</span>
              </div>
              <div
                className={ENV_CWD}
                title={activeHostInfo?.error ?? activeHostEntry?.directUrl ?? activeHostEntry?.sshHost}
              >
                {activeHostInfo?.error ??
                  activeHostEntry?.directUrl ??
                  (activeHostEntry ? `${activeHostEntry.sshHost}:${activeHostEntry.remotePort}` : "")}
              </div>
            </div>
          )}
          <span className="shrink-0 pt-[0.6rem] pr-2 text-[0.7rem] text-subtext-0" aria-hidden="true">▾</span>
        </button>}

        <div className="flex shrink-0 flex-col items-stretch">
          <button
            type="button"
            className={cn(segment(), "w-full shrink-0 px-[0.9rem] py-[0.55rem] text-left text-[0.82rem] font-semibold text-fg")}
            data-testid={`new-session-${activeHostId}`}
            disabled={!canCreate}
            onClick={(e) => setNewAnchor(e.currentTarget.getBoundingClientRect())}
          >
            + New session
          </button>
        </div>

        {workspaceNavigationEnabled ? (
          <WorkspaceOverview />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto py-[0.2rem]" data-testid="project-list">
            {projects.length === 0 ? (
              <p className="mx-[0.65rem] my-[0.6rem] text-[0.72rem] text-subtext-0">No projects yet.</p>
            ) : (
              projects.map((group) => (
                <ProjectRow
                  key={group.key}
                  group={group}
                  hostId={activeHostId}
                  isActiveProject={active != null && active.cwd === group.cwd}
                  sessionId={sessionId}
                  onSelectProject={(cwd) => setActiveProject(activeHostId, cwd)}
                  onSwitch={switchSession}
                  onDelete={deleteSession}
                />
              ))
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-stretch border-t border-t-overlay-0">
        <button
          type="button"
          className={cn(segment(), "w-full justify-end px-[0.9rem] py-[0.4rem] text-[1.1rem] leading-none")}
          data-testid="settings-gear"
          title="Settings"
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          ⚙
        </button>
      </div>

      {hostAnchor && (
        <HostSwitcherPopover
          choices={choices}
          activeHostId={activeHostId}
          anchorRect={hostAnchor}
          onClose={() => setHostAnchor(null)}
          onSelect={setActiveHost}
          onToggleEnabled={(entry) => upsertHost({ ...entry, enabled: !entry.enabled })}
          onManage={() => setSettingsOpen(true)}
        />
      )}
      {newAnchor && (
        <NewSessionPopover
          hostId={activeHostId}
          projectCwds={projectCwds}
          anchorRect={newAnchor}
          onClose={() => setNewAnchor(null)}
          onSelect={(cwd, agent) => createSessionOnHost(activeHostId, cwd, agent)}
        />
      )}
    </aside>
  );
}
