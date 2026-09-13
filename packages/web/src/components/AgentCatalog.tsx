import { useEffect, useState } from "react";
import type { AgentManifestSummary } from "@perch/shared";
import { usePerchStore } from "../store";

export function AgentCatalog() {
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const hosts = usePerchStore((s) => s.hosts);
  const connected = usePerchStore((s) => s.connected);
  const [hostId, setHostId] = useState(activeHostId);
  const [query, setQuery] = useState("");
  const catalog = usePerchStore((s) => s.agentManifestsByHost[hostId]);
  const configurable = usePerchStore((s) => (hostId === "local" ? s.serverInfo?.capabilities : s.workspaceCapabilitiesByHost[hostId])?.includes("agent.provider.configure") ?? false);
  const discoverable = usePerchStore((s) => (hostId === "local" ? s.serverInfo?.capabilities : s.workspaceCapabilitiesByHost[hostId])?.includes("agent.manifest.list") ?? false);
  const fetch = usePerchStore((s) => s.fetchAgentManifests);
  useEffect(() => { if (connected && discoverable) fetch(hostId); }, [fetch, hostId, connected, discoverable]);
  const busy = !connected || catalog?.state === "loading";
  const entries = (catalog?.manifests ?? []).filter((entry) =>
    entry.supportedModes.includes("cli") && entry.capabilities.includes("interactiveTerminal"));
  const matches = (entry: AgentManifestSummary) => `${entry.displayName} ${entry.launchCommand ?? entry.id}`.toLowerCase().includes(query.trim().toLowerCase());

  function row(entry: AgentManifestSummary) {
    const enabled = entry.enabled !== false;
    return <div className="agent-catalog__row" key={entry.id} data-testid={`agent-catalog-${entry.id}`}>
      <div className="agent-catalog__identity">
        <div className="agent-catalog__name">{entry.displayName}{entry.isDefault && <span className="agent-catalog__default">Default</span>}</div>
        <code className="agent-catalog__command" title={entry.launchCommand}>{entry.launchCommand ?? entry.executable ?? entry.id}</code>
      </div>
      <div className="agent-catalog__controls">
        {configurable && <div className="agent-catalog__toggle" role="group" aria-label={`${entry.displayName} availability`}>
          {[true, false].map((value) => <button type="button" key={String(value)} aria-pressed={enabled === value} disabled={busy}
            onClick={() => fetch(hostId, { providerId: entry.id, enabled: value })}>{value ? "Enabled" : "Disabled"}</button>)}
        </div>}
        {configurable && entry.available && enabled && !entry.isDefault && <button type="button" className="agent-catalog__action" disabled={busy}
          onClick={() => fetch(hostId, { providerId: entry.id, isDefault: true })}>Set default</button>}
        {entry.homepageUrl?.startsWith("https://") && <a className="agent-catalog__action" href={entry.homepageUrl} target="_blank" rel="noopener noreferrer"
          aria-label={`${entry.available ? "Docs for" : "Install"} ${entry.displayName}`}>{entry.available ? "Docs" : "Install"}<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M9 2h5v5M14 2 7 9M6 3H3v10h10v-3" /></svg></a>}
      </div>
    </div>;
  }
  return <div className="agent-catalog" data-testid="agent-catalog">
    <p className="settings-modal__muted">Run your agent’s CLI in a workspace folder. Install links open each agent’s setup instructions; Refresh checks this host again.</p>
    <div className="agent-catalog__toolbar">
      <label>Host <select aria-label="Agent host" value={hostId} onChange={(e) => setHostId(e.target.value)}>
        <option value="local">This host</option>{hosts.map((host) => <option key={host.id} value={host.id}>{host.name}</option>)}
      </select></label>
      <button type="button" className="agent-catalog__action" disabled={busy || !discoverable} onClick={() => fetch(hostId)}>Refresh</button>
    </div>
    {!discoverable ? <p role="status">This host does not expose an agent catalog. Update its Perch core to manage agents here.</p> : <>
      <input className="agent-catalog__search" type="search" aria-label="Search agents" placeholder="Search agents or commands…" value={query} onChange={(e) => setQuery(e.target.value)} />
      {catalog?.state === "loading" && <p role="status">Checking agents…</p>}
      {catalog?.error && <p role="alert">{catalog.error} Use Refresh to try again.</p>}
      {catalog?.state === "ready" && entries.filter(matches).length === 0 && <p role="status">No agents match your search.</p>}
      {[true, false].map((installed) => {
        const group = entries.filter((entry) => entry.available === installed);
        const visible = group.filter(matches);
        if (!visible.length) return null;
        return <section key={String(installed)} aria-label={installed ? "Installed agents" : "Available to install"}>
          <h3 className="agent-catalog__heading">{installed ? "Installed" : "Available to install"}<span>{group.length} agents</span></h3>
          {visible.map(row)}
        </section>;
      })}
    </>}
  </div>;
}
