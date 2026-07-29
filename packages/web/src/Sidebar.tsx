import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePerchStore } from "./store";
import { StatusDot } from "./components/StatusDot";
import type { SessionSummary, SshHostEntry, HostInfoMessage, HostConnectionState } from "@perch/shared";

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

// ---------------------------------------------------------------------------
// Project grouping
// ---------------------------------------------------------------------------

interface ProjectGroup {
  /** Grouping key: (hostId, cwd). */
  key: string;
  cwd: string;
  sessions: SessionSummary[];
  /** Newest session's createdAt — used to order groups newest-first. */
  newestAt: number;
}

function groupSessionsByProject(sessions: SessionSummary[], hostId: string): ProjectGroup[] {
  const map = new Map<string, ProjectGroup>();

  for (const s of sessions) {
    // Only include sessions belonging to this host.
    const sHostId = s.hostId ?? "local";
    if (sHostId !== hostId) continue;
    const cwd = s.cwd ?? "(unknown)";
    const key = `${hostId}:${cwd}`;
    let group = map.get(key);
    if (!group) {
      group = { key, cwd, sessions: [], newestAt: 0 };
      map.set(key, group);
    }
    group.sessions.push(s);
    if (s.createdAt > group.newestAt) group.newestAt = s.createdAt;
  }

  // Sort sessions within each group newest-first, then sort groups newest-first.
  for (const group of map.values()) {
    group.sessions.sort((a, b) => b.createdAt - a.createdAt);
  }
  return [...map.values()].sort((a, b) => b.newestAt - a.newestAt);
}

// ---------------------------------------------------------------------------
// EnvHeader (compact, now used as the Local section header content)
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
// SessionMenu — hover "⋯" button with portal popover (Fix 4)
// ---------------------------------------------------------------------------

interface SessionMenuProps {
  session: SessionSummary;
  onArchive: (sessionId: string, archived: boolean) => void;
}

function SessionMenu({ session, onArchive }: SessionMenuProps) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleBtnClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPopoverStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        zIndex: 9999,
      });
    }
    setOpen(true);
  }

  const popover = open ? createPortal(
    <div
      className="session-menu__popover"
      ref={popoverRef}
      style={popoverStyle}
    >
      <button
        type="button"
        className="session-menu__item"
        data-testid={`session-archive-${session.id}`}
        onClick={(e) => {
          e.stopPropagation();
          onArchive(session.id, !session.archived);
          setOpen(false);
        }}
      >
        {session.archived ? "Unarchive" : "Archive"}
      </button>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        type="button"
        className="session-item__menu-btn"
        data-testid={`session-menu-${session.id}`}
        onClick={handleBtnClick}
        title="Session options"
        aria-label="Session options"
      >
        ⋯
      </button>
      {popover}
    </>
  );
}

// ---------------------------------------------------------------------------
// SessionItem
// ---------------------------------------------------------------------------

interface SessionItemProps {
  session: SessionSummary;
  isActive: boolean;
  showArchived: boolean;
  onSwitch: (id: string) => void;
  onArchive: (sessionId: string, archived: boolean) => void;
}

