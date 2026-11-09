/**
 * settingsRoutes.tsx: the Settings pages that are screens, bound to Perch. Each route gathers its page's data, binds
 * Perch's actions (saving settings, the notification permission, the ssh probe, pairing) and renders
 * `<StockRoute name="settings-<page>">`, so the page is Perch's stock source or the person's package chosen for it
 * (`perch mod use stock:settings-<page> <id>`), with the same props. The engines (socket subscriptions, the
 * permission request with its in-flight guard) live here and keep running when a page is swapped. Agents, Keyboard
 * and Permissions are routed from `AgentCatalog.tsx`, `KeybindingsSection.tsx` and `MacPermissions.tsx`.
 *
 * The phone keeps Perch's own pages for now: each route passes `exact` when the window is phone-width. Settings > Mods
 * (`ModsSection.tsx`) is not routed at all: it is the recovery page.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { DeviceSummary, SettingsPatch } from "@perch/shared";
import type { GeneralSettingsProps, HostsSettingsProps, PerchSettings, SettingsChange, SystemNotificationStatus } from "@perch/sdk";
import { usePerchStore } from "../store";
import { THEME_NAMES, applyTheme } from "../themes";
import { setPaneLabelsEnabled, usePaneLabelsEnabled } from "../paneLabels";
import { CHAT_FONT_SIZES, setChatFontScale, useChatFontScale } from "../chatFont";
import { setSendWhileWorking, useSendWhileWorking } from "../chatSend";
import { socket } from "../ws";
import { BROWSER_SEARCH_ENGINES, openExternal } from "../links";
import { getNotificationSettings, hasNativeNotifications, openNotificationSettings, requestNotificationPermission, sendSystemNotification, USAGE_NOTIFICATION_ID } from "../notifications";
import { clearHistory } from "../browserHistory";
import { useAgentChoices } from "./AgentPicker";
// Imported rather than re-declared so the bounds the UI enforces and the ones
// `createPerchTerminal` actually clamps to cannot drift apart.
import { MIN_SCROLLBACK, MAX_SCROLLBACK } from "../xtermSetup";
import { newId } from "../ids";
import { runCommand } from "../modApp";
import { useIsMobileWidth } from "../responsive";
import { useMachineCheck } from "./MachineCheck";
import { pairLink, usePhoneAccess } from "./PhoneAccess";
import GeneralPage from "../stock-ui/settings-general/main";
import AppearancePage from "../stock-ui/settings-appearance/main";
import TerminalPage from "../stock-ui/settings-terminal/main";
import NotificationsPage from "../stock-ui/settings-notifications/main";
import HostsPage from "../stock-ui/settings-hosts/main";
import DevicesPage from "../stock-ui/settings-devices/main";
import { StockRoute } from "./mod-root";

/** The saved settings and the one way a page writes them. */
function useSettings() {
  // The core's settings are the pages' `PerchSettings`; the pages name only the fields they read.
  const settings = usePerchStore((s) => s.settings) as PerchSettings | null;
  const save = usePerchStore((s) => s.updateSettings);
  return { settings, updateSettings: (change: SettingsChange) => save(change as SettingsPatch) };
}

export function GeneralSettings() {
  const { settings, updateSettings } = useSettings();
  const { choices } = useAgentChoices(usePerchStore((s) => s.activeHostId));
  const isMobile = useIsMobileWidth();
  const paneLabels = usePaneLabelsEnabled();
  const props: GeneralSettingsProps = {
    settings, isMobile, paneLabels,
    agentChoices: choices.map((choice) => ({ id: choice.id, label: choice.label })),
    searchEngines: BROWSER_SEARCH_ENGINES.map(({ id, label }) => ({ id, label })),
    actions: { updateSettings, setPaneLabels: setPaneLabelsEnabled, clearBrowsingHistory: clearHistory },
  };
  return <StockRoute name="settings-general" props={props} stock={GeneralPage} exact={isMobile} />;
}

export function AppearanceSettings() {
  const { settings, updateSettings } = useSettings();
  const chatTextSize = useChatFontScale();
  const sendWhileWorking = useSendWhileWorking();
  const isMobile = useIsMobileWidth();
  const props = {
    settings, themes: THEME_NAMES, chatTextSize, sendWhileWorking,
    chatTextSizes: CHAT_FONT_SIZES.map(({ value, label }) => ({ value, label })),
    actions: {
      // Live preview immediately, then persist. If the save round-trip fails or comes back with a different value, the
      // next settings.current message (handled in store.ts) re-applies the authoritative theme.
      setTheme: (name: string) => { applyTheme(name); updateSettings({ theme: name }); },
      setChatTextSize: setChatFontScale,
      setSendWhileWorking,
      updateSettings,
    },
  };
  return <StockRoute name="settings-appearance" props={props} stock={AppearancePage} exact={isMobile} />;
}

export function TerminalSettings() {
  const { settings, updateSettings } = useSettings();
  const isMobile = useIsMobileWidth();
  const props = { settings, scrollback: { min: MIN_SCROLLBACK, max: MAX_SCROLLBACK }, actions: { updateSettings } };
  return <StockRoute name="settings-terminal" props={props} stock={TerminalPage} exact={isMobile} />;
}

