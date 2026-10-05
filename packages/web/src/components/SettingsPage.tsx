/**
 * SettingsPage.tsx — settings as a full-window page (see `SettingsPage` below).
 * Opens whenever `settingsOpen` is true and fetches settings + hosts from the
 * server. Sections are grouped into the left-hand tabs; each is a card of rows.
 */

import { useEffect, useRef, useState } from "react";
import { usePerchStore } from "../store";
import type { SshHostEntry, ModelEntry, HostConnectionState, HostMode, DeviceSummary } from "@perch/shared";
import { THEME_NAMES, applyTheme } from "../themes";
import { getPaneLabelsEnabled, setPaneLabelsEnabled } from "../paneLabels";
import { ModeSwitch } from "./ModeSwitch";
import { socket } from "../ws";
import { AgentCatalog } from "./AgentCatalog";
import { useAgentChoices } from "./AgentPicker";
// Imported rather than re-declared so the bounds the UI enforces and the ones
// `createPerchTerminal` actually clamps to cannot drift apart.
import { MIN_SCROLLBACK, MAX_SCROLLBACK } from "../xtermSetup";
import { newId } from "../ids";
import { HostStateDot } from "./HostStateDot";
import { cn } from "../lib/cn";
import { SettingsGroup, SettingRow } from "./ui/setting-row";
import { Switch } from "./ui/switch";
import { GHOST_BUTTON } from "./ui/icon-button";
import {
  ADD_ROW, ADDR, BTN_DANGER, BTN_PRIMARY, CHECKBOX_ROW, EMPTY, FIELD_ROW, HOST_ROW, INPUT, INPUT_PORT, INPUT_WIDE,
  CATALOG_ACTION, LIST, MODEL_ROW, MUTED, NAME, SECTION, SECTION_TITLE, SELECT, SELECT_HOST,
} from "./ui/settings";

// ---------------------------------------------------------------------------
// ThemeSection
// ---------------------------------------------------------------------------

