//! The sidebar's body, part of the stock screen `stock:sidebar`: the host chip (only once there is more than this
//! machine), New session, then the active host's projects (`WorkspaceOverview`) or, for a host without projects,
//! its sessions by folder (`FolderList`). The phone's switcher shows this same body (`compact`: no drag, no key
//! hint; `onNavigate` once something is chosen, so the panel can close).
import { useState } from "react";
import { cn, keyLabel, runCommand, segmentClass, useHosts } from "@perch/sdk";
import { FolderList } from "./folders";
import { HostChip, HostSwitcherPopover } from "./hosts";
import { PlusIcon } from "./icons";
import { WorkspaceOverview } from "./overview";

export function SidebarContent({ compact = false, onNavigate, onManageHosts }: {
  compact?: boolean;
  onNavigate?: () => void;
  /** After Manage hosts… opened Settings (the phone closes its panel). */
  onManageHosts?: () => void;
}) {
  const hosts = useHosts();
  const [hostAnchor, setHostAnchor] = useState<DOMRect | null>(null);
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* A local-only install has nothing to switch between. */}
        {(hosts.list.length > 1 || hosts.activeId !== "local") && (
          <button
            type="button"
            className="flex w-full shrink-0 cursor-pointer items-start gap-[0.3rem] bg-transparent text-left text-fg [font-family:inherit] [transition:background_0.12s_ease] hover:bg-surface-1"
            data-testid="host-switcher"
            title="Switch host"
            aria-haspopup="true"
            aria-expanded={hostAnchor != null}
            onClick={(e) => setHostAnchor(e.currentTarget.getBoundingClientRect())}
          >
            <HostChip hosts={hosts} />
            <span className="shrink-0 pt-[0.6rem] pr-2 text-[0.7rem] text-subtext-0" aria-hidden="true">▾</span>
          </button>
        )}

        <div className="flex shrink-0 flex-col items-stretch px-[3px]">
          <button
            type="button"
            className={cn(segmentClass(), "w-full shrink-0 gap-2 rounded-ui px-[0.9rem] py-[0.55rem] text-left text-[0.82rem] font-semibold text-fg min-[701px]:px-3 min-[701px]:text-[12.5px] min-[701px]:font-medium")}
            data-testid={`new-session-${hosts.activeId}`}
            disabled={!hosts.canCreate}
            onClick={() => { runCommand("sessions.new"); onNavigate?.(); }}
          >
            <PlusIcon className="shrink-0 text-subtext-0" />
            New session
            {!compact && <span className="ml-auto text-[0.7rem] font-normal text-subtext-0">{keyLabel("cmd+shift+t")}</span>}
          </button>
        </div>

        {hosts.workspaces ? <WorkspaceOverview compact={compact} onNavigate={onNavigate} /> : <FolderList />}
      </div>

      {hostAnchor && (
        <HostSwitcherPopover
          hosts={hosts}
          anchorRect={hostAnchor}
          onClose={() => setHostAnchor(null)}
          onManage={() => { runCommand("app.settings"); onManageHosts?.(); }}
        />
      )}
    </>
  );
}
