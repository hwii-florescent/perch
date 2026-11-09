import { useEffect } from "react";
import { usePerchStore } from "../store";
import { AGENTS } from "../models";

/** Trigger look for an agent `Select`. Phones lift the min-height to a 44px touch target. */
export const AGENT_PICKER = "min-h-[32px] [.app--mobile_&]:min-h-[44px] w-full rounded-ui py-[0.3rem] pr-[0.55rem] pl-[0.45rem] text-[0.8rem] text-fg bg-[var(--picker-bg,var(--panel-bg))] [font-family:inherit] focus-visible:[outline:1px_solid_var(--accent)]";

/** The CLI agents `hostId` can start in a pane (its enabled, installed
 * manifests), fetched on demand. Shared by every "start a session" surface
 * (`useAgentChoices` in `@perch/sdk` too). Legacy hosts retain their two known
 * integrations until they advertise manifest discovery. */
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
