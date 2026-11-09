/**
 * SettingsPage.tsx — settings as a full-window page (see `SettingsPage` below).
 * Opens whenever `settingsOpen` is true and fetches settings + hosts from the
 * server. Sections are grouped into the left-hand tabs; each is a card of rows.
 */

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePerchStore } from "../store";
import type { BrowserSearchEngine, HostConnectionState, HostMode, DeviceSummary } from "@perch/shared";
import { THEME_NAMES, applyTheme } from "../themes";
import { getPaneLabelsEnabled, setPaneLabelsEnabled } from "../paneLabels";
import { CHAT_FONT_SIZES, setChatFontScale, useChatFontScale } from "../chatFont";
import { setSendWhileWorking, useSendWhileWorking, type SendWhileWorking } from "../chatSend";
import { ModeSwitch } from "./ModeSwitch";
import { MacPermissions, macPermissionsAvailable } from "./MacPermissions";
import { socket } from "../ws";
import { BROWSER_SEARCH_ENGINES } from "../links";
import { getNotificationSettings, hasNativeNotifications, openNotificationSettings, requestNotificationPermission, sendSystemNotification, USAGE_NOTIFICATION_ID, type NotificationSettings } from "../notifications";
import { clearHistory } from "../browserHistory";
import { AgentCatalog } from "./AgentCatalog";
import { ModsSection } from "./ModsSection";
import { useAgentChoices } from "./AgentPicker";
// Imported rather than re-declared so the bounds the UI enforces and the ones
// `createPerchTerminal` actually clamps to cannot drift apart.
import { MIN_SCROLLBACK, MAX_SCROLLBACK } from "../xtermSetup";
import { newId } from "../ids";
import { HostStateDot } from "./HostStateDot";
import { MachineCheck, SSH_CONFIG_HOSTS } from "./MachineCheck";
import { cn } from "../lib/cn";
import { SettingsGroup, SettingRow, SettingsQuery } from "./ui/setting-row";
import { Switch } from "./ui/switch";
import { Select, type SelectOption } from "./ui/select";
import { KeybindingsSection } from "./KeybindingsSection";
import { PhoneAccessRows, QrCode, pairLink, pickAddress, usePhoneAccess } from "./PhoneAccess";
import { GHOST_BUTTON } from "./ui/icon-button";
import { TAP_BUTTON } from "./ui/glass";
import { disconnectNativeApp, inNativeApp } from "../nativeApp";
import { Chevron } from "./ui/chevron";
import { MOBILE_WIDTH_BREAKPOINT, useIsMobileWidth } from "../responsive";
import {
  ADD_ROW, ADDR, BTN_DANGER, BTN_PRIMARY, EMPTY, HOST_ROW, INPUT, INPUT_PORT, INPUT_WIDE,
  LIST, MUTED, NAME, SELECT, SELECT_HOST,
} from "./ui/settings";

// A full-height column of the shell, as in App.tsx (kept in step by hand: App imports this file).
const CARD = "flex min-h-0 shrink-0 flex-col overflow-hidden rounded-[12px] bg-[var(--card-bg)]";

// ---------------------------------------------------------------------------
// ThemeSection
// ---------------------------------------------------------------------------

