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
import { cn } from "../lib/cn";
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
    <div className="fixed inset-0 z-[3000] flex justify-end bg-[rgba(0,0,0,0.5)]" onClick={onClose}>
      <div
        className="flex h-full w-[min(320px,88vw)] flex-col overflow-hidden border-l border-l-overlay-0 bg-surface-0 shadow-[-8px_0_32px_rgba(0,0,0,0.5)]"
        data-testid="mobile-switcher"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-b-overlay-0 px-[0.9rem] pt-[calc(0.7rem_+_env(safe-area-inset-top))] pb-[0.7rem]">
          <span className="text-[0.95rem] font-semibold text-fg">Sessions</span>
          <button
            type="button"
            className="cursor-pointer px-[0.3rem] py-[0.1rem] text-[1.3rem] leading-none text-subtext-0 [background:none] [border:none] hover:text-fg"
            data-testid="mobile-switcher-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="shrink-0 border-b border-b-overlay-0 px-[0.9rem] py-[0.6rem]">
          <button
            type="button"
            className="w-full cursor-pointer rounded-ui bg-accent px-[0.6rem] py-[0.45rem] text-[0.85rem] font-semibold text-panel-bg [border:none] [font-family:inherit] disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="mobile-switcher-new-session"
            disabled={!connected}
            onClick={handleNewSession}
          >
            + New session
          </button>
        </div>

        {workspaceNavigationEnabled ? (
          <div className="flex-1 overflow-y-auto p-0">
            <WorkspaceOverview compact onNavigate={onClose} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto py-[0.4rem]">
            {groups.map((group) => (
              <div className="mobile-switcher__project py-[0.3rem]" key={group.key}>
                <div className="flex items-center gap-[0.4rem] px-[0.9rem] py-[0.3rem] text-[0.75rem] font-semibold tracking-[0.03em] text-subtext-0 uppercase" title={group.cwd}>
                  {basename(group.cwd)}
                  {group.hostId !== "local" && (
                    <span className="font-normal normal-case opacity-80">{group.hostId}</span>
                  )}
                </div>
                {group.sessions.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 px-[0.9rem] py-2 text-left text-[0.85rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-1",
                      s.id === sessionId ? "bg-surface-1 text-accent" : "bg-transparent text-fg",
                    )}
                    data-testid={`mobile-switcher-session-${s.id}`}
                    onClick={() => handleSwitch(s.id)}
                  >
                    <StatusDot session={s} />
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                      {s.title || "(new session)"}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="shrink-0 border-t border-t-overlay-0 px-[0.9rem] pt-2 pb-[calc(0.5rem_+_env(safe-area-inset-bottom))]">
          <button
            type="button"
            className="w-full cursor-pointer rounded-ui border border-overlay-0 px-[0.6rem] py-[0.4rem] text-left text-[0.82rem] text-fg [background:none] [font-family:inherit] hover:border-accent"
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
