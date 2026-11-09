//! The sidebar's host chip and switcher, part of the stock screen `stock:sidebar`. The chip says which machine the
//! sidebar shows (this one: its badge, hostname, platform and the focused folder; a remote: its name, state and
//! address or last error). The switcher lists this machine and every configured host with its state, turns a
//! remote on or off as its Settings switch does (`host.enable`), and links to Settings > Hosts.
import { useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { cn, HostStateDot, menuItemClass, runCommand, type Hosts } from "@perch/sdk";

const ENV_BADGE = "sidebar__env-badge shrink-0 rounded-ui px-[0.4rem] py-[0.15rem] text-[0.65rem] font-bold tracking-[0.06em] uppercase";
const ENV_BADGE_LOCAL = `${ENV_BADGE} bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-accent`;
const ENV_BADGE_REMOTE = `${ENV_BADGE} bg-[color-mix(in_srgb,var(--yellow)_15%,transparent)] text-yellow`;
const ENV_BADGE_SSH = `${ENV_BADGE} bg-[color-mix(in_srgb,var(--blue)_15%,transparent)] text-blue`;
const ENV_ROW = "flex flex-wrap items-center gap-[0.4rem]";
const ENV_HOST = "sidebar__env-host min-w-0 overflow-hidden text-[0.75rem] font-medium text-ellipsis whitespace-nowrap text-fg";
const ENV_PLATFORM = "ml-auto text-[0.7rem] text-subtext-0";
const ENV_CWD = "sidebar__env-cwd mt-[0.3rem] overflow-hidden text-[0.7rem] text-ellipsis whitespace-nowrap text-subtext-0";
// Lives inside the host-switcher button, which owns the bottom border.
const ENV = "min-w-0 flex-1 px-[0.65rem] pt-[0.6rem] pb-2";
const POPOVER_ITEM = "flex min-h-0 max-[700px]:min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-[0.45rem] bg-transparent px-[0.6rem] py-[0.45rem] text-left text-[0.8rem] text-fg [font-family:inherit] [border:none] hover:bg-surface-1";

/** How this page reaches its core: over SSH, on this machine, or from elsewhere. */
function envBadge(isSsh: boolean | undefined): [string, string] {
  if (isSsh) return [ENV_BADGE_SSH, "SSH"];
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" ? [ENV_BADGE_LOCAL, "LOCAL"] : [ENV_BADGE_REMOTE, "REMOTE"];
}

/** The chip's content for the shown host. */
export function HostChip({ hosts }: { hosts: Hosts }) {
  if (hosts.activeId !== "local") {
    const { active } = hosts;
    const line = active.error ?? active.address ?? "";
    return (
      <div className={ENV}>
        <div className={ENV_ROW}>
          <span className={ENV_BADGE_SSH}>HOST</span>
          <span className={ENV_HOST}>{active.name}</span>
          <span className={ENV_PLATFORM}>{active.state}</span>
        </div>
        <div className={ENV_CWD} title={line}>{line}</div>
      </div>
    );
  }
  const { hostname, isSsh, platform, cwd, branch } = hosts.local;
  const [badgeClass, badgeLabel] = envBadge(isSsh);
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

export function HostSwitcherPopover({ hosts, anchorRect, onClose, onManage }: {
  hosts: Hosts;
  anchorRect: DOMRect;
  onClose: () => void;
  onManage: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const top = anchorRect.bottom + 4;
  const style: CSSProperties = {
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
    <div className="flex max-w-[320px] min-w-[200px] flex-col overflow-hidden rounded-ui bg-surface-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]" data-testid="host-switcher-popover" ref={popoverRef} style={style}>
      <div className="min-h-0 overflow-y-auto">
        {hosts.list.map((host) => (
          <div key={host.id} className={cn("host-switcher-popover__row flex flex-col", host.id === hosts.activeId && "bg-surface-0")}>
            <div className="flex items-center">
              <button
                type="button"
                className={POPOVER_ITEM}
                data-testid={`host-option-${host.id}`}
                title={host.detail ?? host.name}
                onClick={() => {
                  runCommand("host.select", { id: host.id });
                  onClose();
                }}
              >
                <HostStateDot state={host.state} error={host.error} />
                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{host.name}</span>
                {host.direct && (
                  <span
                    className="shrink-0 rounded-[3px] px-[0.3rem] py-[0.05rem] text-[0.6rem] tracking-[0.04em] text-mauve uppercase"
                    data-testid={`host-direct-badge-${host.id}`}
                    title="Direct mode: no perch on the remote — turns run detached over SSH and survive disconnects"
                  >
                    direct
                  </span>
                )}
                <span className="shrink-0 text-[0.66rem] tracking-[0.04em] text-subtext-0 uppercase">{host.state}</span>
              </button>
              {host.enabled !== undefined && (
                <label className="flex cursor-pointer items-center pr-2" title="Enabled">
                  <input
                    type="checkbox"
                    data-testid={`host-toggle-${host.id}`}
                    checked={host.enabled}
                    onChange={() => runCommand("host.enable", { id: host.id, enabled: !host.enabled })}
                  />
                </label>
              )}
            </div>
            {host.state === "error" && host.error && (
              <div
                className="overflow-hidden pr-[0.6rem] pb-[0.4rem] pl-[1.55rem] text-[0.68rem] text-ellipsis whitespace-nowrap text-red"
                data-testid={`host-error-${host.id}`}
                title={host.error}
              >
                {host.error}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="h-px bg-overlay-0" />
      <button
        type="button"
        className={menuItemClass()}
        data-testid="host-switcher-manage"
        onClick={() => {
          onManage();
          onClose();
        }}
      >
        Manage hosts…
      </button>
    </div>,
    document.body,
  );
}
