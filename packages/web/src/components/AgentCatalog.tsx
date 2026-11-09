/**
 * AgentCatalog.tsx: the Agents settings section. The page is `stock:settings-agents`
 * (`stock-ui/settings-agents/main.tsx`) or the person's package chosen for it; this file binds it to the store: which
 * host's catalog shows, fetching it, and every change to it. The phone keeps Perch's own page.
 */
import { useEffect, useState } from "react";
import { usePerchStore } from "../store";
import { openExternal } from "../links";
import { useIsMobileWidth } from "../responsive";
import AgentsSettings from "../stock-ui/settings-agents/main";
import { StockRoute } from "./mod-root";

export function AgentCatalog() {
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const hosts = usePerchStore((s) => s.hosts);
  const connected = usePerchStore((s) => s.connected);
  const [hostId, setHostId] = useState(activeHostId);
  const catalog = usePerchStore((s) => s.agentManifestsByHost[hostId]);
  const configurable = usePerchStore((s) => (hostId === "local" ? s.serverInfo?.capabilities : s.workspaceCapabilitiesByHost[hostId])?.includes("agent.provider.configure") ?? false);
  const discoverable = usePerchStore((s) => (hostId === "local" ? s.serverInfo?.capabilities : s.workspaceCapabilitiesByHost[hostId])?.includes("agent.manifest.list") ?? false);
  const fetch = usePerchStore((s) => s.fetchAgentManifests);
  const isMobile = useIsMobileWidth();
  useEffect(() => { if (connected && discoverable) fetch(hostId); }, [fetch, hostId, connected, discoverable]);
  // Only agents that start in a terminal are listed here.
  const agents = (catalog?.manifests ?? []).filter((entry) =>
    entry.supportedModes.includes("cli") && entry.capabilities.includes("interactiveTerminal"));
  const props = {
    connected, hostId, configurable, discoverable, agents,
    hosts: hosts.map((host) => ({ id: host.id, name: host.name })),
    hostName: hostId === "local" ? "this host" : hosts.find((host) => host.id === hostId)?.name ?? hostId,
    catalog: catalog && { state: catalog.state, error: catalog.error },
    actions: {
      selectHost: setHostId,
      refresh: () => { fetch(hostId); },
      setEnabled: (providerId: string, enabled: boolean) => { fetch(hostId, { providerId, enabled }); },
      setDefault: (providerId: string) => { fetch(hostId, { providerId, isDefault: true }); },
      openExternal,
    },
  };
  return <StockRoute name="settings-agents" props={props} stock={AgentsSettings} exact={isMobile} />;
}
