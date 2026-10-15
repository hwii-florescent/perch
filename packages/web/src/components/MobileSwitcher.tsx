/**
 * MobileSwitcher.tsx — the phone's `<Sidebar/>`: a slide-over built from the
 * sidebar's own parts (host picker, "+ New session" harness picker,
 * `WorkspaceOverview`, or `ProjectList` for a host with no workspace support),
 * plus plan usage in the footer (the phone has no status bar). Settings is in
 * the header. Choosing a session or workspace closes the panel; `onPicked`
 * fires for that (not on a plain close), so the shell can show the session pane.
 *
 * Follows `SettingsModal.tsx`'s non-portal `position: fixed` overlay pattern
 * (not a portal like `ModelChip`/`Navigator`) since it's a full-panel
 * slide-over rather than an anchored popover.
 */
import { useState } from "react";
import { usePerchStore } from "../store";
import { WorkspaceOverview } from "./WorkspaceOverview";
import { UsageSummary, useUsage } from "../StatusBar";
import { HostSwitcherPopover, NewSessionPopover, ProjectList, useHostChoices } from "../Sidebar";
import { HostStateDot } from "./HostStateDot";
import { Chevron } from "./ui/chevron";

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
  const [newAnchor, setNewAnchor] = useState<DOMRect | null>(null);
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const connected = usePerchStore((s) => s.connected);
  const createSessionOnHost = usePerchStore((s) => s.createSessionOnHost);
  const workspaceProjects = usePerchStore((s) => s.workspaceProjects);
  const workspaceCapabilities = usePerchStore((s) => s.workspaceCapabilities);
  const workspaceCapabilitiesByHost = usePerchStore((s) => s.workspaceCapabilitiesByHost);

  if (!open) return null;

  const workspaceNavigationEnabled = (activeHostId === "local"
    ? workspaceCapabilities
    : workspaceCapabilitiesByHost[activeHostId] ?? []
  ).includes("workspace.snapshot");
  // New sessions start in a listed project or in Chats, never an unadded folder.
  const projectCwds = workspaceProjects.filter((project) => project.hostId === activeHostId).map((project) => project.path);
  const canCreate = connected && (activeHostId === "local" || activeHostState === "connected");

  function picked() {
    onClose();
    onPicked?.();
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

        <button
          type="button"
          className="min-h-12 w-full shrink-0 cursor-pointer border-b border-b-overlay-0 bg-transparent px-[0.9rem] text-left text-[0.85rem] font-semibold text-fg [font-family:inherit] [border-left:0] [border-right:0] [border-top:0] hover:bg-surface-1 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="mobile-switcher-new-session"
          disabled={!canCreate}
          onClick={(e) => setNewAnchor(e.currentTarget.getBoundingClientRect())}
        >
          + New session
        </button>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {workspaceNavigationEnabled ? <WorkspaceOverview compact onNavigate={picked} /> : <ProjectList />}
        </div>

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
        {newAnchor && (
          <NewSessionPopover
            hostId={activeHostId}
            projectCwds={projectCwds}
            anchorRect={newAnchor}
            onClose={() => setNewAnchor(null)}
            onSelect={(cwd, agent) => { createSessionOnHost(activeHostId, cwd, agent); picked(); }}
          />
        )}
      </div>
    </div>
  );
}
