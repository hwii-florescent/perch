/** macOS-only native permission setup. Rust owns all checks and comparisons;
 * opening Settings is never treated as a grant. Browser/phone clients have no IPC. */
import { useCallback, useEffect, useRef, useState } from "react";
import { tauriInvoke } from "../links";
import { usePerchStore } from "../store";
import { Dialog } from "./ui/dialog";
import { SettingRow, SettingsGroup } from "./ui/setting-row";
import { CATALOG_TOGGLE, MUTED } from "./ui/settings";

export const macPermissionsAvailable = Boolean(tauriInvoke) && /Mac/.test(navigator.platform);

// Mirrors perchd::permissions and perch_core::permissions (native IPC only).
export type PermissionState = "granted" | "notGranted" | "unknown";
export interface PermissionCheck { id: string; title: string; description: string; state: PermissionState }
export interface PermissionSnapshot { pid: number; checks: PermissionCheck[] }
export interface PermissionReport {
  supported: boolean;
  app: PermissionSnapshot;
  daemon: PermissionSnapshot | null;
  terminal: PermissionSnapshot | null;
  comparison: "match" | "different" | "unknown";
  note: string | null;
}

function PermissionMark({ state, label, name }: { state: PermissionState; label: string; name?: string }) {
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

/** Shared by onboarding and Settings. No consent requests until Allow is clicked. */
export function MacPermissions() {
  const [report, setReport] = useState<PermissionReport | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);
  const mounted = useRef(false);

  const run = useCallback(async (command: "permissions_status" | "permissions_verify" | "permissions_allow", id?: string) => {
    if (!tauriInvoke || active.current) return;
    active.current = true;
    setPending(id ?? command);
    setError(null);
    try {
      if (command === "permissions_allow") await tauriInvoke(command, { id });
      const next = await tauriInvoke(command === "permissions_allow" ? "permissions_status" : command) as PermissionReport;
      if (mounted.current) setReport(next);
    } catch (cause) {
      if (mounted.current) {
        // Never leave a stale tick visible after a failed recheck.
        setReport(null);
        setError(String(cause));
      }
    } finally {
      active.current = false;
      if (mounted.current) setPending(null);
    }
  }, []);

  useEffect(() => {
    if (!macPermissionsAvailable) return;
    mounted.current = true;
    void run("permissions_status");
    const refresh = () => { void run("permissions_status"); };
    window.addEventListener("focus", refresh);
    return () => { mounted.current = false; window.removeEventListener("focus", refresh); };
  }, [run]);

  if (!macPermissionsAvailable) return null;
  return (
    <div data-testid="mac-permissions">
      <p className="m-0 mb-4 text-[0.85rem] text-fg">
        Choose what perch and the tools you run may access. Allow opens macOS System Settings; you still decide there. All permissions are optional.
      </p>
      <SettingsGroup>
        {!report && <p className="m-0 py-4 text-[0.8rem] text-subtext-0" role="status">{pending ? "Checking macOS access…" : "Permission status unavailable. Try Refresh."}</p>}
        {report?.app.checks.map((check) => (
          <SettingRow key={check.id} title={check.title} description={check.description}>
            <div className="flex flex-col items-end gap-1">
              <PermissionMark state={check.state} name={check.title} label="App" />
              {report.terminal && <PermissionMark state={report.terminal.checks.find((c) => c.id === check.id)?.state ?? "unknown"} name={check.title} label="Terminal" />}
            </div>
            <button type="button" className={CATALOG_TOGGLE} aria-label={`Allow ${check.title}`} disabled={pending !== null} onClick={() => { void run("permissions_allow", check.id); }}>
              {pending === check.id ? "Opening…" : "Allow"}
            </button>
          </SettingRow>
        ))}
      </SettingsGroup>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={CATALOG_TOGGLE} disabled={pending !== null} onClick={() => { void run("permissions_status"); }}>Refresh</button>
        <button type="button" className={CATALOG_TOGGLE} disabled={pending !== null} onClick={() => { void run("permissions_verify"); }}>{pending === "permissions_verify" ? "Verifying…" : "Verify terminals"}</button>
      </div>
      {error && <p className="mt-2 text-[0.8rem] text-red" role="alert">Could not check or request permission: {error}</p>}
      {report?.terminal && <p className={MUTED} role="status" data-testid="permission-comparison">
        {report.comparison === "match" ? "App and terminal checks match. Matching checks can include permissions that are not granted." : report.comparison === "different" ? "App and terminal access differ. Review the individual marks before relying on a grant." : "Some checks could not be verified. Compare the app and terminal marks above."}
      </p>}
      <p className={MUTED}>Ad-hoc builds may need permissions enabled again after an update.</p>
      {report && <details className="mt-3 text-[0.75rem] text-subtext-0">
        <summary className="cursor-pointer">About permissions and process checks</summary>
        <p>Verify terminals runs a short read-only shell through the real terminal host. It does not touch existing sessions. A matching result is not a guarantee for every external tool or sandbox.</p>
        <p>App PID {report.app.pid}{report.daemon && ` · Terminal host PID ${report.daemon.pid}`}{report.terminal && ` · Probe PID ${report.terminal.pid}`}</p>
        {report.daemon && <ul className="pl-4">{report.daemon.checks.map((check) => <li key={check.id}><PermissionMark state={check.state} label={`Host · ${check.title}`} /></li>)}</ul>}
        {report.note && <p>{report.note}</p>}
      <p className={MUTED}>Local builds are ad-hoc signed. After a rebuild, macOS may show perch enabled while access no longer matches. Toggle the entry off and on, or remove and add the current perch app again. Restarting an old terminal host ends its sessions; perch never does that automatically.</p>
      <p className={MUTED}>Automation is per target app; other apps may ask later. Normal browser tabs need none of these grants. External computer-use tools may have their own permission identities.</p>
      </details>}
    </div>
  );
}

/** Host-persisted dismissal, independent of the browser/profile's welcome screen. */
export function MacPermissionSetup({ enabled }: { enabled: boolean }) {
  const settings = usePerchStore((s) => s.settings);
  const updateSettings = usePerchStore((s) => s.updateSettings);
  const [dismissed, setDismissed] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const open = enabled && macPermissionsAvailable && settings !== null && !settings.permissionsSetupDismissed && !dismissed;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const scope = content.current;
    scope?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const buttons = scope?.querySelectorAll<HTMLButtonElement>("button:not(:disabled), summary");
      if (!buttons?.length) return;
      const first = buttons.item(0), last = buttons.item(buttons.length - 1);
      if (event.shiftKey && (document.activeElement === first || !scope?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !scope?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.removeEventListener("keydown", trap); previous?.focus(); };
  }, [open]);
  if (!open) return null;
  const close = () => { setDismissed(true); updateSettings({ permissionsSetupDismissed: true }); };
  return (
    <Dialog title="macOS permissions" testId="permission-setup" onClose={close}>
      {/* Reserve 4rem for Dialog padding/title inside its 85vh ceiling. */}
      <div ref={content} tabIndex={-1} className="flex max-h-[calc(85vh-4rem)] min-h-0 flex-col outline-none">
        <div className="min-h-0 flex-1 overflow-y-auto"><MacPermissions /></div>
        <div className="shrink-0 border-t border-overlay-0 pt-3">
          <p className={MUTED}>You can revisit these controls in Settings → Permissions.</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <button type="button" className={CATALOG_TOGGLE} onClick={close}>Not now</button>
            <button type="button" className={CATALOG_TOGGLE} onClick={close}>Continue to perch</button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
