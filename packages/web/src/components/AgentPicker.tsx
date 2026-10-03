import { useEffect, useRef } from "react";
import { usePerchStore } from "../store";
import { AGENTS } from "../models";
import { cn } from "../lib/cn";

/** The native select, with a drawn chevron (WebKit ignores min-height on a native select).
 * Phones lift the min-height to a 44px touch target. */
export const AGENT_PICKER = "min-h-[32px] [.app--mobile_&]:min-h-[44px] w-full appearance-none rounded-ui border border-overlay-0 py-[0.3rem] pr-[1.6rem] pl-[0.45rem] text-fg [background:linear-gradient(45deg,transparent_50%,var(--subtext-0)_50%)_right_0.85rem_center/5px_5px_no-repeat,linear-gradient(135deg,var(--subtext-0)_50%,transparent_50%)_right_0.55rem_center/5px_5px_no-repeat,var(--panel-bg)] [font:inherit] focus-visible:border-accent focus-visible:[outline:none]";

/** The CLI agents `hostId` can start in a pane (its enabled, installed
 * manifests), fetched on demand. Shared by every "start a session" surface. */
export function useAgentChoices(hostId: string) {
  const connected = usePerchStore((s) => s.connected);
  const discovery = usePerchStore((s) => (hostId === "local" ? s.serverInfo?.capabilities : s.workspaceCapabilitiesByHost[hostId])?.includes("agent.manifest.list") ?? false);
  const catalog = usePerchStore((s) => s.agentManifestsByHost[hostId]);
  const fetch = usePerchStore((s) => s.fetchAgentManifests);
  useEffect(() => { if (connected && discovery) fetch(hostId); }, [connected, discovery, fetch, hostId]);
  const choices: { id: string; label: string; isDefault?: boolean }[] = discovery ? (catalog?.manifests ?? []).filter((entry) => entry.available && entry.enabled !== false && entry.supportedModes.includes("cli") && entry.capabilities.includes("interactiveTerminal"))
    .map((entry) => ({ id: entry.id, label: entry.displayName, isDefault: entry.isDefault })) : AGENTS;
  return { connected, discovery, catalog, choices };
}

/** Installed CLI choices for workspace/session creation. Legacy hosts retain
 * their two known integrations until they advertise manifest discovery. */
export function AgentPicker({ value, onChange, onManage, hostId: hostIdProp, testIdPrefix = "new-session-agent", className }: {
  value: string;
  onChange: (agent: string) => void;
  onManage?: () => void;
  hostId?: string;
  testIdPrefix?: string;
  className?: string;
}) {
  const activeHost = usePerchStore((s) => s.activeHostId);
  const hostId = hostIdProp ?? activeHost;
  const { connected, discovery, catalog, choices } = useAgentChoices(hostId);
  const manage = usePerchStore((s) => s.openAgentCatalog);
  const seededHost = useRef<string | null>(null);
  const preferred = choices.find((entry) => entry.isDefault)?.id;
  const first = choices[0]?.id;
  const valid = choices.some((entry) => entry.id === value);
  useEffect(() => {
    if (!discovery || catalog?.state !== "ready") return;
    if (seededHost.current !== hostId) {
      seededHost.current = hostId;
      if (preferred && preferred !== value) { onChange(preferred); return; }
    }
    if (!valid && first) onChange(first);
  }, [catalog?.state, discovery, first, hostId, onChange, preferred, valid, value]);
  return <div>
    <select className={cn(AGENT_PICKER, className)} aria-label="Agent"
      data-testid={testIdPrefix} value={valid ? value : ""} disabled={!connected || (discovery && catalog?.state !== "ready") || !choices.length}
      onChange={(event) => onChange(event.target.value)}>
      {choices.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
    </select>
    {discovery && <button type="button" className="agent-catalog__action" onClick={() => { onManage?.(); manage(); }}>Manage agents</button>}
    {discovery && catalog?.state === "error" && <p role="alert">{catalog.error}</p>}
    {discovery && catalog?.state === "ready" && !choices.length && <p role="status">Enable or install an agent in Manage agents.</p>}
  </div>;
}