function ThemeSection() {
  const settings = usePerchStore((s) => s.settings);
  const updateSettings = usePerchStore((s) => s.updateSettings);

  const q = useContext(SettingsQuery);
  if (!settings || (q && !"theme".includes(q))) return null; // the chips are no row: search finds them by the group title
  const current = settings.theme;

  const handleSelect = (name: string) => {
    // Live preview immediately, then persist. If the save round-trip fails
    // or comes back with a different value, the next settings.current
    // message (handled in store.ts) re-applies the authoritative theme.
    applyTheme(name);
    updateSettings({ theme: name });
  };

  return (
    <SettingsGroup title="Theme">
      <div className="py-3" data-setting-row>
      <ul className="m-0 mb-2 flex list-none flex-wrap gap-[0.4rem] p-0">
        {THEME_NAMES.map((name) => (
          <li key={name}>
            <button
              type="button"
              className={cn(
                "flex cursor-pointer items-center gap-[0.4rem] rounded-ui bg-surface-1 px-[0.65rem] py-[0.3rem] text-[0.8rem] hover:bg-overlay-0",
                name === current ? "settings-modal__theme-option--active bg-surface-0 text-accent" : "text-fg",
              )}
              data-testid={`theme-option-${name}`}
              onClick={() => handleSelect(name)}
            >
              <span className="settings-modal__theme-option-name">{name}</span>
              {name === current && (
                <span className="text-accent" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      </div>
    </SettingsGroup>
  );
}

function ChatTextSection() {
  const scale = useChatFontScale();
  const whileWorking = useSendWhileWorking();
  return (
    <SettingsGroup title="Chat">
      <SettingRow title="Text size" description="The size of messages in chat. Kept on this device only.">
        <Select className={SELECT} testId="settings-chat-text-size" ariaLabel="Chat text size" value={scale} onChange={setChatFontScale} options={CHAT_FONT_SIZES.map(({ value, label }) => ({ value, label }))} />
      </SettingRow>
      <SettingRow title="Enter while the agent is working" description="Steer puts your message into the running turn; Queue runs it after the turn. Alt/Option+Enter does the other one. Claude and OpenCode have no separate steer, so they always take it their own way. Kept on this device only.">
        <Select className={SELECT} testId="settings-chat-send-while-working" ariaLabel="Enter while the agent is working" value={whileWorking} onChange={(value) => setSendWhileWorking(value as SendWhileWorking)} options={[{ value: "steer", label: "Steer" }, { value: "queue", label: "Queue" }]} />
      </SettingRow>
    </SettingsGroup>
  );
}

function TabShapeSection() {
  const settings = usePerchStore((s) => s.settings);
  const updateSettings = usePerchStore((s) => s.updateSettings);

  return (
    <SettingsGroup title="Tabs">
      <SettingRow title="Tab shape" description="Choose square corners or rounded browser-style tabs.">
        <Select
          className={SELECT}
          testId="settings-tab-shape"
          ariaLabel="Tab shape"
          value={settings?.tabShape ?? "square"}
          onChange={(value) => updateSettings({ tabShape: value as "square" | "round" })}
          options={[{ value: "square", label: "Square" }, { value: "round", label: "Rounded" }]}
        />
      </SettingRow>
    </SettingsGroup>
  );
}

function BrowserSection() {
  const settings = usePerchStore((s) => s.settings);
  const updateSettings = usePerchStore((s) => s.updateSettings);
  return (
    <SettingsGroup title="Browser">
      <SettingRow title="Default search engine" description="Used for searches from the address bar in browser tabs and the drawer.">
        <Select
          className={SELECT}
          testId="settings-browser-search-engine"
          ariaLabel="Default search engine"
          disabled={!settings}
          value={settings?.browserSearchEngine ?? "google"}
          onChange={(value) => updateSettings({ browserSearchEngine: value as BrowserSearchEngine })}
          options={BROWSER_SEARCH_ENGINES.map(({ id, label }) => ({ value: id, label }))}
        />
      </SettingRow>
      <SettingRow title="Search suggestions" description="Ask the search engine to complete what you type in the address bar. Off by default: everything you type, even if you never search, is sent to the engine. Addresses are never sent.">
        <Switch label="Search suggestions" testId="settings-browser-search-suggestions" checked={settings?.browserSearchSuggestions === true} onChange={(on) => updateSettings({ browserSearchSuggestions: on })} />
      </SettingRow>
      <SettingRow title="Browsing history" description="Pages suggested in the address bar. Kept on this device only.">
        <button type="button" className={SELECT} data-testid="settings-browser-clear-history" onClick={clearHistory}>Clear history</button>
      </SettingRow>
    </SettingsGroup>
  );
}

// ---------------------------------------------------------------------------
// ChatModeSection — the one global UI/CLI setting. CLI (terminal) is the default.
// ---------------------------------------------------------------------------

function ChatModeSection() {
  const settings = usePerchStore((s) => s.settings);
  const updateSettings = usePerchStore((s) => s.updateSettings);

  // Optimistic local mirror, same pattern as NotificationsSection: flip the
  // control instantly on click rather than waiting on the settings.update
  // round-trip. The store's settings.current handler re-applies the
  // authoritative value (and drives every open chat pane) once it lands.
  const [chatMode, setChatMode] = useState<"ui" | "cli">(settings?.chatMode ?? "cli");
  const { choices: agentChoices } = useAgentChoices(usePerchStore((s) => s.activeHostId));
  const isMobile = useIsMobileWidth();

  useEffect(() => {
    if (!settings) return;
    setChatMode(settings.chatMode ?? "cli");
  }, [settings?.chatMode]);

  const handleChange = (mode: "ui" | "cli") => {
    setChatMode(mode);
    updateSettings({ chatMode: mode });
  };

  return (
    <SettingsGroup title="Chat mode">
      <SettingRow title="UI / CLI" description="CLI shows each agent's terminal; UI shows the native chat over the same agent. Agents without a chat view always use the terminal.">
        <ModeSwitch mode={chatMode} onChange={handleChange} testId="settings-chat-mode" />
      </SettingRow>
      <SettingRow title="Warn before closing an agent" description="Ask first when closing a tab that runs an agent. Terminals close without asking.">
        <Switch label="Warn before closing an agent" testId="settings-warn-close-agent" checked={settings?.warnCloseAgent !== false} onChange={(on) => updateSettings({ warnCloseAgent: on })} />
      </SettingRow>
      {!isMobile && <SettingRow title="Preview files in tabs" description="A single-clicked file opens in an italic preview tab that the next clicked file replaces. Edit or double-click it to keep it. Off opens every clicked file in its own tab.">
        <Switch label="Preview files in tabs" testId="settings-preview-tabs" checked={settings?.previewTabs !== false} onChange={(on) => updateSettings({ previewTabs: on })} />
      </SettingRow>}
      <SettingRow title="Empty workspace opens" description="What clicking a workspace with no open tabs starts.">
        <Select
          className={SELECT}
          testId="settings-empty-workspace-agent"
          ariaLabel="Empty workspace opens"
          value={settings?.emptyWorkspaceAgent ?? ""}
          onChange={(value) => updateSettings({ emptyWorkspaceAgent: value })}
          options={[{ value: "", label: "Ask (show the picker)" }, ...agentChoices.map((choice) => ({ value: choice.id, label: choice.label }))]}
        />
      </SettingRow>
    </SettingsGroup>
  );
}

// ---------------------------------------------------------------------------
// SshHostsSection
// ---------------------------------------------------------------------------

function SshHostsSection() {
  const hosts = usePerchStore((s) => s.hosts);
  const hostStates = usePerchStore((s) => s.hostStates);
  const upsertHost = usePerchStore((s) => s.upsertHost);
  const deleteHost = usePerchStore((s) => s.deleteHost);

  const [newName, setNewName] = useState("");
  const [newSshHost, setNewSshHost] = useState("");
  const [newPort, setNewPort] = useState("7788");
  const [newDirectUrl, setNewDirectUrl] = useState("");
  const [newRemoteCmd, setNewRemoteCmd] = useState("");
  // "perch" = classic federation (remote runs its own perch); "direct" = the
  // remote has only claude/codex + tmux and perch drives them over SSH with
  // every turn detached. Defaults to "direct" — most SSH targets don't
  // have perch installed, so direct is the normal case for a newly added
  // host. (The Rust serde default for `mode` stays "perch", which only
  // matters for hosts persisted before the field existed.)
  const [newMode, setNewMode] = useState<HostMode>("direct");

  const handleAdd = () => {
    const name = newName.trim();
    const sshHost = newSshHost.trim();
    if (!name || !sshHost) return;
    const port = parseInt(newPort, 10);
    const directUrl = newDirectUrl.trim() || undefined;
    const remoteCmd = newRemoteCmd.trim() || undefined;
    upsertHost({
      id: newId(),
      name,
      sshHost,
      remotePort: Number.isFinite(port) ? port : 7788,
      enabled: true,
      mode: newMode,
      ...(directUrl ? { directUrl } : {}),
      ...(remoteCmd ? { remoteCmd } : {}),
    });
    setNewName("");
    setNewSshHost("");
    setNewPort("7788");
    setNewDirectUrl("");
    setNewRemoteCmd("");
    setNewMode("direct");
  };

  return (
    <SettingsGroup>
      <div className="py-3">

      {hosts.length === 0 ? (
        <p className={EMPTY}>No hosts configured.</p>
      ) : (
        <ul className={LIST}>
          {hosts.map((h) => {
            const info = hostStates[h.id];
            // Derive display state: info.state if available, else infer.
            const state: HostConnectionState = info
              ? info.state
              : h.enabled ? "connecting" : "disabled";
            return (
              <li key={h.id} className={HOST_ROW}>
                <HostStateDot state={state} error={info?.error} />
                <span className={NAME}>{h.name}</span>
                <span className={ADDR}>
                  {h.sshHost}:{h.remotePort}
                </span>
                {/* Mode is editable in place: switching an existing host to
                    direct is the normal migration path once the remote no
                    longer needs a perch checkout. */}
                <Select
                  className={SELECT_HOST}
                  testId={`host-mode-${h.name}`}
                  ariaLabel={`${h.name} mode`}
                  title="perch = remote runs its own perch; direct = remote only needs claude/codex + tmux"
                  value={h.mode ?? "perch"}
                  onChange={(value) => upsertHost({ ...h, mode: value as HostMode })}
                  options={[{ value: "perch", label: "perch" }, { value: "direct", label: "direct" }]}
                />
                {state === "error" && info?.error && (
                  <span className="min-w-0 flex-1 overflow-hidden text-[0.72rem] text-ellipsis whitespace-nowrap text-red max-[700px]:basis-full" title={info.error}>
                    {info.error.length > 40 ? info.error.slice(0, 40) + "…" : info.error}
                  </span>
                )}
                <label className="flex shrink-0 cursor-pointer items-center gap-[0.3rem] text-[0.78rem] text-subtext-0" title="Enabled">
                  <input
                    type="checkbox"
                    checked={h.enabled}
                    onChange={() => upsertHost({ ...h, enabled: !h.enabled })}
                  />
                  <span>enabled</span>
                </label>
                <button
                  type="button"
                  className={BTN_DANGER}
                  data-testid={`host-delete-${h.name}`}
                  onClick={() => deleteHost(h.id)}
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className={ADD_ROW}>
        <input
          type="text"
          className={INPUT}
          placeholder="Name"
          value={newName}
          data-testid="host-name-input"
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          type="text"
          className={INPUT}
          placeholder="SSH host"
          list={SSH_CONFIG_HOSTS}
          value={newSshHost}
          data-testid="host-ssh-input"
          onChange={(e) => setNewSshHost(e.target.value)}
        />
        <input
          type="number"
          className={INPUT_PORT}
          placeholder="Port"
          value={newPort}
          onChange={(e) => setNewPort(e.target.value)}
        />
        <Select
          className={SELECT}
          testId="host-mode-input"
          ariaLabel="New host mode"
          title="direct = remote only needs claude/codex + tmux; perch = remote runs its own perch"
          value={newMode}
          onChange={(value) => setNewMode(value as HostMode)}
          options={[{ value: "direct", label: "direct" }, { value: "perch", label: "perch" }]}
        />
        <button
          type="button"
          className={BTN_PRIMARY}
          data-testid="host-add"
          onClick={handleAdd}
        >
          Add
        </button>
      </div>
      <MachineCheck sshHost={newSshHost} onCore={() => setNewMode("perch")} />

      {/* Advanced optional fields */}
      <div className={`${ADD_ROW} mt-[0.35rem] opacity-75`}>
        <input
          type="text"
          className={INPUT}
          placeholder="Direct URL (optional, e.g. ws://127.0.0.1:7800/ws)"
          value={newDirectUrl}
          data-testid="host-direct-url-input"
          onChange={(e) => setNewDirectUrl(e.target.value)}
        />
        <input
          type="text"
          className={INPUT}
          placeholder="Remote start cmd (optional, {port} placeholder)"
          value={newRemoteCmd}
          data-testid="host-remote-cmd-input"
          onChange={(e) => setNewRemoteCmd(e.target.value)}
        />
      </div>
      </div>
    </SettingsGroup>
  );
}

// ---------------------------------------------------------------------------
// DefaultCwdSection
// ---------------------------------------------------------------------------

function DefaultCwdSection() {
  const settings = usePerchStore((s) => s.settings);
  const updateSettings = usePerchStore((s) => s.updateSettings);
  const [cwd, setCwd] = useState(settings?.defaultCwd ?? "");

  // Sync from store when settings arrive.
  useEffect(() => {
    setCwd(settings?.defaultCwd ?? "");
  }, [settings?.defaultCwd]);

  const handleSave = () => {
    const val = cwd.trim();
    updateSettings({ defaultCwd: val === "" ? null : val });
  };

  return (
    <SettingsGroup title="Default Working Directory">
      <div className="py-3">
      <div className={ADD_ROW}>
        <input
          type="text"
          className={INPUT_WIDE}
          placeholder="/path/to/your/project"
          value={cwd}
          onChange={(e) => setCwd(e.target.value)}
        />
        <button
          type="button"
          className={BTN_PRIMARY}
          onClick={handleSave}
        >
          Save
        </button>
      </div>
      <p className={MUTED}>
        Used as the cwd for new sessions. Leave empty to use the server process directory.
      </p>
      </div>
    </SettingsGroup>
  );
}

/** The models `harness`'s installed CLI offers, as suggestions that narrow while typing. Until the list arrives, or when this core cannot list or the harness is not installed, it is the plain text field. */
function HarnessModelPicker({ harness, value, onCommit, testId, label, allowEmpty, placeholder, disabled }: { harness: string; value: string; onCommit: (value: string) => void; testId: string; label: string; allowEmpty?: boolean; placeholder?: string; disabled?: boolean }) {
  const models = usePerchStore((s) => s.harnessModels?.find((entry) => entry.id === harness)?.models);
  if (!models?.length) return <ModelInput testId={testId} label={label} disabled={disabled} allowEmpty={allowEmpty} placeholder={placeholder} value={value} onCommit={onCommit} />;
  const choices = models.map((model) => ({ value: model.id, label: model.label === model.id ? model.id : `${model.label} · ${model.id}`, text: `${model.label} ${model.id}` }));
  return <ModelInput testId={testId} label={label} disabled={disabled} allowEmpty={allowEmpty} placeholder={placeholder} value={value} onCommit={onCommit} choices={choices} />;
}

/** A model name saved when the field is left or Enter is pressed, or at once when a suggestion in `choices` is picked. An empty field restores the stored name, unless `allowEmpty` (a harness with no default model), where it clears it. */
function ModelInput({ value, onCommit, testId, label, disabled, allowEmpty, placeholder, choices }: { value: string; onCommit: (value: string) => void; testId: string; label: string; disabled?: boolean; allowEmpty?: boolean; placeholder?: string; choices?: SelectOption[] }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = (text = draft) => {
    const next = text.trim();
    if (!next && !allowEmpty) setDraft(value);
    else if (next !== value) onCommit(next);
  };
  if (choices) {
    return <span className="contents" onBlur={() => commit()}>
      <Select freeText className={INPUT_WIDE} testId={testId} ariaLabel={label} disabled={disabled} placeholder={placeholder} options={choices} value={draft}
        onChange={(next) => { setDraft(next); if (choices.some((choice) => choice.value === next)) commit(next); }}
        onKeyDown={(event) => { if (event.key === "Enter") commit(); }} />
    </span>;
  }
  return <input type="text" className={INPUT_WIDE} data-testid={testId} aria-label={label} disabled={disabled} value={draft} placeholder={placeholder}
    onChange={(event) => setDraft(event.target.value)} onBlur={() => commit()} onKeyDown={(event) => { if (event.key === "Enter") commit(); }} />;
}

// ---------------------------------------------------------------------------
// NotificationsSection — Wave 1 items 3 & 4: sound + toast delivery
// ---------------------------------------------------------------------------

function NotificationsSection() {
  const settings = usePerchStore((s) => s.settings);
  const updateSettings = usePerchStore((s) => s.updateSettings);
  const connected = usePerchStore((s) => s.connected);
  const fetchHarnessModels = usePerchStore((s) => s.fetchHarnessModels);
  useEffect(() => { fetchHarnessModels(); }, [connected, fetchHarnessModels]);

  // Local optimistic mirrors of the server-persisted values (same pattern as
  // ThemeSection's immediate applyTheme() and DefaultCwdSection's local
  // `cwd` state) — the checkbox/select must flip the instant the user acts,
  // not after the settings.update round-trip completes. Without this, the
  // control shows no feedback for a beat (and briefly "un-toggles" itself
  // if a stale settings.current — e.g. from the settings.get sent when the
  // modal opened — lands after the click).
  const [soundEnabled, setSoundEnabled] = useState(settings?.soundEnabled ?? false);
  const [toastDelivery, setToastDelivery] = useState<"off" | "app" | "system">(
    (settings?.toastDelivery as "off" | "app" | "system" | undefined) ?? "app"
  );
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [notificationPending, setNotificationPending] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const mounted = useRef(false);
  const active = useRef(false);
  const native = hasNativeNotifications();

  const notificationAction = useCallback(async (action: "refresh" | "request" | "settings" | "test") => {
    if (active.current) return;
    active.current = true;
    setNotificationPending(true);
    setNotificationError(null);
    setTestResult(null);
    try {
      if (action === "settings") await openNotificationSettings();
      else {
        if (action === "test") {
          await sendSystemNotification("Perch test notification", "System notifications are working. Click to return to Perch.", USAGE_NOTIFICATION_ID, () => {});
        }
        const next = await (action === "request" ? requestNotificationPermission() : getNotificationSettings());
        if (mounted.current) {
          setNotificationSettings(next);
          if (action === "test") setTestResult("Test submitted. If no banner appears, check your notification style and Focus settings.");
        }
      }
    } catch (error) {
      if (mounted.current) {
        if (action === "refresh" || action === "request") setNotificationSettings(null);
        setNotificationError(String(error));
      }
    } finally {
      active.current = false;
      if (mounted.current) setNotificationPending(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const refresh = () => { void notificationAction("refresh"); };
    refresh();
    window.addEventListener("focus", refresh);
    return () => { mounted.current = false; window.removeEventListener("focus", refresh); };
  }, [notificationAction]);

  const permission = notificationSettings?.permission;
  const permissionText = permission === "granted"
    ? native && (!notificationSettings?.alerts || notificationSettings.alertStyle === "none")
      ? "Allowed, but macOS banners are off. In System Settings → Notifications → perch, choose Banners or Alerts."
      : "Allowed. System notifications can be sent from this app."
    : permission === "denied" ? native
      ? "Blocked by macOS. Enable Allow Notifications for perch in System Settings."
      : "Blocked by your browser. Change this site's notification permission in browser settings."
    : permission === "default" ? "Not requested. Allow notifications to receive system alerts."
    : permission === "provisional" ? "Quiet delivery only. Allow notifications to request banners and alerts."
    : permission === "unsupported" ? "System notifications are not supported in this browser. In-app alerts still work."
    : notificationPending ? "Checking notification permission…" : "Notification permission could not be verified. Try Refresh.";

  useEffect(() => {
    if (!settings) return;
    setSoundEnabled(settings.soundEnabled);
    setToastDelivery((settings.toastDelivery as "off" | "app" | "system" | undefined) ?? "app");
  }, [settings?.soundEnabled, settings?.toastDelivery]);

  const handleSoundEnabledChange = (checked: boolean) => {
    setSoundEnabled(checked);
    updateSettings({ soundEnabled: checked });
  };

  const handleToastDeliveryChange = (value: "off" | "app" | "system") => {
    setToastDelivery(value);
    updateSettings({ toastDelivery: value });
    // User opt-in only: opening Settings or finishing a turn never asks.
    if (value === "system") void notificationAction("request");
  };

  return (
    <>
    <SettingsGroup>
      <SettingRow title="Sound" description="Play a sound when a session finishes or needs attention.">
        <Switch label="Play a sound when a session finishes or needs attention" testId="settings-sound-enabled" checked={soundEnabled} onChange={handleSoundEnabledChange} />
      </SettingRow>
      <SettingRow
        title="Notification delivery"
        description="In-app alerts also try system notifications while Perch is unfocused. Off disables visual alerts, not sound."
      >
        <Select
          className={SELECT}
          testId="settings-toast-delivery"
          ariaLabel="Notification delivery"
          value={toastDelivery}
          onChange={(value) => handleToastDeliveryChange(value as "off" | "app" | "system")}
          options={[{ value: "off", label: "Off" }, { value: "app", label: "In-app" }, { value: "system", label: "System notifications" }]}
        />
      </SettingRow>
      <SettingRow title="Notification permission" description={<span role="status" data-testid="notification-permission-status">{permissionText}</span>}>
        {(permission === "default" || permission === "provisional") ? (
          <button type="button" className={BTN_PRIMARY} disabled={notificationPending} onClick={() => { void notificationAction("request"); }}>Allow notifications</button>
        ) : native && (
          <button type="button" className={GHOST_BUTTON} disabled={notificationPending} onClick={() => { void notificationAction("settings"); }}>Open macOS Settings</button>
        )}
      </SettingRow>
      <SettingRow title="Test notification" description={testResult ?? "Send a system notification without running an agent or changing delivery preferences."}>
        <button type="button" className={GHOST_BUTTON} disabled={notificationPending || (permission !== "granted" && permission !== "provisional")} onClick={() => { void notificationAction("test"); }}>Send test</button>
        <button type="button" className={GHOST_BUTTON} disabled={notificationPending} onClick={() => { void notificationAction("refresh"); }}>Refresh</button>
      </SettingRow>
      {native && <p className={`${MUTED} pb-4`}>Sound is independent of macOS notification permission. Focus and notification summaries can delay or hide banners even when permission is allowed.</p>}
      {notificationError && <p className="m-0 pb-4 text-[0.8rem] text-red" role="alert">Notification action failed: {notificationError}</p>}
    </SettingsGroup>
    <SettingsGroup title="Usage">
      <SettingRow title="Plan limit alert" description="Notify when a plan window crosses this share.">
        <Select
          className={SELECT}
          testId="settings-usage-limit-alert"
          ariaLabel="Plan limit alert"
          disabled={!settings}
          value={String(settings?.usageLimitAlert ?? 80)}
          onChange={(value) => updateSettings({ usageLimitAlert: Number(value) })}
          options={[{ value: "0", label: "Off" }, ...[50, 75, 80, 90, 95].map((percent) => ({ value: String(percent), label: `${percent}%` }))]}
        />
      </SettingRow>
      <SettingRow title="Daily spend alert" description="Notify once a day when API-equivalent spend passes this.">
        <Select
          className={SELECT}
          testId="settings-usage-daily-budget"
          ariaLabel="Daily spend alert"
          disabled={!settings}
          value={String(settings?.usageDailyBudgetUsd ?? 0)}
          onChange={(value) => updateSettings({ usageDailyBudgetUsd: Number(value) })}
          options={[{ value: "0", label: "Off" }, ...[5, 10, 25, 50, 100, 250].map((dollars) => ({ value: String(dollars), label: `$${dollars}` }))]}
        />
      </SettingRow>
    </SettingsGroup>
    <SettingsGroup title="Sub-sessions">
      <SettingRow title="Let leads start sub-sessions without asking" description="Off: when an agent wants to start a sub-session it puts a suggested task in its chat, and nothing starts until you press Start. On: it starts one itself, in any turn, and the limits below bound the run. You can stop any of them.">
        <Switch label="Let leads start sub-sessions without asking" testId="settings-leads-start-without-asking" checked={settings?.leadsStartWithoutAsking ?? true} onChange={(checked) => updateSettings({ leadsStartWithoutAsking: checked })} />
      </SettingRow>
      {RUN_LIMIT_FIELDS.map((field) => (
        <RunLimitRow key={field.key} field={field} saved={settings?.[field.key]} disabled={!settings} onCommit={(value) => updateSettings({ [field.key]: value })} />
      ))}
    </SettingsGroup>
    <SettingsGroup title="Sub-session summaries">
      <SettingRow title="Summarise finished turns" description="When a sub-session finishes a turn without reporting, a small model writes a short summary for the session that started it. Off keeps the start of its last message.">
        <Switch label="Summarise finished sub-session turns" testId="settings-reporter-enabled" checked={settings?.reporterEnabled ?? true} onChange={(checked) => updateSettings({ reporterEnabled: checked })} />
      </SettingRow>
      <SettingRow title="Claude model" description="Asked of the claude command, signed in as you, with no tools. The default, haiku, follows the current Haiku model; a full name such as claude-haiku-4-5 pins one.">
        <HarnessModelPicker harness="claude" testId="settings-reporter-claude-model" label="Summary model for Claude" disabled={!settings} value={settings?.reporterClaudeModel ?? "haiku"} onCommit={(value) => updateSettings({ reporterClaudeModel: value })} />
      </SettingRow>
      <SettingRow title="Codex model" description="Asked of the codex command, read-only, with no shell. If your Codex does not offer gpt-6-luna, use gpt-5.6-luna.">
        <HarnessModelPicker harness="codex" testId="settings-reporter-codex-model" label="Summary model for Codex" disabled={!settings} value={settings?.reporterCodexModel ?? "gpt-6-luna"} onCommit={(value) => updateSettings({ reporterCodexModel: value })} />
      </SettingRow>
      <SettingRow title="Pi model" description="Asked of the pi command as provider/model, with no tools, extensions or saved session, so any provider Pi is set up for works. Empty: Pi's sessions are summarised by Claude or Codex when installed, else by the start of their last message.">
        <HarnessModelPicker harness="pi" testId="settings-reporter-pi-model" label="Summary model for Pi" allowEmpty placeholder="provider/model" disabled={!settings} value={settings?.reporterPiModel ?? ""} onCommit={(value) => updateSettings({ reporterPiModel: value })} />
      </SettingRow>
      <SettingRow title="OMP model" description="Asked of the omp command as provider/model, with no tools, extensions or saved session. Empty: OMP's sessions are summarised by Claude or Codex when installed, else by the start of their last message.">
        <HarnessModelPicker harness="omp" testId="settings-reporter-omp-model" label="Summary model for OMP" allowEmpty placeholder="provider/model" disabled={!settings} value={settings?.reporterOmpModel ?? ""} onCommit={(value) => updateSettings({ reporterOmpModel: value })} />
      </SettingRow>
    </SettingsGroup>
    </>
  );
}

// The per-run sub-session limits. Ranges and defaults mirror `RunLimits` in
// crates/perch-core/src/sub_sessions.rs, which is what validates them; the core also
// refuses a total below the live limit.
type RunLimitKey = "maxLiveSubSessions" | "maxSubSessions" | "maxMessagesPerRun" | "maxLeadWakesPerRun" | "maxInterruptsPerSubSession" | "maxWaitingSuggestions";
interface RunLimitField { key: RunLimitKey; title: string; description: string; fallback: number; min: number; max: number }
const RUN_LIMIT_FIELDS: RunLimitField[] = [
  { key: "maxLiveSubSessions", title: "Live sub-sessions per run", description: "Running at once under one lead.", fallback: 4, min: 1, max: 16 },
  { key: "maxSubSessions", title: "Sub-sessions per run", description: "All a lead may start in a run, stopped ones included. At least the live limit.", fallback: 8, min: 1, max: 64 },
  { key: "maxMessagesPerRun", title: "Messages per run", description: "Messages the run's agents may send each other. Notes do not count.", fallback: 50, min: 1, max: 1000 },
  { key: "maxLeadWakesPerRun", title: "Automatic lead wakes per run", description: "Times a message may start a turn for the lead by itself.", fallback: 10, min: 1, max: 100 },
  { key: "maxInterruptsPerSubSession", title: "Interrupts per sub-session", description: "Times a lead may interrupt the same sub-session.", fallback: 3, min: 1, max: 20 },
  { key: "maxWaitingSuggestions", title: "Waiting suggested tasks", description: "Suggested-task cards waiting for you before new ones are refused.", fallback: 10, min: 1, max: 50 },
];

function RunLimitRow({ field, saved, disabled, onCommit }: { field: RunLimitField; saved: number | undefined; disabled: boolean; onCommit: (value: number) => void }) {
  const [text, setText] = useState(String(saved ?? field.fallback));
  useEffect(() => setText(String(saved ?? field.fallback)), [saved, field.fallback]);
  const parsed = Number(text);
  const valid = text.trim() !== "" && Number.isInteger(parsed) && parsed >= field.min && parsed <= field.max;
  // Show what was typed; save only a value in range (as the scrollback box does).
  const change = (value: string) => {
    setText(value);
    const next = Number(value);
    if (value.trim() !== "" && Number.isInteger(next) && next >= field.min && next <= field.max && next !== (saved ?? field.fallback)) onCommit(next);
  };
  return (
    <SettingRow title={field.title} description={valid ? `${field.description} ${field.min}–${field.max}.` : `Enter a whole number from ${field.min} to ${field.max}.`}>
      <input
        type="number"
        className={INPUT_PORT}
        data-testid={`settings-${field.key}`}
        aria-label={field.title}
        aria-invalid={!valid}
        min={field.min}
        max={field.max}
        disabled={disabled}
        value={text}
        onChange={(e) => change(e.target.value)}
      />
    </SettingRow>
  );
}

// ---------------------------------------------------------------------------
// InterfaceSection — Wave 2 item 12: pane-labels (agent badge) toggle.
// ---------------------------------------------------------------------------

function InterfaceSection() {
  // paneLabels.ts is a plain localStorage-backed module, not part of the
  // server-persisted `settings` object — no `updateSettings()`/WS round-trip
  // here, just a direct read/write against that module (mirrors how
  // `dockviewController.ts`'s state is module-level rather than store state).
  const [paneLabels, setPaneLabels] = useState(getPaneLabelsEnabled);
  // Its only row labels a tab the phone doesn't have.
  if (useIsMobileWidth()) return null;

  const handleChange = (checked: boolean) => {
    setPaneLabels(checked);
    setPaneLabelsEnabled(checked);
  };

  return (
    <SettingsGroup title="Interface">
      <SettingRow title="Agent on the chat tab" description={'Show the active agent on the chat pane\'s tab (e.g. "Chat · claude").'}>
        <Switch label="Show the active agent on the chat pane's tab" testId="settings-pane-labels" checked={paneLabels} onChange={handleChange} />
      </SettingRow>
    </SettingsGroup>
  );
}

// ---------------------------------------------------------------------------
// TerminalSection — Wave 2: scrollback length + login-shell toggle for plain
// terminal panes.
// ---------------------------------------------------------------------------

function TerminalSection() {
  const settings = usePerchStore((s) => s.settings);
  const updateSettings = usePerchStore((s) => s.updateSettings);

  // Optimistic local mirrors, same pattern as NotificationsSection: flip the
  // control instantly rather than waiting on the settings.update round-trip,
  // then resync from the authoritative settings.current once it lands.
  const [scrollback, setScrollback] = useState(String(settings?.terminalScrollback ?? 10000));
  const [loginShell, setLoginShell] = useState(settings?.terminalLoginShell ?? false);
  const [doubleQuotes, setDoubleQuotes] = useState(settings?.droppedPathDoubleQuotes ?? false);

  useEffect(() => {
    if (!settings) return;
    setScrollback(String(settings.terminalScrollback ?? 10000));
    setLoginShell(settings.terminalLoginShell ?? false);
    setDoubleQuotes(settings.droppedPathDoubleQuotes ?? false);
  }, [settings?.terminalScrollback, settings?.terminalLoginShell, settings?.droppedPathDoubleQuotes]);

  const handleScrollbackChange = (value: string) => {
    // The text box always shows exactly what was typed — clamping mid-keystroke
    // would fight the user (typing "5000" passes through "5", which would snap
    // to MIN_SCROLLBACK and eat the rest of the input).
    setScrollback(value);
    // But only *persist* a value that is actually in range. Writing every
    // intermediate keystroke through would store "5" on the way to "5000", and
    // since the clamp lives at terminal-creation time the settings file would
    // be left holding a number the app never honours.
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= MIN_SCROLLBACK && parsed <= MAX_SCROLLBACK) {
      updateSettings({ terminalScrollback: parsed });
    }
  };

  const handleLoginShellChange = (checked: boolean) => {
    setLoginShell(checked);
    updateSettings({ terminalLoginShell: checked });
  };

  return (
    <SettingsGroup>
      <SettingRow title="Scrollback (lines)" description={`${MIN_SCROLLBACK}–${MAX_SCROLLBACK} lines; takes effect on newly-opened terminal panes.`}>
        <input
          type="number"
          className={INPUT_PORT}
          data-testid="settings-terminal-scrollback"
          min={MIN_SCROLLBACK}
          max={MAX_SCROLLBACK}
          value={scrollback}
          onChange={(e) => handleScrollbackChange(e.target.value)}
        />
      </SettingRow>
      <SettingRow title="Login shell" description="Spawn plain terminal panes as a login shell. Applies to plain terminal panes only, not CLI-mode agent panes, and only to newly-created terminals.">
        <Switch label="Spawn plain terminal panes as a login shell" testId="settings-terminal-login-shell" checked={loginShell} onChange={handleLoginShellChange} />
      </SettingRow>
      <SettingRow title="Wrap dropped paths in double quotes" description="Applies to file drops in agent and shell terminals. Off uses single quotes; both safely escape shell characters.">
        <Switch label="Wrap dropped paths in double quotes" testId="settings-dropped-path-double-quotes" checked={doubleQuotes} onChange={(on) => { setDoubleQuotes(on); updateSettings({ droppedPathDoubleQuotes: on }); }} />
      </SettingRow>
      <SettingRow title="Remote file drops" description="Hold Option (Mac) or Alt while dropping onto a remote terminal to upload via SCP to a private staging folder. Up to 1 GiB per file on direct connections; 64 MiB through the phone relay. Dropping never presses Enter." />
    </SettingsGroup>
  );
}

// ---------------------------------------------------------------------------
// DevicesSection — pairing codes and paired devices
// ---------------------------------------------------------------------------

/**
 * A phone reaches the desktop app only while "Phone access" is on (the headless
 * `perch-core` is always reachable), and gets in only once someone here hands
 * it a code (see `crates/perch-core/src/devices.rs`); this is where access is
 * switched, the code and its QR are produced, and access is taken back.
 */
function DevicesSection() {
  const phone = usePhoneAccess();
  // A phone must not be able to switch off the only way it reaches the laptop.
  const isMobile = useIsMobileWidth();
  const [addressKind, setAddressKind] = useState<string | null>(null);
  const address = pickAddress(phone, addressKind);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const off = socket.onMessage((message) => {
      if (message.type === "device.list.result") setDevices(message.devices);
      if (message.type === "device.pair.code") {
        setCode(message.code);
        setExpiresAt(Date.now() + message.expiresInMs);
      }
    });
    socket.send({ type: "device.list", requestId: newId() });
    return off;
  }, []);

  // Only ticks while a code is on screen: the countdown is the only reason
  // this component needs a clock at all.
  useEffect(() => {
    if (!code) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [code]);
  const remaining = Math.max(0, Math.round((expiresAt - now) / 1000));
  useEffect(() => {
    if (code && remaining === 0) setCode(null);
  }, [code, remaining]);

  return (
    <>
    {!isMobile && (
      <SettingsGroup title="Phone access" testId="settings-phone-access">
        <PhoneAccessRows status={phone} kind={addressKind} onKind={setAddressKind} />
      </SettingsGroup>
    )}
    <SettingsGroup testId="settings-devices">
      <div className="py-3">
      <p className={MUTED}>
        Anything reaching this host from another machine needs a paired device. Local access never does.
      </p>
      {code ? (
        <div className="my-2 flex flex-wrap items-center gap-[0.8rem] rounded-ui bg-surface-0 px-3 py-[0.6rem]" data-testid="pair-code">
          {address && <QrCode text={pairLink(address.url, code)} />}
          <div className="flex min-w-0 flex-1 basis-[14rem] flex-col gap-[0.4rem]">
          <strong className="tracking-[0.22em] [font:1.15rem/1_var(--font-mono)]">{code}</strong>
          <span className={MUTED}>
            {address ? (address.kind === "relay" ? "Scan the QR with the phone." : "Scan the QR with the phone, or open the address above and enter the code.") : "Enter it on the other device."} Expires in {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}.
          </span>
          </div>
          <button
            type="button"
            data-testid="pair-cancel"
            onClick={() => {
              setCode(null);
              socket.send({ type: "device.pair.cancel", requestId: newId() });
            }}
          >
            Cancel
          </button>
        </div>
      ) : phone?.enabled === false && !phone.relay ? (
        <p className={MUTED} data-testid="pair-needs-access">Turn on Phone access or set a relay to pair a phone.</p>
      ) : (
        <button
          type="button"
          data-testid="pair-start"
          onClick={() => socket.send({ type: "device.pair.start", requestId: newId() })}
        >
          Pair a device
        </button>
      )}
      {devices.length === 0 ? (
        <p className={EMPTY}>No paired devices.</p>
      ) : (
        <ul className={LIST} data-testid="paired-devices">
          {devices.map((device) => (
            <li key={device.id} className={HOST_ROW}>
              <span className={NAME}>{device.name}</span>
              <span className={ADDR}>
                last seen {new Date(device.lastSeenAt).toLocaleString()}
              </span>
              <button
                type="button"
                data-testid={`device-revoke-${device.id}`}
                onClick={() => socket.send({ type: "device.revoke", requestId: newId(), deviceId: device.id })}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
      </div>
    </SettingsGroup>
    </>
  );
}

type SettingsTab = "general" | "appearance" | "agents" | "mods" | "keyboard" | "terminal" | "notifications" | "hosts" | "devices" | "permissions";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "agents", label: "Agents" },
  { id: "mods", label: "Mods" },
  { id: "keyboard", label: "Keyboard" },
  { id: "terminal", label: "Terminal" },
  { id: "notifications", label: "Notifications" },
  { id: "hosts", label: "SSH hosts" },
  { id: "devices", label: "Devices" },
  ...(macPermissionsAvailable ? [{ id: "permissions" as const, label: "Permissions" }] : []),
];

function TabContent({ tab }: { tab: SettingsTab }) {
  switch (tab) {
    case "general": return <><ChatModeSection /><InterfaceSection /><BrowserSection /><DefaultCwdSection /></>;
    case "appearance": return <><ThemeSection /><ChatTextSection /><TabShapeSection /></>;
    case "agents": return <AgentCatalog />;
    case "mods": return <ModsSection />;
    case "keyboard": return <KeybindingsSection />;
    case "terminal": return <TerminalSection />;
    case "notifications": return <NotificationsSection />;
    case "hosts": return <SshHostsSection />;
    case "devices": return <DevicesSection />;
    case "permissions": return <MacPermissions />;
  }
}

const SEARCH_FIELD = "box-border h-8 w-full min-w-0 rounded-ui bg-surface-0 px-[0.65rem] text-[0.82rem] text-fg [border:none] [font:inherit] placeholder:text-subtext-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-1px]";

/** The settings search field. Escape clears the text first, so a second Escape closes the page. */
function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      className={SEARCH_FIELD}
      type="search"
      data-testid="settings-search"
      aria-label="Search settings"
      placeholder="Search settings"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Escape" && value) { e.stopPropagation(); onChange(""); } }}
    />
  );
}

/** Every matching row across the sections, grouped under the section name. Keyboard has no rows
 * to filter, so it appears (whole) only when its name matches. */
function SettingsResults({ query }: { query: string }) {
  const q = query.trim().toLowerCase();
  const isMobile = useIsMobileWidth();
  return (
    <div className="[&:not(:has([data-setting-row]))>[data-none]]:block" data-testid="settings-results">
      {TABS.map(({ id, label }) => {
        const whole = id === "keyboard";
        if (whole && !label.toLowerCase().includes(q)) return null;
        if (id === "keyboard" && isMobile) return null; // no shortcuts to rebind on a touch screen
        return (
          <div key={id} data-testid={`settings-result-${id}`} className="not-has-[[data-setting-row]]:hidden">
            <h2 className="m-0 mb-3 text-[0.75rem] font-medium tracking-[0.04em] text-subtext-0 uppercase">{label}</h2>
            <SettingsQuery.Provider value={whole ? "" : q}>
              {whole && <span data-setting-row hidden />}
              <TabContent tab={id} />
            </SettingsQuery.Provider>
          </div>
        );
      })}
      <p className="m-0 hidden text-[0.85rem] text-subtext-0" data-none>No settings match “{query.trim()}”.</p>
    </div>
  );
}

/** The phone's settings: a section list, then one section at a time with a back
 * row (iOS-style), instead of the desktop's sidebar. Keyboard shortcuts are left
 * out: a touch screen has none to rebind. */
function MobileSettings({ tab, onTab, onClose }: { tab: SettingsTab | null; onTab: (tab: SettingsTab | null) => void; onClose: () => void }) {
  const current = TABS.find((t) => t.id === tab);
  const [query, setQuery] = useState("");
  const searching = !current && query.trim() !== "";
  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-panel-bg" data-testid="settings-modal" role="region" aria-label="Settings">
      <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center pt-[max(0.5rem,env(safe-area-inset-top))] pr-[env(safe-area-inset-right)] pl-[max(0.25rem,env(safe-area-inset-left))]">
        <button
          type="button"
          className={cn(GHOST_BUTTON, TAP_BUTTON, "flex min-h-[3.25rem] items-center gap-1 justify-self-start px-3 text-[0.9rem]")}
          data-testid={current ? "settings-back" : "settings-close"}
          aria-label={current ? "Back to settings" : "Close settings"}
          onClick={() => (current ? onTab(null) : onClose())}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9.5 3.5 5 8l4.5 4.5" /></svg>
          {current ? "Settings" : "Back"}
        </button>
        <h1 className="m-0 min-w-0 truncate text-center text-[0.95rem] font-semibold text-fg">{current?.label ?? "Settings"}</h1>
      </header>
      {current ? (
        <main className="settings-modal__body min-w-0 flex-1 overflow-y-auto px-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <TabContent tab={current.id} />
        </main>
      ) : (
        <nav className="flex-1 overflow-y-auto px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" aria-label="Settings sections">
          <div className="mb-4"><SearchBox value={query} onChange={setQuery} /></div>
          {searching ? <SettingsResults query={query} /> : <>
          <div className="overflow-hidden rounded-ui bg-surface-0">
            {TABS.filter((t) => t.id !== "keyboard").map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={cn(GHOST_BUTTON, TAP_BUTTON, "flex min-h-[3.25rem] w-full items-center justify-between rounded-none px-4 text-left text-[0.95rem] text-fg hover:text-fg")}
                data-testid={`settings-nav-${id}`}
                onClick={() => onTab(id)}
              >
                {label}
                <Chevron open={false} />
              </button>
            ))}
          </div>
          {inNativeApp() && (
            <button
              type="button"
              className={cn(GHOST_BUTTON, TAP_BUTTON, "mt-4 flex min-h-[3.25rem] w-full items-center rounded-ui bg-surface-0 px-4 text-left text-[0.95rem] text-red hover:bg-surface-0 hover:text-red")}
              data-testid="native-change-computer"
              onClick={disconnectNativeApp}
            >
              Change computer
            </button>
          )}
          </>}
        </nav>
      )}
    </div>
  );
}

/** Settings as a page of its own: it fills the window (the app stays mounted
 * underneath, so terminals keep running), with a section list on the left and
 * the chosen section on the right. Not a popup. */
export function SettingsPage() {
  const settingsOpen = usePerchStore((s) => s.settingsOpen);
  const settingsPage = usePerchStore((s) => s.settingsPage);
  const setSettingsOpen = usePerchStore((s) => s.setSettingsOpen);
  const fetchSettings = usePerchStore((s) => s.fetchSettings);
  const fetchHosts = usePerchStore((s) => s.fetchHosts);
  const isMobile = useIsMobileWidth();
  // `null` = the phone's section list.
  const [tab, setTab] = useState<SettingsTab | null>("general");
  const [query, setQuery] = useState("");

  // Fetch data every time the page opens, on the section the opener asked for.
  useEffect(() => {
    if (settingsOpen) {
      setQuery("");
      setTab(settingsPage === "agents" ? "agents" : window.matchMedia(`(max-width: ${MOBILE_WIDTH_BREAKPOINT}px)`).matches ? null : "general");
      fetchSettings();
      fetchHosts();
    }
  }, [settingsOpen, settingsPage, fetchSettings, fetchHosts]);

  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setSettingsOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [settingsOpen, setSettingsOpen]);

  if (!settingsOpen) return null;
  if (isMobile) return <MobileSettings tab={tab} onTab={setTab} onClose={() => setSettingsOpen(false)} />;
  const current = TABS.find((t) => t.id === (tab ?? "general"))!;
  const searching = query.trim() !== "";

  return (
    // Same shell as the app: full-height cards on the backdrop (App.tsx CARD; the traffic lights sit in the nav card).
    <div className="fixed inset-0 z-[1000] flex gap-2 bg-[var(--backdrop)] p-2 [--radius:var(--radius-pane)]" data-testid="settings-modal" role="region" aria-label="Settings" data-tauri-drag-region>
      <nav className={cn(CARD, "w-[15rem]")} aria-label="Settings sections">
        <div className="box-border flex h-11 shrink-0 items-center pl-3 in-[.app--mac-desktop]:pl-[84px]" data-tauri-drag-region>
          <button
            type="button"
            className={cn(GHOST_BUTTON, "flex items-center gap-1 py-[0.3rem] pr-2 pl-1 text-left text-[0.85rem]")}
            data-testid="settings-close"
            aria-label="Close settings"
            onClick={() => setSettingsOpen(false)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9.5 3.5 5 8l4.5 4.5" /></svg>
            Back to app
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-[2px] overflow-y-auto px-2 pb-3">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={cn(GHOST_BUTTON, "px-[0.65rem] py-[0.4rem] text-left text-[0.85rem]", !searching && id === current.id && "bg-surface-1 text-fg")}
              data-testid={`settings-nav-${id}`}
              aria-current={!searching && id === current.id ? "page" : undefined}
              onClick={() => { setQuery(""); setTab(id); }}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
      <main className={cn(CARD, "min-w-0 flex-1")}>
        <div className="box-border flex h-11 shrink-0 items-center justify-end px-4" data-tauri-drag-region>
          <div className="w-[16rem] max-w-full"><SearchBox value={query} onChange={setQuery} /></div>
        </div>
        <div className="settings-modal__body min-h-0 flex-1 overflow-y-auto px-8 pb-8">
          <div className="mx-auto max-w-[46rem]">
            <h1 className="m-0 mb-8 text-[1.6rem] font-semibold text-fg">{searching ? "Search results" : current.label}</h1>
            {searching ? <SettingsResults query={query} /> : <TabContent tab={current.id} />}
          </div>
        </div>
      </main>
    </div>
  );
}