function ThemeSection() {
  const settings = usePerchStore((s) => s.settings);
  const updateSettings = usePerchStore((s) => s.updateSettings);

  if (!settings) return null;
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
      <div className="py-3">
      <ul className="m-0 mb-2 flex list-none flex-wrap gap-[0.4rem] p-0">
        {THEME_NAMES.map((name) => (
          <li key={name}>
            <button
              type="button"
              className={cn(
                "flex cursor-pointer items-center gap-[0.4rem] rounded-ui border bg-surface-1 px-[0.65rem] py-[0.3rem] text-[0.8rem] hover:border-overlay-1",
                name === current ? "settings-modal__theme-option--active border-accent text-accent" : "border-overlay-0 text-fg",
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

// ---------------------------------------------------------------------------
// ChatModeSection — the one global UI/CLI setting.
// ---------------------------------------------------------------------------

function ChatModeSection() {
  const settings = usePerchStore((s) => s.settings);
  const updateSettings = usePerchStore((s) => s.updateSettings);

  // Optimistic local mirror, same pattern as NotificationsSection: flip the
  // control instantly on click rather than waiting on the settings.update
  // round-trip. The store's settings.current handler re-applies the
  // authoritative value (and drives every open chat pane) once it lands.
  const [chatMode, setChatMode] = useState<"hosted" | "cli">(settings?.chatMode ?? "cli");
  const { choices: agentChoices } = useAgentChoices(usePerchStore((s) => s.activeHostId));

  useEffect(() => {
    if (!settings) return;
    setChatMode(settings.chatMode ?? "cli");
  }, [settings?.chatMode]);

  const handleChange = (mode: "hosted" | "cli") => {
    setChatMode(mode);
    updateSettings({ chatMode: mode });
  };

  return (
    <SettingsGroup title="Chat mode">
      <SettingRow title="UI / CLI" description="UI or CLI for every session.">
        <ModeSwitch mode={chatMode} onChange={handleChange} testId="settings-chat-mode" />
      </SettingRow>
      <SettingRow title="Empty workspace opens" description="What clicking a workspace with no open tabs starts.">
        <select
          className={SELECT}
          data-testid="settings-empty-workspace-agent"
          value={settings?.emptyWorkspaceAgent ?? ""}
          onChange={(e) => updateSettings({ emptyWorkspaceAgent: e.target.value })}
        >
          <option value="">Ask (show the picker)</option>
          {agentChoices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
        </select>
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
  // every hosted turn detached. Defaults to "direct" — most SSH targets don't
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
                <select
                  className={SELECT_HOST}
                  data-testid={`host-mode-${h.name}`}
                  title="perch = remote runs its own perch; direct = remote only needs claude/codex + tmux"
                  value={h.mode ?? "perch"}
                  onChange={(e) => upsertHost({ ...h, mode: e.target.value as HostMode })}
                >
                  <option value="perch">perch</option>
                  <option value="direct">direct</option>
                </select>
                {state === "error" && info?.error && (
                  <span className="min-w-0 flex-1 overflow-hidden text-[0.72rem] text-ellipsis whitespace-nowrap text-red" title={info.error}>
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
        <select
          className={SELECT}
          data-testid="host-mode-input"
          title="direct = remote only needs claude/codex + tmux; perch = remote runs its own perch"
          value={newMode}
          onChange={(e) => setNewMode(e.target.value as HostMode)}
        >
          <option value="direct">direct</option>
          <option value="perch">perch</option>
        </select>
        <button
          type="button"
          className={BTN_PRIMARY}
          data-testid="host-add"
          onClick={handleAdd}
        >
          Add
        </button>
      </div>

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
// CustomModelsSection
// ---------------------------------------------------------------------------

type AgentKindKey = "claude" | "codex";

function CustomModelsSection() {
  const settings = usePerchStore((s) => s.settings);
  const updateSettings = usePerchStore((s) => s.updateSettings);

  const [newId, setNewId] = useState<Record<AgentKindKey, string>>({ claude: "", codex: "" });
  const [newLabel, setNewLabel] = useState<Record<AgentKindKey, string>>({ claude: "", codex: "" });

  if (!settings) return null;

  const handleRemove = (agent: AgentKindKey, idToRemove: string) => {
    const current = settings.customModels[agent] as ModelEntry[];
    updateSettings({
      customModels: {
        ...settings.customModels,
        [agent]: current.filter((m) => m.id !== idToRemove),
      },
    });
  };

  const handleAdd = (agent: AgentKindKey) => {
    const id = newId[agent].trim();
    const label = newLabel[agent].trim() || id;
    if (!id) return;
    const current = settings.customModels[agent] as ModelEntry[];
    if (current.some((m) => m.id === id)) return; // dedup
    updateSettings({
      customModels: {
        ...settings.customModels,
        [agent]: [...current, { id, label }],
      },
    });
    setNewId((prev) => ({ ...prev, [agent]: "" }));
    setNewLabel((prev) => ({ ...prev, [agent]: "" }));
  };

  return (
    <SettingsGroup title="Custom Models">
      <div className="py-3">
      {(["claude", "codex"] as AgentKindKey[]).map((agent) => {
        const list = (settings.customModels[agent] ?? []) as ModelEntry[];
        return (
          <div key={agent} className="settings-modal__agent-block mb-3">
            <h4 className="m-0 mb-[0.35rem] text-[0.8rem] font-semibold tracking-[0.04em] text-subtext-0 uppercase">{agent}</h4>
            {list.length === 0 ? (
              <p className={EMPTY}>No custom {agent} models.</p>
            ) : (
              <ul className={LIST}>
                {list.map((m) => (
                  <li key={m.id} className={MODEL_ROW}>
                    <span className={NAME}>{m.id}</span>
                    <span className={ADDR}>{m.label}</span>
                    <button
                      type="button"
                      className={BTN_DANGER}
                      onClick={() => handleRemove(agent, m.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className={ADD_ROW}>
              <input
                type="text"
                className={INPUT}
                placeholder="Model ID"
                value={newId[agent]}
                onChange={(e) => setNewId((prev) => ({ ...prev, [agent]: e.target.value }))}
              />
              <input
                type="text"
                className={INPUT}
                placeholder="Label (optional)"
                value={newLabel[agent]}
                onChange={(e) => setNewLabel((prev) => ({ ...prev, [agent]: e.target.value }))}
              />
              <button
                type="button"
                className={BTN_PRIMARY}
                onClick={() => handleAdd(agent)}
              >
                Add
              </button>
            </div>
          </div>
        );
      })}
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

// ---------------------------------------------------------------------------
// NotificationsSection — Wave 1 items 3 & 4: sound + toast delivery
// ---------------------------------------------------------------------------

function NotificationsSection() {
  const settings = usePerchStore((s) => s.settings);
  const updateSettings = usePerchStore((s) => s.updateSettings);

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
    if (value === "system" && typeof Notification !== "undefined" && Notification.permission === "default") {
      // Ask up front, at the moment the user opts in — not silently later
      // when the first toast would have fired.
      Notification.requestPermission().finally(() => updateSettings({ toastDelivery: value }));
      return;
    }
    updateSettings({ toastDelivery: value });
  };

  return (
    <SettingsGroup>
      <SettingRow title="Sound" description="Play a sound when a session finishes or needs attention.">
        <Switch label="Play a sound when a session finishes or needs attention" testId="settings-sound-enabled" checked={soundEnabled} onChange={handleSoundEnabledChange} />
      </SettingRow>
      <SettingRow
        title="Toast delivery"
        description={toastDelivery === "system" && typeof Notification !== "undefined" && Notification.permission === "denied"
          ? "System notifications are blocked in your browser settings — falling back to in-app toasts."
          : undefined}
      >
        <select
          className={SELECT}
          data-testid="settings-toast-delivery"
          value={toastDelivery}
          onChange={(e) => handleToastDeliveryChange(e.target.value as "off" | "app" | "system")}
        >
          <option value="off">Off</option>
          <option value="app">In-app</option>
          <option value="system">System notifications</option>
        </select>
      </SettingRow>
    </SettingsGroup>
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

  useEffect(() => {
    if (!settings) return;
    setScrollback(String(settings.terminalScrollback ?? 10000));
    setLoginShell(settings.terminalLoginShell ?? false);
  }, [settings?.terminalScrollback, settings?.terminalLoginShell]);

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
    </SettingsGroup>
  );
}

// ---------------------------------------------------------------------------
// SettingsModal
// ---------------------------------------------------------------------------

/** Which view the modal body is showing. The modal is a flat scrolling list of
 * sections by default; "agents" swaps the body for the agent catalog. */
type SettingsView = "main" | "agents";


// ---------------------------------------------------------------------------
// DevicesSection — pairing codes and paired devices
// ---------------------------------------------------------------------------

/**
 * perch's host binds `0.0.0.0`, so a phone on the same network can reach it.
 * A device only gets in once someone here hands it a code (see
 * `crates/perch-core/src/devices.rs`); this is where that code is produced and
 * where access is taken back.
 */
function DevicesSection() {
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
    <SettingsGroup testId="settings-devices">
      <div className="py-3">
      <p className={MUTED}>
        Anything reaching this host from another machine needs a paired device. Local access never does.
      </p>
      {code ? (
        <div className="my-2 flex flex-wrap items-center gap-[0.6rem] rounded-ui border border-overlay-0 bg-surface-0 px-3 py-[0.6rem]" data-testid="pair-code">
          <strong className="tracking-[0.22em] [font:1.15rem/1_var(--font-mono)]">{code}</strong>
          <span className={MUTED}>
            Enter it on the other device. Expires in {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}.
          </span>
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
  );
}

type SettingsTab = "general" | "appearance" | "agents" | "terminal" | "notifications" | "hosts" | "devices";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "agents", label: "Agents" },
  { id: "terminal", label: "Terminal" },
  { id: "notifications", label: "Notifications" },
  { id: "hosts", label: "SSH hosts" },
  { id: "devices", label: "Devices" },
];

function TabContent({ tab }: { tab: SettingsTab }) {
  switch (tab) {
    case "general": return <><ChatModeSection /><InterfaceSection /><DefaultCwdSection /></>;
    case "appearance": return <ThemeSection />;
    case "agents": return <><AgentCatalog /><CustomModelsSection /></>;
    case "terminal": return <TerminalSection />;
    case "notifications": return <NotificationsSection />;
    case "hosts": return <SshHostsSection />;
    case "devices": return <DevicesSection />;
  }
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
  const [tab, setTab] = useState<SettingsTab>("general");

  // Fetch data every time the page opens, on the section the opener asked for.
  useEffect(() => {
    if (settingsOpen) {
      setTab(settingsPage === "agents" ? "agents" : "general");
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
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-panel-bg" data-testid="settings-modal" role="region" aria-label="Settings">
      {/* The title bar of the macOS app: empty space drags the window. */}
      <div className="h-9 shrink-0" data-tauri-drag-region />
      <div className="flex min-h-0 flex-1 max-[700px]:flex-col">
        <nav className="flex w-[15rem] shrink-0 flex-col gap-[0.15rem] overflow-y-auto bg-surface-0 px-3 py-3 max-[700px]:w-auto max-[700px]:flex-row max-[700px]:overflow-x-auto max-[700px]:py-2" aria-label="Settings sections">
          <button
            type="button"
            className={cn(GHOST_BUTTON, "mb-3 flex items-center gap-2 px-2 py-[0.4rem] text-left text-[0.85rem] max-[700px]:mb-0 max-[700px]:shrink-0")}
            data-testid="settings-close"
            aria-label="Close settings"
            onClick={() => setSettingsOpen(false)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9.5 3.5 5 8l4.5 4.5" /></svg>
            Back to app
          </button>
          <h2 className="m-0 mb-2 px-2 text-[1.1rem] font-semibold text-fg max-[700px]:hidden">Settings</h2>
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={cn(GHOST_BUTTON, "px-2 py-[0.4rem] text-left text-[0.85rem] max-[700px]:shrink-0", id === tab && "bg-surface-1 text-fg")}
              data-testid={`settings-nav-${id}`}
              aria-current={id === tab ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <main className="settings-modal__body min-w-0 flex-1 overflow-y-auto px-8 py-8 max-[700px]:px-4">
          <div className={cn("mx-auto", tab === "agents" ? "max-w-[60rem]" : "max-w-[46rem]")}>
            <h1 className="m-0 mb-8 text-[1.6rem] font-semibold text-fg">{current.label}</h1>
            <TabContent tab={tab} />
          </div>
        </main>
      </div>
    </div>
  );
}
