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
import { DirectoryBrowser } from "./components/DirectoryBrowser";
import { WorktreeMenu } from "./components/WorktreeMenu";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { AgentPicker } from "./components/AgentPicker";
import { WorkspaceOverview } from "./components/WorkspaceOverview";
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

function envBadgeClass(isSsh: boolean | undefined): string {
  if (isSsh) return "sidebar__env-badge sidebar__env-badge--ssh";
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") {
    return "sidebar__env-badge sidebar__env-badge--local";
  }
  return "sidebar__env-badge sidebar__env-badge--remote";
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
    <div className="sidebar__env">
      <div className="sidebar__env-row">
        <span className={badgeClass}>{badgeLabel}</span>
        {hostname && <span className="sidebar__env-host">{hostname}</span>}
        {platform && <span className="sidebar__env-platform">{platform}</span>}
      </div>
      {cwd && (
        <div className="sidebar__env-cwd" title={cwd}>
          {cwd}
          {branch ? ` (${branch})` : ""}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HostStateDot — colored dot showing host connection state
// ---------------------------------------------------------------------------

function hostStateDotClass(state: HostConnectionState): string {
  switch (state) {
    case "connected": return "host-state host-state--connected";
    case "connecting": return "host-state host-state--connecting";
    case "error": return "host-state host-state--error";
    case "disabled": return "host-state host-state--disabled";
    default: return "host-state host-state--disabled";
  }
}

function HostStateDot({ state, error }: { state: HostConnectionState; error?: string }) {
  return (
    <span
      className={hostStateDotClass(state)}
      title={state === "error" && error ? error : state}
    />
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
    <div className="host-switcher-popover" data-testid="host-switcher-popover" ref={popoverRef} style={style}>
      <div className="host-switcher-popover__list">
        {choices.map((choice) => (
          <div
            key={choice.id}
            className={
              "host-switcher-popover__row" +
              (choice.id === activeHostId ? " host-switcher-popover__row--active" : "")
            }
          >
            <div className="host-switcher-popover__row-top">
              <button
                type="button"
                className="host-switcher-popover__item"
                data-testid={`host-option-${choice.id}`}
                title={choice.detail ?? choice.name}
                onClick={() => {
                  onSelect(choice.id);
                  onClose();
                }}
              >
                <HostStateDot state={choice.state} error={choice.error} />
                <span className="host-switcher-popover__name">{choice.name}</span>
                {choice.direct && (
                  <span
                    className="host-switcher-popover__badge"
                    data-testid={`host-direct-badge-${choice.id}`}
                    title="Direct mode: no perch on the remote — turns run detached over SSH and survive disconnects"
                  >
                    direct
                  </span>
                )}
                <span className="host-switcher-popover__state">{choice.state}</span>
              </button>
              {choice.entry && (
                <label className="host-switcher-popover__enabled" title="Enabled">
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
                className="host-switcher-popover__error"
                data-testid={`host-error-${choice.id}`}
                title={choice.error}
              >
                {choice.error}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="host-switcher-popover__divider" />
      <button
        type="button"
        className="host-switcher-popover__manage"
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
  onArchive: (sessionId: string, archived: boolean) => void;
  onDelete: (sessionId: string) => void;
}

function SessionItem({ session, isActive, onSwitch, onArchive, onDelete }: SessionItemProps) {
  const itemClass = isActive ? "session-item session-item--active" : "session-item";

  return (
    <div className="session-item__wrapper">
      <button
        type="button"
        className={itemClass}
        data-session-id={session.id}
        onClick={() => onSwitch(session.id)}
      >
        <StatusDot session={session} />
        <div className="session-item__body">
          <div className="session-item__title">
            {session.title || "(new session)"}
          </div>
          <div className="session-item__meta">
            <span className="session-item__time">{relativeTime(session.createdAt)}</span>
          </div>
        </div>
      </button>
      {/* Archiving always makes the row vanish (archived sessions never render
       * in the nav) — restoring one happens from Settings → Archived sessions,
       * so this button is archive-only, never a toggle. */}
      <button
        type="button"
        className="session-item__archive-btn"
        data-testid={`session-archive-icon-${session.id}`}
        title="Archive session"
        aria-label="Archive session"
        onClick={(e) => {
          e.stopPropagation();
          onArchive(session.id, true);
        }}
      >
        📦
      </button>
      {/* No confirmation: the user asked for a one-click, immediate delete
       * (unlike the multi-tab terminal-group close and worktree-remove
       * confirmations, which still route through ConfirmDialog). */}
      <button
        type="button"
        className="session-item__delete-btn"
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
    <span className="sidebar__project-git" data-testid={`workspace-git-${hostId}`} title={git.branch}>
      <span className="sidebar__project-branch">{git.branch}</span>
      {git.ahead > 0 && (
        <span className="sidebar__project-ahead" style={{ color: "var(--green)" }}>
          ↑{git.ahead}
        </span>
      )}
      {git.behind > 0 && (
        <span className="sidebar__project-behind" style={{ color: "var(--red)" }}>
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
    <span className="sidebar__project-sub" title={cwd}>
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
  const registered = usePerchStore((s) => s.workspaceProjects.some((project) => project.hostId === hostId && project.repoPath === cwd && !project.archived));
  if (registered) return null; // The project rail owns this menu and shortcut.
  // Non-git projects have no worktrees (backend `worktree.rs list` errors on a
  // non-git cwd, matching herdr's `not_git_worktree` guard). Rather than hide
  // the affordance entirely — which left users guessing why the branch glyph
  // was missing — render a disabled, non-interactive glyph whose tooltip says
  // why. No menu is wired, so it can never fire a doomed `worktree.list`.
  if (!git || !git.branch)
    return (
      <span
        className="worktree-menu__btn worktree-menu__btn--disabled"
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
      className="worktree-menu__btn"
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
  onArchive,
  onDelete,
}: {
  group: ProjectGroup;
  hostId: string;
  isActiveProject: boolean;
  sessionId: string | null;
  onSelectProject: (cwd: string) => void;
  onSwitch: (id: string) => void;
  onArchive: (sessionId: string, archived: boolean) => void;
  onDelete: (sessionId: string) => void;
}) {
  const dotState = aggregateDotState(group.sessions);
  const { glyph, color } = DOT_GLYPH[dotState];
  // Bulk "archive all sessions in this project" — archive, not delete, is
  // the default and only bulk action here (see the module doc comment):
  // archived sessions stay restorable from Settings → Archived Sessions,
  // unlike delete. Requires an explicit inline confirm (never `window.confirm`,
  // which blocks the page) naming the exact count before anything happens.
  const [confirmingCloseAll, setConfirmingCloseAll] = useState(false);
  const sessionCount = group.sessions.length;

  return (
    <div className={"sidebar__project" + (isActiveProject ? " sidebar__project--active" : "")}>
      <div className="sidebar__project-header">
        <button
          type="button"
          className="sidebar__project-select"
          data-testid="project-row"
          data-project-cwd={group.cwd}
          aria-current={isActiveProject ? "true" : undefined}
          title={group.cwd}
          onClick={() => onSelectProject(group.cwd)}
        >
          <span
            className={`agent-status-dot agent-status-dot--${dotState} sidebar__project-dot`}
            style={{ color }}
            title={`status: ${dotState}`}
            aria-hidden="true"
          >
            {glyph}
          </span>
          <span className="sidebar__project-body">
            <span className="sidebar__project-name" title={group.cwd}>
              {basename(group.cwd)}
            </span>
            <span className="sidebar__project-subline">
              <ProjectSubline projectKey={group.key} hostId={hostId} cwd={group.cwd} />
            </span>
          </span>
          <span className="sidebar__project-count">{sessionCount}</span>
        </button>
        <ProjectWorktrees projectKey={group.key} hostId={hostId} cwd={group.cwd} />
        <ProjectGitReviewButton hostId={hostId} sessions={group.sessions} />
        <button
          type="button"
          className="sidebar__project-close-all"
          data-testid="project-close-all"
          title="Archive all sessions in this project"
          aria-label="Archive all sessions in this project"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmingCloseAll(true);
          }}
        >
          📦
        </button>
      </div>
      {isActiveProject &&
        group.sessions.map((s) => (
          <SessionItem
            key={s.id}
            session={s}
            isActive={s.id === sessionId}
            onSwitch={onSwitch}
            onArchive={onArchive}
            onDelete={onDelete}
          />
        ))}
      {confirmingCloseAll && (
        <ConfirmDialog
          message={`Archive all ${sessionCount} session${sessionCount === 1 ? "" : "s"} in "${basename(group.cwd)}"? You can restore them later from Settings → Archived Sessions.`}
          confirmLabel="Archive all"
          cancelLabel="Cancel"
          onConfirm={() => {
            // sessionIdsForProject re-derives membership from group.sessions'
            // own ids at click time rather than reusing the array reference,
            // matching the pure selection logic unit-tested in store.test.ts.
            for (const id of sessionIdsForProject(group.sessions, hostId, group.cwd)) {
              onArchive(id, true);
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
  anchorRect: DOMRect;
  onClose: () => void;
  /** Provider selected before opening a session in the chosen directory. */
  onSelect: (cwd: string | undefined, agent: string) => void;
}

export function NewSessionPopover({ hostId, projectCwds, anchorRect, onClose, onSelect }: NewSessionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const lastAgentChoice = usePerchStore((s) => s.lastAgentChoice);
  const setLastAgentChoice = usePerchStore((s) => s.setLastAgentChoice);
  const [selectedAgent, setSelectedAgent] = useState<string>(lastAgentChoice);

  // Position: open below the anchor button, left-aligned. Clamped to the
  // viewport: the known-projects quick-pick list grows one row per distinct
  // cwd seen in the DB (e2e fixture leftovers, long-lived real usage, ...),
  // and combined with the embedded DirectoryBrowser it can exceed the
  // viewport height, stranding the "Use this folder" button below the fold.
  // `.new-session-popover` is a flex column (see styles.css); this cap makes
  // its internal regions (`__projects` list, DirectoryBrowser's folder list)
  // scroll internally while the breadcrumb/filter/footer stay pinned.
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
    <div className="new-session-popover" ref={popoverRef} style={style}>
      <AgentPicker
        hostId={hostId}
        onManage={onClose}
        value={selectedAgent}
        onChange={(a) => {
          setSelectedAgent(a);
          if (a === "claude" || a === "codex") setLastAgentChoice(a);
        }}
        testIdPrefix="new-session-popover-agent"
        className="new-session-popover__agent"
      />
      {projectCwds.length > 0 && (
        <div className="new-session-popover__projects">
          {projectCwds.map((cwd, i) => (
            <button
              key={cwd}
              type="button"
              className="new-session-popover__item"
              data-testid={`project-option-${i}`}
              onClick={() => { onSelect(cwd, selectedAgent); onClose(); }}
              title={cwd}
            >
              {basename(cwd)}
              <span className="new-session-popover__item-cwd">{cwd}</span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className="new-session-popover__item new-session-popover__item--none"
        data-testid="project-option-none"
        onClick={() => { onSelect("~", selectedAgent); onClose(); }}
      >
        No project
        <span className="new-session-popover__item-cwd">~</span>
      </button>
      <div className="new-session-popover__divider" />
      <DirectoryBrowser
        hostId={hostId}
        onUseFolder={(path) => {
          onSelect(path, selectedAgent);
          onClose();
        }}
      />
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
  const archiveSession = usePerchStore((s) => s.archiveSession);
  const deleteSession = usePerchStore((s) => s.deleteSession);
  const sidebarCollapsed = usePerchStore((s) => s.sidebarCollapsed);
  const toggleSidebar = usePerchStore((s) => s.toggleSidebar);
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

  const projectCwds = [
    ...new Set(
      sessions
        .filter((s) => (s.hostId ?? "local") === activeHostId)
        .map((s) => s.cwd)
        .filter(Boolean)
    ),
  ];

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
    <aside className={"sidebar" + (sidebarCollapsed ? " sidebar--collapsed" : "")}>
      <div className="sidebar__body">
        <button
          type="button"
          className="sidebar__host-switcher"
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
            <div className="sidebar__env">
              <div className="sidebar__env-row">
                <span className="sidebar__env-badge sidebar__env-badge--ssh">HOST</span>
                <span className="sidebar__env-host">{activeHostEntry?.name ?? activeHostId}</span>
                <span className="sidebar__env-platform">{activeHostState}</span>
              </div>
              <div
                className="sidebar__env-cwd"
                title={activeHostInfo?.error ?? activeHostEntry?.directUrl ?? activeHostEntry?.sshHost}
              >
                {activeHostInfo?.error ??
                  activeHostEntry?.directUrl ??
                  (activeHostEntry ? `${activeHostEntry.sshHost}:${activeHostEntry.remotePort}` : "")}
              </div>
            </div>
          )}
          <span className="sidebar__host-switcher-caret" aria-hidden="true">▾</span>
        </button>

        <div className="sidebar__local-actions">
          <button
            type="button"
            className="sidebar__new-btn"
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
          <div className="sidebar__list" data-testid="project-list">
            {projects.length === 0 ? (
              <p className="sidebar__empty">No projects yet.</p>
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
                  onArchive={archiveSession}
                  onDelete={deleteSession}
                />
              ))
            )}
          </div>
        )}
      </div>

      <div className="sidebar__footer">
        <button
          type="button"
          className="sidebar__collapse-toggle"
          data-testid="sidebar-collapse-toggle"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleSidebar}
        >
          {sidebarCollapsed ? "»" : "«"}
        </button>
        <button
          type="button"
          className="sidebar__gear"
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
