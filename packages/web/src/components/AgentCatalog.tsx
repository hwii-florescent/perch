import { useEffect, useState } from "react";
import { CATALOG_ACTION, CATALOG_TOGGLE, MUTED } from "./ui/settings";
import { cn } from "../lib/cn";
import type { AgentManifestSummary } from "@perch/shared";
import { usePerchStore } from "../store";
import { openExternal } from "../links";
import { ConfirmDialog } from "./ConfirmDialog";

const FIELD = "min-h-[44px] min-w-0 max-w-full rounded-ui bg-surface-0 px-[0.65rem] [border:none] py-2 text-fg [font:inherit] focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px]";

export function AgentCatalog() {
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const hosts = usePerchStore((s) => s.hosts);
  const connected = usePerchStore((s) => s.connected);
  const [hostId, setHostId] = useState(activeHostId);
  const [query, setQuery] = useState("");
  const [installPrompt, setInstallPrompt] = useState<AgentManifestSummary | null>(null);
  const catalog = usePerchStore((s) => s.agentManifestsByHost[hostId]);
  const configurable = usePerchStore((s) => (hostId === "local" ? s.serverInfo?.capabilities : s.workspaceCapabilitiesByHost[hostId])?.includes("agent.provider.configure") ?? false);
  const discoverable = usePerchStore((s) => (hostId === "local" ? s.serverInfo?.capabilities : s.workspaceCapabilitiesByHost[hostId])?.includes("agent.manifest.list") ?? false);
  const fetch = usePerchStore((s) => s.fetchAgentManifests);
  useEffect(() => { if (connected && discoverable) fetch(hostId); }, [fetch, hostId, connected, discoverable]);
  useEffect(() => { setInstallPrompt(null); }, [hostId, connected, configurable]);
  const hostName = hostId === "local" ? "this host" : hosts.find((host) => host.id === hostId)?.name ?? hostId;
  const installUrl = installPrompt?.homepageUrl?.startsWith("https://") ? installPrompt.homepageUrl : null;
  const busy = !connected || catalog?.state === "loading";
  const entries = (catalog?.manifests ?? []).filter((entry) =>
    entry.supportedModes.includes("cli") && entry.capabilities.includes("interactiveTerminal"));
  const matches = (entry: AgentManifestSummary) => `${entry.displayName} ${entry.launchCommand ?? entry.id}`.toLowerCase().includes(query.trim().toLowerCase());

  function row(entry: AgentManifestSummary) {
    const enabled = entry.enabled !== false;
    return <div className="agent-catalog__row py-4 [@media(min-width:620px)]:grid [@media(min-width:620px)]:grid-cols-[minmax(0,1fr)_auto] [@media(min-width:620px)]:items-center [@media(min-width:620px)]:gap-4" key={entry.id} data-testid={`agent-catalog-${entry.id}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 font-semibold">{entry.displayName}{entry.isDefault && <span className="text-[0.75rem] font-medium text-accent">Default</span>}</div>
        <code className="mt-[0.3rem] block text-[0.8rem] text-subtext-0 [overflow-wrap:anywhere]" title={entry.launchCommand}>{entry.launchCommand ?? entry.executable ?? entry.id}</code>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 [@media(min-width:620px)]:mt-0 [@media(min-width:620px)]:justify-end">
        {configurable && <div className="flex items-center gap-0 rounded-ui p-[2px]" role="group" aria-label={`${entry.displayName} availability`}>
          {[true, false].map((value) => <button type="button" className={cn(CATALOG_TOGGLE, "aria-pressed:bg-surface-1 aria-pressed:text-fg")} key={String(value)} aria-pressed={enabled === value} disabled={busy}
            onClick={() => {
              if (value && !entry.available) setInstallPrompt(entry);
              else fetch(hostId, { providerId: entry.id, enabled: value });
            }}>{value ? "Enabled" : "Disabled"}</button>)}
        </div>}
        {configurable && entry.available && enabled && !entry.isDefault && <button type="button" className={CATALOG_ACTION} disabled={busy}
          onClick={() => fetch(hostId, { providerId: entry.id, isDefault: true })}>Set default</button>}
        {entry.homepageUrl?.startsWith("https://") && <a className={CATALOG_ACTION} href={entry.homepageUrl} target="_blank" rel="noopener noreferrer"
          aria-label={`${entry.available ? "Docs for" : "Install"} ${entry.displayName}`}>{entry.available ? "Docs" : "Install"}<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M9 2h5v5M14 2 7 9M6 3H3v10h10v-3" /></svg></a>}
      </div>
    </div>;
  }
  return <div className="px-4 pt-1 pb-4" data-testid="agent-catalog">
    <p className={MUTED}>Run your agent’s CLI in a workspace folder. Install links open each agent’s setup instructions; Refresh checks this host again.</p>
    <div className="my-4 flex items-center justify-between gap-2">
      <label className="flex items-center gap-2">Host <select className={FIELD} aria-label="Agent host" value={hostId} onChange={(e) => setHostId(e.target.value)}>
        <option value="local">This host</option>{hosts.map((host) => <option key={host.id} value={host.id}>{host.name}</option>)}
      </select></label>
      <button type="button" className={CATALOG_ACTION} disabled={busy || !discoverable} onClick={() => fetch(hostId)}>Refresh</button>
    </div>
    {!discoverable ? <p role="status">This host does not expose an agent catalog. Update its Perch core to manage agents here.</p> : <>
      <input className={cn(FIELD, "box-border w-full")} type="search" aria-label="Search agents" placeholder="Search agents or commands…" value={query} onChange={(e) => setQuery(e.target.value)} />
      {catalog?.state === "loading" && <p role="status">Checking agents…</p>}
      {catalog?.error && <p role="alert">{catalog.error} Use Refresh to try again.</p>}
      {catalog?.state === "ready" && entries.filter(matches).length === 0 && <p role="status">No agents match your search.</p>}
      {[true, false].map((installed) => {
        const group = entries.filter((entry) => entry.available === installed);
        const visible = group.filter(matches);
        if (!visible.length) return null;
        return <section key={String(installed)} aria-label={installed ? "Installed agents" : "Available to install"}>
          <h3 className="mt-[1.75rem] mb-2 flex items-center gap-2 text-[1rem]">{installed ? "Installed" : "Available to install"}<span className="text-[0.8rem] font-normal text-subtext-0">{group.length} agents</span></h3>
          {visible.map(row)}
        </section>;
      })}
    </>}
    {installPrompt && connected && configurable && <ConfirmDialog
      message={`${installPrompt.displayName} isn’t installed on ${hostName}.\n\n${installUrl ? "Enable it and open its setup instructions?" : "Enable it anyway?"} Install it on ${hostName}, then choose Refresh. It will appear in the agent picker only after Perch detects it.`}
      confirmLabel={installUrl ? "Enable & open setup" : "Enable anyway"}
      busy={busy}
      onCancel={() => setInstallPrompt(null)}
      onConfirm={() => {
        if (busy) return;
        if (installUrl) openExternal(installUrl);
        fetch(hostId, { providerId: installPrompt.id, enabled: true });
        setInstallPrompt(null);
      }}
    />}
  </div>;
}
