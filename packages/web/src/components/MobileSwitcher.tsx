/**
 * MobileSwitcher.tsx — Phase 5 narrow-width (≤700px) slide-over that unifies
 * what the desktop `<Sidebar/>` splits across sections: every known session
 * (across all hosts), grouped by project, each row showing a `StatusDot`;
 * a "+ New session" affordance for the currently-active host; and plan
 * usage in the footer (the phone has no status bar). Settings is in the
 * header. Selecting a session switches to it and closes the panel.
 * `onPicked` fires when the user chose where to go (not on a plain close), so
 * the shell can show the session pane.
 *
 * Follows `SettingsModal.tsx`'s non-portal `position: fixed` overlay pattern
 * (not a portal like `ModelChip`/`Navigator`) since it's a full-panel
 * slide-over rather than an anchored popover.
 */
import { useState } from "react";
import { usePerchStore } from "../store";
import { cn } from "../lib/cn";
import { StatusDot } from "./StatusDot";
import { WorkspaceOverview } from "./WorkspaceOverview";
import { UsageSummary, useUsage } from "../StatusBar";
import { HostSwitcherPopover, useHostChoices } from "../Sidebar";
import { HostStateDot } from "./HostStateDot";
import { Chevron } from "./ui/chevron";
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
  onPicked?: () => void;
}

export function MobileSwitcher({ open, onClose, onPicked }: MobileSwitcherProps) {
  // Mounted for the whole phone session and the status bar is not, so this is the one usage poller there.
  const { usage, usageUpdatedAt } = useUsage();
  const { choices, activeHostEntry, activeHostState } = useHostChoices();
  const hosts = usePerchStore((s) => s.hosts);
  const setActiveHost = usePerchStore((s) => s.setActiveHost);
  const upsertHost = usePerchStore((s) => s.upsertHost);
  const setSettingsOpen = usePerchStore((s) => s.setSettingsOpen);
  const [hostAnchor, setHostAnchor] = useState<DOMRect | null>(null);
  const sessions = usePerchStore((s) => s.sessions);
  const sessionId = usePerchStore((s) => s.sessionId);
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const connected = usePerchStore((s) => s.connected);
  const switchSession = usePerchStore((s) => s.switchSession);
  const createSessionOnHost = usePerchStore((s) => s.createSessionOnHost);
  const workspaceCapabilities = usePerchStore((s) => s.workspaceCapabilities);
  const workspaceCapabilitiesByHost = usePerchStore((s) => s.workspaceCapabilitiesByHost);

  if (!open) return null;

  const groups = groupAllSessionsByProject(sessions);
  const workspaceNavigationEnabled = (activeHostId === "local"
    ? workspaceCapabilities
    : workspaceCapabilitiesByHost[activeHostId] ?? []
  ).includes("workspace.snapshot");

  function picked() {
    onClose();
    onPicked?.();
  }

  function handleSwitch(id: string) {
    switchSession(id);
    picked();
  }

  function handleNewSession() {
    createSessionOnHost(activeHostId);
    picked();
  }

  return (
    <div className="fixed inset-0 z-[3000] flex justify-end bg-[rgba(0,0,0,0.5)]" onClick={onClose}>
      <div
        className="flex h-full w-[min(360px,92vw)] flex-col overflow-hidden border-l border-l-overlay-0 bg-surface-0 shadow-[-8px_0_32px_rgba(0,0,0,0.5)]"
        data-testid="mobile-switcher"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-b-overlay-0 px-[0.9rem] pt-[calc(0.7rem_+_env(safe-area-inset-top))] pb-[0.7rem]">
          <span className="text-[0.95rem] font-semibold text-fg">Sessions</span>
          <button
            type="button"
            className="-my-2 -mr-2 grid size-11 cursor-pointer place-items-center text-[1.3rem] leading-none text-subtext-0 [background:none] [border:none] hover:text-fg"
            data-testid="mobile-switcher-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* A local-only install has nothing to switch between, as on the desktop sidebar. */}
        {(hosts.length > 0 || activeHostId !== "local") && (
          <button
            type="button"
            className="flex min-h-12 w-full shrink-0 cursor-pointer items-center gap-2 border-b border-b-overlay-0 bg-transparent px-[0.9rem] text-left text-[0.85rem] text-fg [font-family:inherit] [border-left:0] [border-right:0] [border-top:0] hover:bg-surface-1"
            data-testid="host-switcher"
            aria-haspopup="true"
            aria-expanded={hostAnchor != null}
            onClick={(e) => setHostAnchor(e.currentTarget.getBoundingClientRect())}
          >
            <HostStateDot state={activeHostState} />
            <span className="min-w-0 flex-1 overflow-hidden font-semibold text-ellipsis whitespace-nowrap">{activeHostEntry?.name ?? "This machine"}</span>
            <span className="shrink-0 text-[0.7rem] tracking-[0.04em] text-subtext-0 uppercase">{activeHostState}</span>
            <Chevron open />
          </button>
        )}

        <div className="shrink-0 border-b border-b-overlay-0 px-[0.9rem] py-[0.6rem]">
          <button
            type="button"
            className="min-h-11 w-full cursor-pointer rounded-ui bg-accent px-[0.6rem] py-[0.45rem] text-[0.85rem] font-semibold text-panel-bg [border:none] [font-family:inherit] disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="mobile-switcher-new-session"
            disabled={!connected || activeHostState !== "connected"}
            onClick={handleNewSession}
          >
            + New session
          </button>
        </div>

        {workspaceNavigationEnabled ? (
          <div className="flex-1 overflow-y-auto p-0">
            <WorkspaceOverview compact onNavigate={picked} />
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

        <div className="shrink-0 overflow-x-auto border-t border-t-overlay-0 px-[0.9rem] pt-2 pb-[calc(0.5rem_+_env(safe-area-inset-bottom))] text-[0.78rem] whitespace-nowrap text-subtext-0">
          <UsageSummary usage={usage} updatedAt={usageUpdatedAt} />
        </div>
        {hostAnchor && (
          <HostSwitcherPopover
            choices={choices}
            activeHostId={activeHostId}
            anchorRect={hostAnchor}
            onClose={() => setHostAnchor(null)}
            onSelect={setActiveHost}
            onToggleEnabled={(entry) => upsertHost({ ...entry, enabled: !entry.enabled })}
            onManage={() => { setSettingsOpen(true); onClose(); }}
          />
        )}
      </div>
    </div>
  );
}
