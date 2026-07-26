import { usePerchStore } from "./store";
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
// SessionItem
// ---------------------------------------------------------------------------

interface SessionItemProps {
  session: SessionSummary;
  isActive: boolean;
  onSwitch: (id: string) => void;
}

function SessionItem({ session, isActive, onSwitch }: SessionItemProps) {
  const dotClass =
    session.status === "running"
      ? "session-status session-status--running"
      : "session-status session-status--idle";

  const itemClass = isActive ? "session-item session-item--active" : "session-item";

  return (
    <button
      type="button"
      className={itemClass}
      data-session-id={session.id}
      onClick={() => onSwitch(session.id)}
    >
      <span className={dotClass} />
      <div className="session-item__body">
        <div className="session-item__title">
          {session.title || "(new session)"}
        </div>
        <div className="session-item__meta">
          <span className="session-item__time">{relativeTime(session.createdAt)}</span>
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// ProjectGroup component
// ---------------------------------------------------------------------------

function ProjectGroupBlock({
  group,
  sessionId,
  onSwitch,
}: {
  group: ProjectGroup;
  sessionId: string | null;
  onSwitch: (id: string) => void;
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
        <span className="sidebar__project-count">{group.sessions.length}</span>
      </div>
      {group.sessions.map((s) => (
        <SessionItem
          key={s.id}
          session={s}
          isActive={s.id === sessionId}
          onSwitch={onSwitch}
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
  onSwitch: (id: string) => void;
  onNewSession: (hostId: string) => void;
}

function HostSection({
  hostId,
  name,
  hostInfo,
  enabled,
  sessions,
  sessionId,
  connected,
  onSwitch,
  onNewSession,
}: HostSectionProps) {
  // If we have a host.info, use its state; otherwise infer from enabled flag.
  const state: HostConnectionState = hostInfo
    ? hostInfo.state
    : enabled
      ? "connecting"
      : "disabled";

  const groups = groupSessionsByProject(sessions, hostId);
  const isDisabled = state === "disabled";

  return (
    <div className={`sidebar__host-section${isDisabled ? " sidebar__host-section--disabled" : ""}`}>
      <div className="sidebar__host-header">
        <HostStateDot state={state} error={hostInfo?.error} />
        <span className="sidebar__host-name" title={name}>{name}</span>
        <button
          type="button"
          className="sidebar__host-new-btn"
          data-testid={`new-session-${hostId}`}
          disabled={!connected || state !== "connected"}
          onClick={() => onNewSession(hostId)}
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
            sessionId={sessionId}
            onSwitch={onSwitch}
          />
        ))}
      </div>
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
  const createSession = usePerchStore((s) => s.createSession);
  const createSessionOnHost = usePerchStore((s) => s.createSessionOnHost);
  const switchSession = usePerchStore((s) => s.switchSession);
  const setSettingsOpen = usePerchStore((s) => s.setSettingsOpen);

  const localGroups = groupSessionsByProject(sessions, "local");

  return (
    <aside className="sidebar">
      <div className="sidebar__body">
        {/* ---- Local section ---- */}
        <div className="sidebar__local-section">
          {/* The compact env header serves as the Local section header */}
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
              onClick={createSession}
            >
              + New session
            </button>
          </div>

          <div className="sidebar__list">
            {localGroups.map((group) => (
              <ProjectGroupBlock
                key={group.key}
                group={group}
                sessionId={sessionId}
                onSwitch={switchSession}
              />
            ))}
          </div>
        </div>

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
            onSwitch={switchSession}
            onNewSession={createSessionOnHost}
          />
        ))}
      </div>

      <div className="sidebar__footer">
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
