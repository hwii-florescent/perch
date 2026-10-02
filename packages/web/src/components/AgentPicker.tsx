import { useEffect, useRef } from "react";
import { usePerchStore } from "../store";
import { AGENTS } from "../models";

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
    <select className={"agent-picker" + (className ? ` ${className}` : "")} aria-label="Agent"
      data-testid={testIdPrefix} value={valid ? value : ""} disabled={!connected || (discovery && catalog?.state !== "ready") || !choices.length}
      onChange={(event) => onChange(event.target.value)}>
      {choices.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
    </select>
    {discovery && <button type="button" className="agent-catalog__action" onClick={() => { onManage?.(); manage(); }}>Manage agents</button>}
    {discovery && catalog?.state === "error" && <p role="alert">{catalog.error}</p>}
    {discovery && catalog?.state === "ready" && !choices.length && <p role="status">Enable or install an agent in Manage agents.</p>}
  </div>;
}
