//! Permissions settings, the stock screen `stock:settings-permissions` (macOS desktop app only): what macOS lets Perch
//! and the terminals it runs access, each as granted, not granted or unable to verify, with an Allow button that opens
//! macOS System Settings. Settings > Permissions and the first-run permissions dialog show it; or the person's
//! package chosen for it (`perch mod use stock:settings-permissions <id>`) with the same props.
//!
//! Every check, request and restart goes through Perch's native bridge, one at a time (`actions`, `pending`), and Perch
//! owns the comparison of the app with its terminals. Opening System Settings is never treated as a grant. Restarting
//! the terminal host ends running terminals, so this page asks first. The rows are `SettingsGroup` and `SettingRow`
//! from `@perch/sdk`.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:settings-permissions` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { useState } from "react";
import { SettingRow, SettingsGroup, settingsClass, type MacPermissionState, type PermissionsSettingsProps } from "@perch/sdk";

function PermissionMark({ state, label, name }: { state: MacPermissionState; label: string; name?: string }) {
  const text = state === "granted" ? "Granted" : state === "notGranted" ? "Not granted" : "Unable to verify";
  return (
    <span className="inline-flex items-center gap-1 text-[0.75rem] text-fg" aria-label={`${name ? `${name} · ` : ""}${label}: ${text}`} title={text}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {state === "granted" ? <path d="m3 8 3 3 7-7" /> : state === "notGranted" ? <path d="m4 4 8 8M12 4l-8 8" /> : <><path d="M6 5a2 2 0 0 1 4 0c0 2-2 2-2 4" /><path d="M8 12h.01" /></>}
      </svg>
      <span>{label}</span>
    </span>
  );
}

export default function PermissionsSettings({ report, pending, error, actions }: PermissionsSettingsProps) {
  const [confirmRestart, setConfirmRestart] = useState(false);
  const { catalogToggle: toggle, muted } = settingsClass;
  return (
    <div data-testid="mac-permissions">
      <p className="m-0 mb-4 text-[0.85rem] text-fg">
        Choose what perch and the tools you run may access. Allow opens macOS System Settings; you still decide there. All permissions are optional.
      </p>
      {report?.host?.attribution === "severed" && (
        <div className="mb-4 text-[0.8rem] text-fg" role="status" data-testid="host-severed">
          <p className="m-0">Terminals run from an older perch build that was replaced, so macOS no longer applies perch's permissions to them. Restarting the terminal host fixes that.</p>
          {confirmRestart ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span>{report.host.liveSessions === 0 ? "No terminals are running." : `This ends ${report.host.liveSessions} running terminal${report.host.liveSessions === 1 ? "" : "s"}, including agents and anything they started.`}</span>
              <button type="button" className={toggle} disabled={pending !== null} onClick={() => { void actions.restartHost().then((restarted) => { if (restarted) setConfirmRestart(false); }); }}>{pending === "permissions_restart_host" ? "Restarting…" : "Restart terminal host"}</button>
              <button type="button" className={toggle} disabled={pending !== null} onClick={() => setConfirmRestart(false)}>Cancel</button>
            </div>
          ) : (
            <button type="button" className={`${toggle} mt-2`} disabled={pending !== null} onClick={() => setConfirmRestart(true)}>Restart terminal host…</button>
          )}
        </div>
      )}
      <SettingsGroup>
        {!report && <p className="m-0 py-4 text-[0.8rem] text-subtext-0" role="status">{pending ? "Checking macOS access…" : "Permission status unavailable. Try Refresh."}</p>}
        {report?.app.checks.map((check) => (
          <SettingRow key={check.id} title={check.title} description={check.description}>
            <div className="flex flex-col items-end gap-1">
              <PermissionMark state={check.state} name={check.title} label="App" />
              {report.terminal && <PermissionMark state={report.terminal.checks.find((c) => c.id === check.id)?.state ?? "unknown"} name={check.title} label="Terminal" />}
            </div>
            <button type="button" className={toggle} aria-label={`Allow ${check.title}`} disabled={pending !== null} onClick={() => actions.allow(check.id)}>
              {pending === check.id ? "Opening…" : "Allow"}
            </button>
          </SettingRow>
        ))}
      </SettingsGroup>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={toggle} disabled={pending !== null} onClick={() => actions.refresh()}>Refresh</button>
        <button type="button" className={toggle} disabled={pending !== null} onClick={() => actions.verify()}>{pending === "permissions_verify" ? "Verifying…" : "Verify terminals"}</button>
      </div>
      {error && <p className="mt-2 text-[0.8rem] text-red" role="alert">Could not check or request permission: {error}</p>}
      {report?.terminal && <p className={muted} role="status" data-testid="permission-comparison">
        {report.comparison === "match" ? "App and terminal checks match. Matching checks can include permissions that are not granted." : report.comparison === "different" ? "App and terminal access differ. Review the individual marks before relying on a grant." : "Some checks could not be verified. Compare the app and terminal marks above."}
      </p>}
      <p className={muted}>Ad-hoc builds may need permissions enabled again after an update.</p>
      {report && <details className="mt-3 text-[0.75rem] text-subtext-0">
        <summary className="cursor-pointer">About permissions and process checks</summary>
        <p>Verify terminals runs a short read-only shell through the real terminal host. It does not touch existing sessions. A matching result is not a guarantee for every external tool or sandbox.</p>
        <p>App PID {report.app.pid}{report.daemon && ` · Terminal host PID ${report.daemon.pid}`}{report.terminal && ` · Probe PID ${report.terminal.pid}`}</p>
        {report.daemon && <ul className="pl-4">{report.daemon.checks.map((check) => <li key={check.id}><PermissionMark state={check.state} label={`Host · ${check.title}`} /></li>)}</ul>}
        {report.note && <p>{report.note}</p>}
      <p className={muted}>Local builds are ad-hoc signed. After a rebuild, macOS may show perch enabled while access no longer matches. Toggle the entry off and on, or remove and add the current perch app again. Restarting an old terminal host ends its sessions; perch never does that automatically.</p>
      <p className={muted}>Automation is per target app; other apps may ask later. Normal browser tabs need none of these grants. External computer-use tools may have their own permission identities.</p>
      </details>}
    </div>
  );
}