function SessionItem({ session, isActive, showArchived, onSwitch, onArchive }: SessionItemProps) {
  let itemClass = isActive ? "session-item session-item--active" : "session-item";
  if (session.archived && showArchived) {
    itemClass += " session-item--archived";
  }

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
      <SessionMenu session={session} onArchive={onArchive} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProjectGroup component
// ---------------------------------------------------------------------------

/** Renders `branch` (if known) plus `↑n`/`↓n` glyphs (ahead/behind), only
 * showing the glyphs when non-zero. Returns `null` entirely when no git
 * status has been received yet for this project (e.g. non-git cwd, or the
 * poll hasn't run yet). */
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

function ProjectGroupBlock({
  group,
  hostId,
  sessionId,
  showArchived,
  onSwitch,
  onArchive,
}: {
  group: ProjectGroup;
  hostId: string;
  sessionId: string | null;
  showArchived: boolean;
  onSwitch: (id: string) => void;
  onArchive: (sessionId: string, archived: boolean) => void;
}) {
  return (
    <div className="sidebar__project">
      <div className="sidebar__project-header">
        <span
          className="sidebar__project-name"
          title={group.cwd}
        >
          {basename(group.cwd)}
        </span>
        <ProjectGitStatus projectKey={group.key} hostId={hostId} />
        <span className="sidebar__project-count">{group.sessions.length}</span>
      </div>
      {group.sessions.map((s) => (
        <SessionItem
          key={s.id}
          session={s}
          isActive={s.id === sessionId}
          showArchived={showArchived}
          onSwitch={onSwitch}
          onArchive={onArchive}
        />
      ))}
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
// NewSessionPopover — portal popover for the "+" button (Fix 2)
// ---------------------------------------------------------------------------

interface NewSessionPopoverProps {
  hostId: string;
  /** Known project cwds for this host, derived from existing sessions. */
  projectCwds: string[];
  anchorRect: DOMRect;
  onClose: () => void;
  onSelect: (cwd?: string) => void;
}

function NewSessionPopover({ hostId, projectCwds, anchorRect, onClose, onSelect }: NewSessionPopoverProps) {
  const [pathInput, setPathInput] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  // Position: open below the anchor button, left-aligned.
  const style: React.CSSProperties = {
    position: "fixed",
    top: anchorRect.bottom + 4,
    left: anchorRect.left,
    zIndex: 9999,
    minWidth: 200,
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
      {projectCwds.map((cwd, i) => (
        <button
          key={cwd}
          type="button"
          className="new-session-popover__item"
          data-testid={`project-option-${i}`}
          onClick={() => { onSelect(cwd); onClose(); }}
          title={cwd}
        >
          {basename(cwd)}
          <span className="new-session-popover__item-cwd">{cwd}</span>
        </button>
      ))}
      <button
        type="button"
        className="new-session-popover__item new-session-popover__item--none"
        data-testid="project-option-none"
        onClick={() => { onSelect("~"); onClose(); }}
      >
        No project
        <span className="new-session-popover__item-cwd">~</span>
      </button>
      <div className="new-session-popover__divider" />
      <div className="new-session-popover__custom">
        <input
          type="text"
          className="new-session-popover__input"
          data-testid="project-path-input"
          placeholder="/path/to/project"
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && pathInput.trim()) {
              onSelect(pathInput.trim());
              onClose();
            }
          }}
        />
        <button
          type="button"
          className="new-session-popover__create-btn"
          data-testid="project-create"
          disabled={!pathInput.trim()}
          onClick={() => {
            if (pathInput.trim()) { onSelect(pathInput.trim()); onClose(); }
          }}
        >
          Create
        </button>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// HostSection — one section per configured host
// ---------------------------------------------------------------------------

interface HostSectionProps {
  hostId: string;
  name: string;
  /** If undefined, no host.info has arrived yet. */
  hostInfo: HostInfoMessage | undefined;
  /** Whether the host is enabled in the hosts config. */
  enabled: boolean;
  sessions: SessionSummary[];
  sessionId: string | null;
  connected: boolean;
  showArchived: boolean;
  onSwitch: (id: string) => void;
  onNewSession: (hostId: string, cwd?: string) => void;
  onArchive: (sessionId: string, archived: boolean) => void;
}

function HostSection({
  hostId,
  name,
  hostInfo,
  enabled,
  sessions,
  sessionId,
  connected,
  showArchived,
  onSwitch,
  onNewSession,
  onArchive,
}: HostSectionProps) {
  const [popoverAnchor, setPopoverAnchor] = useState<DOMRect | null>(null);
  const newBtnRef = useRef<HTMLButtonElement>(null);

  // If we have a host.info, use its state; otherwise infer from enabled flag.
  const state: HostConnectionState = hostInfo
    ? hostInfo.state
    : enabled
      ? "connecting"
      : "disabled";

  // Collect distinct cwds from this host's sessions for the picker.
  const projectCwds = [...new Set(
    sessions
      .filter((s) => (s.hostId ?? "local") === hostId)
      .map((s) => s.cwd)
      .filter(Boolean)
  )];

  // Filter sessions for display.
  const visibleSessions = sessions.filter((s) => {
    const sHostId = s.hostId ?? "local";
    if (sHostId !== hostId) return false;
    if (s.archived && !showArchived) {
      // Keep visible if it's the active session (don't yank open chat).
      return s.id === sessionId;
    }
    return true;
  });

  const groups = groupSessionsByProject(visibleSessions, hostId);
  const isDisabled = state === "disabled";

  function handleNewClick(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopoverAnchor(rect);
  }

  return (
    <div className={`sidebar__host-section${isDisabled ? " sidebar__host-section--disabled" : ""}`}>
      <div className="sidebar__host-header">
        <HostStateDot state={state} error={hostInfo?.error} />
        <span className="sidebar__host-name" title={name}>{name}</span>
        <button
          type="button"
          className="sidebar__host-new-btn"
          ref={newBtnRef}
          data-testid={`new-session-${hostId}`}
          disabled={!connected || state !== "connected"}
          onClick={handleNewClick}
          title="New session on this host"
        >
          +
        </button>
      </div>
      <div className="sidebar__host-sessions">
        {groups.map((group) => (
          <ProjectGroupBlock
            key={group.key}
            group={group}
            hostId={hostId}
            sessionId={sessionId}
            showArchived={showArchived}
            onSwitch={onSwitch}
            onArchive={onArchive}
          />
        ))}
      </div>
      {popoverAnchor && (
        <NewSessionPopover
          hostId={hostId}
          projectCwds={projectCwds}
          anchorRect={popoverAnchor}
          onClose={() => setPopoverAnchor(null)}
          onSelect={(cwd) => onNewSession(hostId, cwd)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LocalSection — the local host section (Fix 2: also uses the picker)
// ---------------------------------------------------------------------------

interface LocalSectionProps {
  serverInfo: { hostname: string; isSsh: boolean; platform: string } | null;
  status: { cwd: string; branch: string } | null;
  sessions: SessionSummary[];
  sessionId: string | null;
  connected: boolean;
  showArchived: boolean;
  onSwitch: (id: string) => void;
  onNewSession: (cwd?: string) => void;
  onArchive: (sessionId: string, archived: boolean) => void;
}

function LocalSection({
  serverInfo,
  status,
  sessions,
  sessionId,
  connected,
  showArchived,
  onSwitch,
  onNewSession,
  onArchive,
}: LocalSectionProps) {
  const [popoverAnchor, setPopoverAnchor] = useState<DOMRect | null>(null);

  const projectCwds = [...new Set(
    sessions
      .filter((s) => (s.hostId ?? "local") === "local")
      .map((s) => s.cwd)
      .filter(Boolean)
  )];

  // Filter sessions: hide archived (unless showArchived) except the active one.
  const visibleSessions = sessions.filter((s) => {
    const sHostId = s.hostId ?? "local";
    if (sHostId !== "local") return false;
    if (s.archived && !showArchived) {
      return s.id === sessionId;
    }
    return true;
  });

  const localGroups = groupSessionsByProject(visibleSessions, "local");

  function handleNewClick(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopoverAnchor(rect);
  }

  return (
    <div className="sidebar__local-section">
      <EnvHeader
        hostname={serverInfo?.hostname}
        isSsh={serverInfo?.isSsh}
        platform={serverInfo?.platform}
        cwd={status?.cwd}
        branch={status?.branch}
      />

      <div className="sidebar__local-actions">
        <button
          type="button"
          className="sidebar__new-btn"
          data-testid="new-session-local"
          disabled={!connected}
          onClick={handleNewClick}
        >
          + New session
        </button>
      </div>

      <div className="sidebar__list">
        {localGroups.map((group) => (
          <ProjectGroupBlock
            key={group.key}
            group={group}
            hostId="local"
            sessionId={sessionId}
            showArchived={showArchived}
            onSwitch={onSwitch}
            onArchive={onArchive}
          />
        ))}
      </div>

      {popoverAnchor && (
        <NewSessionPopover
          hostId="local"
          projectCwds={projectCwds}
          anchorRect={popoverAnchor}
          onClose={() => setPopoverAnchor(null)}
          onSelect={(cwd) => { onNewSession(cwd); }}
        />
      )}
    </div>
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
  const createSessionOnHost = usePerchStore((s) => s.createSessionOnHost);
  const switchSession = usePerchStore((s) => s.switchSession);
  const setSettingsOpen = usePerchStore((s) => s.setSettingsOpen);
  const archiveSession = usePerchStore((s) => s.archiveSession);
  const showArchived = usePerchStore((s) => s.showArchived);
  const setShowArchived = usePerchStore((s) => s.setShowArchived);
  const sidebarCollapsed = usePerchStore((s) => s.sidebarCollapsed);
  const toggleSidebar = usePerchStore((s) => s.toggleSidebar);

  return (
    <aside className={"sidebar" + (sidebarCollapsed ? " sidebar--collapsed" : "")}>
      <div className="sidebar__body">
        {/* ---- Local section ---- */}
        <LocalSection
          serverInfo={serverInfo}
          status={status}
          sessions={sessions}
          sessionId={sessionId}
          connected={connected}
          showArchived={showArchived}
          onSwitch={switchSession}
          onNewSession={(cwd) => createSessionOnHost("local", cwd)}
          onArchive={archiveSession}
        />

        {/* ---- Remote host sections ---- */}
        {hosts.map((host: SshHostEntry) => (
          <HostSection
            key={host.id}
            hostId={host.id}
            name={host.name}
            hostInfo={hostStates[host.id]}
            enabled={host.enabled}
            sessions={sessions}
            sessionId={sessionId}
            connected={connected}
            showArchived={showArchived}
            onSwitch={switchSession}
            onNewSession={createSessionOnHost}
            onArchive={archiveSession}
          />
        ))}
      </div>

      <div className="sidebar__footer">
        <button
          type="button"
          className="sidebar__toggle-archived"
          data-testid="toggle-archived"
          title={showArchived ? "Hide archived sessions" : "Show archived sessions"}
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? "Hide archived" : "Show archived"}
        </button>
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
    </aside>
  );
}
