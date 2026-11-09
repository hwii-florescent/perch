/** macOS-only native permission setup. Rust owns all checks and comparisons;
 * opening Settings is never treated as a grant. Browser/phone clients have no IPC. */
import { useCallback, useEffect, useRef, useState } from "react";
import { tauriInvoke } from "../links";
import { usePerchStore } from "../store";
import { Dialog } from "./ui/dialog";
import { CATALOG_TOGGLE, MUTED } from "./ui/settings";
import { useIsMobileWidth } from "../responsive";
import PermissionsSettings from "../stock-ui/settings-permissions/main";
import { StockRoute } from "./mod-root";

export const macPermissionsAvailable = Boolean(tauriInvoke) && /Mac/.test(navigator.platform);

// Mirrors perchd::permissions and perch_core::permissions (native IPC only).
export type PermissionState = "granted" | "notGranted" | "unknown";
export interface PermissionCheck { id: string; title: string; description: string; state: PermissionState }
export interface PermissionSnapshot { pid: number; checks: PermissionCheck[] }
/** The terminal host's identity; `severed` means an app update deleted the file it runs from. */
interface HostStatus { pid: number; attribution: "intact" | "severed" | "unknown"; liveSessions: number }
export interface PermissionReport {
  supported: boolean;
  host?: HostStatus | null;
  app: PermissionSnapshot;
  daemon: PermissionSnapshot | null;
  terminal: PermissionSnapshot | null;
  comparison: "match" | "different" | "unknown";
  note: string | null;
}

/** Shared by onboarding and Settings. No consent requests until Allow is clicked. The page is
 * `stock:settings-permissions` (`stock-ui/settings-permissions/main.tsx`) or the person's package chosen for it; the
 * native bridge, its one-request-at-a-time guard and the refresh on returning to the app are bound here. */
export function MacPermissions() {
  const [report, setReport] = useState<PermissionReport | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobileWidth();
  const active = useRef(false);
  const mounted = useRef(false);
  const shown = useRef<PermissionReport | null>(null);
  shown.current = report;

  /** Resolves true when a terminal host restart went through (it is the only command the caller waits on). */
  const run = useCallback(async (command: "permissions_status" | "permissions_verify" | "permissions_allow" | "permissions_restart_host", id?: string): Promise<boolean> => {
    if (!tauriInvoke || active.current) return false;
    active.current = true;
    setPending(id ?? command);
    setError(null);
    let restarted = false;
    try {
      if (command === "permissions_allow") await tauriInvoke(command, { id });
      if (command === "permissions_restart_host") {
        // Exactly the daemon and session count the user was shown; the core re-verifies both.
        const host = shown.current?.host;
        if (!host) return false;
        await tauriInvoke(command, { pid: host.pid, liveSessions: host.liveSessions });
        restarted = true;
      }
      const next = await tauriInvoke(command === "permissions_allow" || command === "permissions_restart_host" ? "permissions_status" : command) as PermissionReport;
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
    return restarted;
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
  const props = {
    report, pending, error,
    actions: {
      refresh: () => { void run("permissions_status"); },
      verify: () => { void run("permissions_verify"); },
      allow: (checkId: string) => { void run("permissions_allow", checkId); },
      restartHost: () => run("permissions_restart_host"),
    },
  };
  return <StockRoute name="settings-permissions" props={props} stock={PermissionsSettings} exact={isMobile} />;
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
        <div className="shrink-0 pt-3">
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
