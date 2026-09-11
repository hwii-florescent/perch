/**
 * MobileSwitcher.tsx — Phase 5 narrow-width (≤700px) slide-over that unifies
 * what the desktop `<Sidebar/>` splits across sections: every known session
 * (across all hosts), grouped by project, each row showing a `StatusDot`;
 * a "+ New session" affordance for the currently-active host; and a
 * Settings gear. Selecting a session switches to it and closes the panel.
 *
 * Follows `SettingsModal.tsx`'s non-portal `position: fixed` overlay pattern
 * (not a portal like `ModelChip`/`Navigator`) since it's a full-panel
 * slide-over rather than an anchored popover.
 */
import { usePerchStore } from "../store";
import { StatusDot } from "./StatusDot";
import { WorkspaceOverview } from "./WorkspaceOverview";
import type { SessionSummary } from "@perch/shared";

function basename(cwd: string): string {
  const parts = cwd.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || cwd;
}

interface ProjectGroup {
  key: string;
  hostId: string;
  cwd: string;
  sessions: SessionSummary[];
  newestAt: number;
}

function groupAllSessionsByProject(sessions: SessionSummary[]): ProjectGroup[] {
  const map = new Map<string, ProjectGroup>();
  for (const s of sessions) {
    const hostId = s.hostId ?? "local";
    const cwd = s.cwd ?? "(unknown)";
    const key = `${hostId}:${cwd}`;
    let group = map.get(key);
    if (!group) {
      group = { key, hostId, cwd, sessions: [], newestAt: 0 };
      map.set(key, group);
    }
    group.sessions.push(s);
    if (s.createdAt > group.newestAt) group.newestAt = s.createdAt;
  }
  for (const group of map.values()) {
    group.sessions.sort((a, b) => b.createdAt - a.createdAt);
  }
  return [...map.values()].sort((a, b) => b.newestAt - a.newestAt);
}

export interface MobileSwitcherProps {
  open: boolean;
  onClose: () => void;
}

export function MobileSwitcher({ open, onClose }: MobileSwitcherProps) {
  const sessions = usePerchStore((s) => s.sessions);
  const sessionId = usePerchStore((s) => s.sessionId);
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const connected = usePerchStore((s) => s.connected);
  const switchSession = usePerchStore((s) => s.switchSession);
  const createSessionOnHost = usePerchStore((s) => s.createSessionOnHost);
  const setSettingsOpen = usePerchStore((s) => s.setSettingsOpen);
  const workspaceCapabilities = usePerchStore((s) => s.workspaceCapabilities);
  const workspaceCapabilitiesByHost = usePerchStore((s) => s.workspaceCapabilitiesByHost);

  if (!open) return null;

  const groups = groupAllSessionsByProject(sessions);
  const workspaceNavigationEnabled = (activeHostId === "local"
    ? workspaceCapabilities
    : workspaceCapabilitiesByHost[activeHostId] ?? []
  ).includes("workspace.snapshot");

  function handleSwitch(id: string) {
    switchSession(id);
    onClose();
  }

  function handleNewSession() {
    createSessionOnHost(activeHostId);
    onClose();
  }

  return (
    <div className="mobile-switcher-backdrop" onClick={onClose}>
      <div
        className="mobile-switcher"
        data-testid="mobile-switcher"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mobile-switcher__header">
          <span className="mobile-switcher__title">Sessions</span>
          <button
            type="button"
            className="mobile-switcher__close"
            data-testid="mobile-switcher-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="mobile-switcher__actions">
          <button
            type="button"
            className="mobile-switcher__new-btn"
            data-testid="mobile-switcher-new-session"
            disabled={!connected}
            onClick={handleNewSession}
          >
            + New session
          </button>
        </div>

        {workspaceNavigationEnabled ? (
          <div className="mobile-switcher__list mobile-switcher__list--workspace">
            <WorkspaceOverview compact onNavigate={onClose} />
          </div>
        ) : (
          <div className="mobile-switcher__list">
            {groups.map((group) => (
              <div className="mobile-switcher__project" key={group.key}>
                <div className="mobile-switcher__project-header" title={group.cwd}>
                  {basename(group.cwd)}
                  {group.hostId !== "local" && (
                    <span className="mobile-switcher__project-host">{group.hostId}</span>
                  )}
                </div>
                {group.sessions.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className={
                      "mobile-switcher__session" +
                      (s.id === sessionId ? " mobile-switcher__session--active" : "")
                    }
                    data-testid={`mobile-switcher-session-${s.id}`}
                    onClick={() => handleSwitch(s.id)}
                  >
                    <StatusDot session={s} />
                    <span className="mobile-switcher__session-title">
                      {s.title || "(new session)"}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="mobile-switcher__footer">
          <button
            type="button"
            className="mobile-switcher__settings"
            data-testid="mobile-switcher-settings"
            title="Settings"
            aria-label="Settings"
            onClick={() => {
              setSettingsOpen(true);
              onClose();
            }}
          >
            ⚙ Settings
          </button>
        </div>
      </div>
    </div>
  );
}
