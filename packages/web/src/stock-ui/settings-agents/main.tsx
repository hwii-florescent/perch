//! Agents settings, the stock screen `stock:settings-agents`: the agents a host can run, which are enabled, which is
//! the default, and where to install a missing one. Settings > Agents shows it (the phone keeps Perch's own); or the
//! person's package chosen for it (`perch mod use stock:settings-agents <id>`) with the same props.
//!
//! The catalog (what each host reports, and which of it is listed here) and every change are Perch's (`agents`,
//! `actions`): enabling a missing agent asks first, and a link only opens after that answer. The rows are
//! `SettingsGroup` and `SettingRow` from `@perch/sdk`, so the Settings search finds them, and the question is
//! `ConfirmDialog`, so a copy chosen for `stock:confirm` draws it.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:settings-agents` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { useEffect, useState } from "react";
import { cn, ConfirmDialog, Select, SettingRow, SettingsGroup, settingsClass, type AgentsSettingsProps, type SettingsAgent } from "@perch/sdk";

const TOGGLE = "cursor-pointer rounded-ui bg-transparent px-[0.6rem] py-[0.25rem] text-[0.8rem] text-subtext-0 [border:0] [font:inherit] hover:text-fg focus-visible:[outline:2px_solid_var(--accent)] disabled:cursor-default disabled:opacity-[0.55] max-[700px]:min-h-9";

export default function AgentsSettings({ connected, hostId, hosts, hostName, catalog, agents, configurable, discoverable, actions }: AgentsSettingsProps) {
  const [installPrompt, setInstallPrompt] = useState<SettingsAgent | null>(null);
  useEffect(() => { setInstallPrompt(null); }, [hostId, connected, configurable]);
  const installUrl = installPrompt?.homepageUrl?.startsWith("https://") ? installPrompt.homepageUrl : null;
  const busy = !connected || catalog?.state === "loading";
  const { select, muted } = settingsClass;

  function row(entry: SettingsAgent) {
    const enabled = entry.enabled !== false;
    return <SettingRow key={entry.id} testId={`agent-catalog-${entry.id}`} title={entry.displayName} description={entry.launchCommand ?? entry.executable ?? entry.id}>
      {entry.isDefault && <span className="text-[0.75rem] font-medium text-accent">Default</span>}
      {configurable && <div className="flex items-center gap-0 rounded-ui bg-surface-1 p-[2px]" role="group" aria-label={`${entry.displayName} availability`}>
        {[true, false].map((value) => <button type="button" className={cn(TOGGLE, "aria-pressed:bg-surface-0 aria-pressed:text-fg")} key={String(value)} aria-pressed={enabled === value} disabled={busy}
          onClick={() => {
            if (value && !entry.available) setInstallPrompt(entry);
            else actions.setEnabled(entry.id, value);
          }}>{value ? "Enabled" : "Disabled"}</button>)}
      </div>}
      {configurable && entry.available && enabled && !entry.isDefault && <button type="button" className={select} disabled={busy}
        onClick={() => actions.setDefault(entry.id)}>Set default</button>}
      {entry.homepageUrl?.startsWith("https://") && <a className={cn(select, "flex items-center gap-1 no-underline")} href={entry.homepageUrl} target="_blank" rel="noopener noreferrer"
        aria-label={`${entry.available ? "Docs for" : "Install"} ${entry.displayName}`}>{entry.available ? "Docs" : "Install"}<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M9 2h5v5M14 2 7 9M6 3H3v10h10v-3" /></svg></a>}
    </SettingRow>;
  }
  return <div data-testid="agent-catalog">
    <SettingsGroup>
      <SettingRow title="Host" description="Run your agent’s CLI in a workspace folder. Install links open each agent’s setup instructions; Refresh checks this host again.">
        <Select className={select} ariaLabel="Agent host" value={hostId} onChange={actions.selectHost}
          options={[{ value: "local", label: "This host" }, ...hosts.map((host) => ({ value: host.id, label: host.name }))]} />
        <button type="button" className={select} disabled={busy || !discoverable} onClick={() => actions.refresh()}>Refresh</button>
      </SettingRow>
    </SettingsGroup>
    {!discoverable ? <p className={muted} role="status">This host does not expose an agent catalog. Update its Perch core to manage agents here.</p> : <>
      {catalog?.state === "loading" && <p className={muted} role="status">Checking agents…</p>}
      {catalog?.error && <p className={cn(muted, "text-red")} role="alert">{catalog.error} Use Refresh to try again.</p>}
      {[true, false].map((installed) => {
        const group = agents.filter((entry) => entry.available === installed);
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
        if (installUrl) actions.openExternal(installUrl);
        actions.setEnabled(installPrompt.id, true);
        setInstallPrompt(null);
      }}
    />}
  </div>;
}
