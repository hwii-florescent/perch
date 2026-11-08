import { useEffect, useState } from "react";
import { MUTED, SELECT } from "./ui/settings";
import { SettingRow, SettingsGroup } from "./ui/setting-row";
import { Select } from "./ui/select";
import { cn } from "../lib/cn";
import type { AgentManifestSummary } from "@perch/shared";
import { usePerchStore } from "../store";
import { openExternal } from "../links";
import { ConfirmDialog } from "./ConfirmDialog";

const TOGGLE = "cursor-pointer rounded-ui bg-transparent px-[0.6rem] py-[0.25rem] text-[0.8rem] text-subtext-0 [border:0] [font:inherit] hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] disabled:cursor-default disabled:opacity-[0.55] max-[700px]:min-h-9";

/** The Agents settings section. Built from the same SettingsGroup/SettingRow blocks as every other
 * section, so the global settings search filters its rows too. */
export function AgentCatalog() {
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const hosts = usePerchStore((s) => s.hosts);
  const connected = usePerchStore((s) => s.connected);
  const [hostId, setHostId] = useState(activeHostId);
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

  function row(entry: AgentManifestSummary) {
    const enabled = entry.enabled !== false;
    return <SettingRow key={entry.id} testId={`agent-catalog-${entry.id}`} title={entry.displayName} description={entry.launchCommand ?? entry.executable ?? entry.id}>
      {entry.isDefault && <span className="text-[0.75rem] font-medium text-accent">Default</span>}
      {configurable && <div className="flex items-center gap-0 rounded-ui bg-surface-1 p-[2px]" role="group" aria-label={`${entry.displayName} availability`}>
        {[true, false].map((value) => <button type="button" className={cn(TOGGLE, "aria-pressed:bg-surface-0 aria-pressed:text-fg")} key={String(value)} aria-pressed={enabled === value} disabled={busy}
          onClick={() => {
            if (value && !entry.available) setInstallPrompt(entry);
            else fetch(hostId, { providerId: entry.id, enabled: value });
          }}>{value ? "Enabled" : "Disabled"}</button>)}
      </div>}
      {configurable && entry.available && enabled && !entry.isDefault && <button type="button" className={SELECT} disabled={busy}
        onClick={() => fetch(hostId, { providerId: entry.id, isDefault: true })}>Set default</button>}
      {entry.homepageUrl?.startsWith("https://") && <a className={cn(SELECT, "flex items-center gap-1 no-underline")} href={entry.homepageUrl} target="_blank" rel="noopener noreferrer"
        aria-label={`${entry.available ? "Docs for" : "Install"} ${entry.displayName}`}>{entry.available ? "Docs" : "Install"}<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M9 2h5v5M14 2 7 9M6 3H3v10h10v-3" /></svg></a>}
    </SettingRow>;
  }
  return <div data-testid="agent-catalog">
    <SettingsGroup>
      <SettingRow title="Host" description="Run your agent’s CLI in a workspace folder. Install links open each agent’s setup instructions; Refresh checks this host again.">
        <Select className={SELECT} ariaLabel="Agent host" value={hostId} onChange={setHostId}
          options={[{ value: "local", label: "This host" }, ...hosts.map((host) => ({ value: host.id, label: host.name }))]} />
        <button type="button" className={SELECT} disabled={busy || !discoverable} onClick={() => fetch(hostId)}>Refresh</button>
      </SettingRow>
    </SettingsGroup>
    {!discoverable ? <p className={MUTED} role="status">This host does not expose an agent catalog. Update its Perch core to manage agents here.</p> : <>
      {catalog?.state === "loading" && <p className={MUTED} role="status">Checking agents…</p>}
      {catalog?.error && <p className={cn(MUTED, "text-red")} role="alert">{catalog.error} Use Refresh to try again.</p>}
      {[true, false].map((installed) => {
        const group = entries.filter((entry) => entry.available === installed);
        if (!group.length) return null;
        return <SettingsGroup key={String(installed)} ariaLabel={installed ? "Installed agents" : "Available to install"} title={`${installed ? "Installed" : "Available to install"} · ${group.length}`}>
          {group.map(row)}
        </SettingsGroup>;
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