export function NotificationsSettings() {
  const { settings, updateSettings } = useSettings();
  const connected = usePerchStore((s) => s.connected);
  const fetchHarnessModels = usePerchStore((s) => s.fetchHarnessModels);
  const harnessModels = usePerchStore((s) => s.harnessModels);
  const isMobile = useIsMobileWidth();
  useEffect(() => { fetchHarnessModels(); }, [connected, fetchHarnessModels]);

  const [permission, setPermission] = useState<SystemNotificationStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const mounted = useRef(false);
  const active = useRef(false);

  // One permission action at a time; an answer that lands after the page left is dropped.
  const notificationAction = useCallback(async (action: "refresh" | "request" | "settings" | "test") => {
    if (active.current) return;
    active.current = true;
    setPending(true);
    setError(null);
    setTestResult(null);
    try {
      if (action === "settings") await openNotificationSettings();
      else {
        if (action === "test") {
          await sendSystemNotification("Perch test notification", "System notifications are working. Click to return to Perch.", USAGE_NOTIFICATION_ID, () => {});
        }
        const next = await (action === "request" ? requestNotificationPermission() : getNotificationSettings());
        if (mounted.current) {
          setPermission(next as SystemNotificationStatus);
          if (action === "test") setTestResult("Test submitted. If no banner appears, check your notification style and Focus settings.");
        }
      }
    } catch (cause) {
      if (mounted.current) {
        if (action === "refresh" || action === "request") setPermission(null);
        setError(String(cause));
      }
    } finally {
      active.current = false;
      if (mounted.current) setPending(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const refresh = () => { void notificationAction("refresh"); };
    refresh();
    window.addEventListener("focus", refresh);
    return () => { mounted.current = false; window.removeEventListener("focus", refresh); };
  }, [notificationAction]);

  const props = {
    settings, permission, pending, error, testResult, native: hasNativeNotifications(),
    models: Object.fromEntries((harnessModels ?? []).map((harness) => [harness.id, harness.models])),
    actions: {
      updateSettings,
      // User opt-in only: opening Settings or finishing a turn never asks.
      setToastDelivery: (delivery: "off" | "app" | "system") => {
        updateSettings({ toastDelivery: delivery });
        if (delivery === "system") void notificationAction("request");
      },
      notification: (action: "refresh" | "request" | "settings" | "test") => { void notificationAction(action); },
    },
  };
  return <StockRoute name="settings-notifications" props={props} stock={NotificationsPage} exact={isMobile} />;
}

export function HostsSettings() {
  const hosts = usePerchStore((s) => s.hosts);
  const hostStates = usePerchStore((s) => s.hostStates);
  const upsertHost = usePerchStore((s) => s.upsertHost);
  const deleteHost = usePerchStore((s) => s.deleteHost);
  const machine = useMachineCheck();
  const isMobile = useIsMobileWidth();
  const props: HostsSettingsProps = {
    hosts, hostStates, machine: machine.state,
    actions: {
      addHost: (form) => {
        const name = form.name.trim();
        const sshHost = form.sshHost.trim();
        if (!name || !sshHost) return false;
        const port = parseInt(form.port, 10);
        const directUrl = form.directUrl.trim() || undefined;
        const remoteCmd = form.remoteCmd.trim() || undefined;
        upsertHost({
          id: newId(),
          name,
          sshHost,
          remotePort: Number.isFinite(port) ? port : 7788,
          enabled: true,
          mode: form.mode,
          ...(directUrl ? { directUrl } : {}),
          ...(remoteCmd ? { remoteCmd } : {}),
        });
        return true;
      },
      upsertHost: (host) => upsertHost({ ...host, mode: host.mode ?? "perch" }),
      deleteHost,
      checkMachine: machine.check,
      installCore: machine.install,
      logIn: (argv) => { runCommand("tab.new", { argv }); },
    },
  };
  return <StockRoute name="settings-hosts" props={props} stock={HostsPage} exact={isMobile} />;
}

/**
 * A phone reaches the desktop app only while "Phone access" is on (the headless `perch-core` is always reachable), and
 * gets in only once someone here hands it a code (see `crates/perch-core/src/devices.rs`); this is where access is
 * switched, the code and its QR are produced, and access is taken back.
 */
export function DevicesSettings() {
  const { settings, updateSettings } = useSettings();
  const phone = usePhoneAccess();
  // A phone must not be able to switch off the only way it reaches the laptop.
  const isMobile = useIsMobileWidth();
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [pairing, setPairing] = useState<{ code: string; expiresAt: number } | null>(null);

  useEffect(() => {
    const off = socket.onMessage((message) => {
      if (message.type === "device.list.result") setDevices(message.devices);
      if (message.type === "device.pair.code") setPairing({ code: message.code, expiresAt: Date.now() + message.expiresInMs });
    });
    socket.send({ type: "device.list", requestId: newId() });
    return off;
  }, []);

  // A code that has run out is gone.
  useEffect(() => {
    if (!pairing) return;
    const timer = setTimeout(() => setPairing(null), Math.max(0, pairing.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [pairing]);

  const props = {
    settings, isMobile, phone, devices, pairing,
    actions: {
      updateSettings,
      pairStart: () => socket.send({ type: "device.pair.start", requestId: newId() }),
      pairCancel: () => {
        setPairing(null);
        socket.send({ type: "device.pair.cancel", requestId: newId() });
      },
      revoke: (deviceId: string) => socket.send({ type: "device.revoke", requestId: newId(), deviceId }),
      pairLink,
      openExternal,
    },
  };
  return <StockRoute name="settings-devices" props={props} stock={DevicesPage} exact={isMobile} />;
}
