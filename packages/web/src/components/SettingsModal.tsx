/**
 * SettingsModal.tsx — Stage D settings panel, updated for Stage F2.
 *
 * Rendered as a fixed overlay from App.tsx whenever `settingsOpen` is true.
 * On open it fetches settings + hosts from the server. Sections:
 *  - SSH Hosts: list with live state dot + enabled toggle/delete; add form
 *    (with optional directUrl and remoteCmd inputs).
 *  - Custom models: per agent, list + add.
 *  - Default working directory: text input + Save.
 *  - Archived sessions: opens a subpage (the modal body swaps out) listing
 *    every archived session across hosts, with Restore / Delete per row.
 *    Archived sessions render nowhere else in the UI.
 */

import { useEffect, useRef, useState } from "react";
import { usePerchStore, archivedSessions } from "../store";
import type { SshHostEntry, ModelEntry, HostConnectionState, HostMode, SessionMode } from "@perch/shared";
import { THEME_NAMES, applyTheme } from "../themes";
import { getPaneLabelsEnabled, setPaneLabelsEnabled } from "../paneLabels";
import { ModeSwitch } from "./ModeSwitch";
import type { SessionModeOverrideScope } from "./SessionModeControl";
// Imported rather than re-declared so the bounds the UI enforces and the ones
// `createPerchTerminal` actually clamps to cannot drift apart.
import { MIN_SCROLLBACK, MAX_SCROLLBACK } from "../xtermSetup";

// ---------------------------------------------------------------------------
// HostStateDot (reusable in the modal host rows)
// ---------------------------------------------------------------------------

function hostStateDotClass(state: HostConnectionState): string {
  switch (state) {
    case "connected": return "host-state host-state--connected";
    case "connecting": return "host-state host-state--connecting";
    case "error": return "host-state host-state--error";
    case "disabled": return "host-state host-state--disabled";
    default: return "host-state host-state--disabled";
  }
}

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
    <section className="settings-modal__section">
      <h3 className="settings-modal__section-title">Theme</h3>
      <ul className="settings-modal__theme-list">
        {THEME_NAMES.map((name) => (
          <li key={name}>
            <button
              type="button"
              className={
                "settings-modal__theme-option" +
                (name === current ? " settings-modal__theme-option--active" : "")
              }
              data-testid={`theme-option-${name}`}
              onClick={() => handleSelect(name)}
            >
              <span className="settings-modal__theme-option-name">{name}</span>
              {name === current && (
                <span className="settings-modal__theme-option-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// ChatModeSection — runtime-aware mode policy with a legacy fallback.
// ---------------------------------------------------------------------------

function ChatModeSection() {
  const activeSessionId = usePerchStore((s) => s.sessionId);
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const activeSession = usePerchStore((s) =>
    activeSessionId ? s.sessions.find((session) => session.id === activeSessionId) : undefined,
  );
  const serverInfo = usePerchStore((s) => s.serverInfo);
  const workspaceCapabilitiesByHost = usePerchStore((s) => s.workspaceCapabilitiesByHost);
  const hostId = activeSession?.hostId ?? activeHostId;
  const capabilities = hostId === "local"
    ? serverInfo?.capabilities ?? []
    : workspaceCapabilitiesByHost[hostId] ?? [];
  const runtimeAvailable = capabilities.includes("session.mode.get") && capabilities.includes("session.mode.set");

  if (runtimeAvailable && activeSessionId) return <RuntimeChatModeSection sessionId={activeSessionId} />;
  return <LegacyChatModeSection />;
}

function RuntimeChatModeSection({ sessionId }: { sessionId: string }) {
  const settings = usePerchStore((s) => s.settings);
  const sessions = usePerchStore((s) => s.sessions);
  const activeWorkspaceId = usePerchStore((s) => s.activeWorkspaceId);
  const modeState = usePerchStore((s) => s.sessionModes[sessionId]);
  const fetchSessionMode = usePerchStore((s) => s.fetchSessionMode);
  const setSessionMode = usePerchStore((s) => s.setSessionMode);
  const workspaceId = sessions.find((session) => session.id === sessionId)?.workspaceId ?? activeWorkspaceId ?? undefined;
  const [scope, setScope] = useState<SessionModeOverrideScope>(
    modeState?.scope === "workspace" || modeState?.scope === "device" || modeState?.scope === "session"
      ? modeState.scope
      : "device",
  );

  useEffect(() => {
    fetchSessionMode(sessionId, workspaceId);
  }, [fetchSessionMode, sessionId, workspaceId]);

  useEffect(() => {
    if (modeState?.scope && modeState.scope !== "default") setScope(modeState.scope);
  }, [modeState?.scope]);

  const mode: SessionMode = modeState?.mode ?? settings?.chatMode ?? "hosted";
  const disabled = modeState?.state === "loading";
  const hasWorkspace = Boolean(workspaceId);

  const changeMode = (next: SessionMode) => {
    if (scope === "workspace" && !hasWorkspace) return;
    setSessionMode(sessionId, scope, next, workspaceId);
  };

  const clearOverride = () => {
    if (modeState?.scope === "default") return;
    const effectiveScope = modeState?.scope;
    if (effectiveScope === "session" || effectiveScope === "workspace" || effectiveScope === "device") {
      setSessionMode(sessionId, effectiveScope, undefined, workspaceId, true);
    }
  };

  return (
    <section className="settings-modal__section">
      <h3 className="settings-modal__section-title">Chat Mode</h3>
      <div className="settings-modal__field-row">
        <span className="settings-modal__field-label">Hosted / CLI</span>
        <ModeSwitch mode={mode} onChange={changeMode} testId="settings-chat-mode" disabled={disabled} />
        <select
          className="settings-modal__select"
          data-testid="settings-mode-scope"
          aria-label="Mode override scope"
          value={scope}
          disabled={disabled}
          onChange={(event) => setScope(event.target.value as SessionModeOverrideScope)}
        >
          <option value="device">Device default</option>
          <option value="workspace" disabled={!hasWorkspace}>Workspace</option>
          <option value="session">Session</option>
        </select>
      </div>
      <p className="settings-modal__muted">
        Applies to this {scope === "device" ? "device" : scope} and is shared by every connected view of the session.
        {modeState?.scope && modeState.scope !== "default" ? ` Effective source: ${modeState.scope}.` : ""}
      </p>
      {modeState?.state === "error" && (
        <p className="settings-modal__muted settings-modal__muted--error" role="alert">
          {modeState.error || "Mode could not be saved."}
        </p>
      )}
      {modeState?.scope && modeState.scope !== "default" && (
        <button
          type="button"
          className="settings-modal__btn"
          data-testid="settings-mode-clear"
          disabled={disabled}
          onClick={clearOverride}
        >
          Use inherited mode
        </button>
      )}
    </section>
  );
}

function LegacyChatModeSection() {
  const settings = usePerchStore((s) => s.settings);
  const updateSettings = usePerchStore((s) => s.updateSettings);

  // Optimistic local mirror, same pattern as NotificationsSection: flip the
  // control instantly on click rather than waiting on the settings.update
  // round-trip. The store's settings.current handler re-applies the
  // authoritative value (and drives every open chat pane) once it lands.
  const [chatMode, setChatMode] = useState<"hosted" | "cli">(settings?.chatMode ?? "hosted");

  useEffect(() => {
    if (!settings) return;
    setChatMode(settings.chatMode ?? "hosted");
  }, [settings?.chatMode]);

  const handleChange = (mode: "hosted" | "cli") => {
    setChatMode(mode);
    updateSettings({ chatMode: mode });
  };

  return (
    <section className="settings-modal__section">
      <h3 className="settings-modal__section-title">Chat Mode</h3>
      <div className="settings-modal__field-row">
        <span className="settings-modal__field-label">Hosted / CLI</span>
        <ModeSwitch mode={chatMode} onChange={handleChange} testId="settings-chat-mode" />
      </div>
      <p className="settings-modal__muted">
        Hosted shows the structured chat UI; CLI attaches every chat pane to the real
        interactive CLI in a terminal. Applies globally to all open chats.
      </p>
    </section>
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
      id: crypto.randomUUID(),
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
    <section className="settings-modal__section">
      <h3 className="settings-modal__section-title">SSH Hosts</h3>

      {hosts.length === 0 ? (
        <p className="settings-modal__empty">No hosts configured.</p>
      ) : (
        <ul className="settings-modal__host-list">
          {hosts.map((h) => {
            const info = hostStates[h.id];
            // Derive display state: info.state if available, else infer.
            const state: HostConnectionState = info
              ? info.state
              : h.enabled ? "connecting" : "disabled";
            return (
              <li key={h.id} className="settings-modal__host-row">
                <span
                  className={hostStateDotClass(state)}
                  title={state === "error" && info?.error ? info.error : state}
                />
                <span className="settings-modal__host-name">{h.name}</span>
                <span className="settings-modal__host-addr">
                  {h.sshHost}:{h.remotePort}
                </span>
                {/* Mode is editable in place: switching an existing host to
                    direct is the normal migration path once the remote no
                    longer needs a perch checkout. */}
                <select
                  className="settings-modal__select settings-modal__host-mode"
                  data-testid={`host-mode-${h.name}`}
                  title="perch = remote runs its own perch; direct = remote only needs claude/codex + tmux"
                  value={h.mode ?? "perch"}
                  onChange={(e) => upsertHost({ ...h, mode: e.target.value as HostMode })}
                >
                  <option value="perch">perch</option>
                  <option value="direct">direct</option>
                </select>
                {state === "error" && info?.error && (
                  <span className="settings-modal__host-error" title={info.error}>
                    {info.error.length > 40 ? info.error.slice(0, 40) + "…" : info.error}
                  </span>
                )}
                <label className="settings-modal__host-enabled" title="Enabled">
                  <input
                    type="checkbox"
                    checked={h.enabled}
                    onChange={() => upsertHost({ ...h, enabled: !h.enabled })}
                  />
                  <span>enabled</span>
                </label>
                <button
                  type="button"
                  className="settings-modal__btn settings-modal__btn--danger"
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

      <div className="settings-modal__add-row">
        <input
          type="text"
          className="settings-modal__input"
          placeholder="Name"
          value={newName}
          data-testid="host-name-input"
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          type="text"
          className="settings-modal__input"
          placeholder="SSH host"
          value={newSshHost}
          data-testid="host-ssh-input"
          onChange={(e) => setNewSshHost(e.target.value)}
        />
        <input
          type="number"
          className="settings-modal__input settings-modal__input--port"
          placeholder="Port"
          value={newPort}
          onChange={(e) => setNewPort(e.target.value)}
        />
        <select
          className="settings-modal__select"
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
          className="settings-modal__btn settings-modal__btn--primary"
          data-testid="host-add"
          onClick={handleAdd}
        >
          Add
        </button>
      </div>

      {/* Advanced optional fields */}
      <div className="settings-modal__add-row settings-modal__add-row--advanced">
        <input
          type="text"
          className="settings-modal__input"
          placeholder="Direct URL (optional, e.g. ws://127.0.0.1:7800/ws)"
          value={newDirectUrl}
          data-testid="host-direct-url-input"
          onChange={(e) => setNewDirectUrl(e.target.value)}
        />
        <input
          type="text"
          className="settings-modal__input"
          placeholder="Remote start cmd (optional, {port} placeholder)"
          value={newRemoteCmd}
          data-testid="host-remote-cmd-input"
          onChange={(e) => setNewRemoteCmd(e.target.value)}
        />
      </div>
    </section>
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
    <section className="settings-modal__section">
      <h3 className="settings-modal__section-title">Custom Models</h3>
      {(["claude", "codex"] as AgentKindKey[]).map((agent) => {
        const list = (settings.customModels[agent] ?? []) as ModelEntry[];
        return (
          <div key={agent} className="settings-modal__agent-block">
            <h4 className="settings-modal__agent-title">{agent}</h4>
            {list.length === 0 ? (
              <p className="settings-modal__empty">No custom {agent} models.</p>
            ) : (
              <ul className="settings-modal__model-list">
                {list.map((m) => (
                  <li key={m.id} className="settings-modal__model-row">
                    <span className="settings-modal__model-id">{m.id}</span>
                    <span className="settings-modal__model-label">{m.label}</span>
                    <button
                      type="button"
                      className="settings-modal__btn settings-modal__btn--danger"
                      onClick={() => handleRemove(agent, m.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="settings-modal__add-row">
              <input
                type="text"
                className="settings-modal__input"
                placeholder="Model ID"
                value={newId[agent]}
                onChange={(e) => setNewId((prev) => ({ ...prev, [agent]: e.target.value }))}
              />
              <input
                type="text"
                className="settings-modal__input"
                placeholder="Label (optional)"
                value={newLabel[agent]}
                onChange={(e) => setNewLabel((prev) => ({ ...prev, [agent]: e.target.value }))}
              />
              <button
                type="button"
                className="settings-modal__btn settings-modal__btn--primary"
                onClick={() => handleAdd(agent)}
              >
                Add
              </button>
            </div>
          </div>
        );
      })}
    </section>
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
    <section className="settings-modal__section">
      <h3 className="settings-modal__section-title">Default Working Directory</h3>
      <div className="settings-modal__add-row">
        <input
          type="text"
          className="settings-modal__input settings-modal__input--wide"
          placeholder="/path/to/your/project"
          value={cwd}
          onChange={(e) => setCwd(e.target.value)}
        />
        <button
          type="button"
          className="settings-modal__btn settings-modal__btn--primary"
          onClick={handleSave}
        >
          Save
        </button>
      </div>
      <p className="settings-modal__muted">
        Used as the cwd for new sessions. Leave empty to use the server process directory.
      </p>
    </section>
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
    <section className="settings-modal__section">
      <h3 className="settings-modal__section-title">Notifications</h3>
      <label className="settings-modal__checkbox-row">
        <input
          type="checkbox"
          data-testid="settings-sound-enabled"
          checked={soundEnabled}
          onChange={(e) => handleSoundEnabledChange(e.target.checked)}
        />
        Play a sound when a session finishes or needs attention
      </label>
      <div className="settings-modal__field-row">
        <span className="settings-modal__field-label">Toast delivery</span>
        <select
          className="settings-modal__select"
          data-testid="settings-toast-delivery"
          value={toastDelivery}
          onChange={(e) => handleToastDeliveryChange(e.target.value as "off" | "app" | "system")}
        >
          <option value="off">Off</option>
          <option value="app">In-app</option>
          <option value="system">System notifications</option>
        </select>
      </div>
      {toastDelivery === "system" &&
        typeof Notification !== "undefined" &&
        Notification.permission === "denied" && (
          <p className="settings-modal__muted">
            System notifications are blocked in your browser settings — falling back to in-app toasts.
          </p>
        )}
    </section>
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
    <section className="settings-modal__section">
      <h3 className="settings-modal__section-title">Interface</h3>
      <label className="settings-modal__checkbox-row">
        <input
          type="checkbox"
          data-testid="settings-pane-labels"
          checked={paneLabels}
          onChange={(e) => handleChange(e.target.checked)}
        />
        Show the active agent on the chat pane's tab (e.g. "Chat · claude")
      </label>
    </section>
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
    <section className="settings-modal__section">
      <h3 className="settings-modal__section-title">Terminal</h3>
      <div className="settings-modal__field-row">
        <span className="settings-modal__field-label">Scrollback (lines)</span>
        <input
          type="number"
          className="settings-modal__input settings-modal__input--port"
          data-testid="settings-terminal-scrollback"
          min={MIN_SCROLLBACK}
          max={MAX_SCROLLBACK}
          value={scrollback}
          onChange={(e) => handleScrollbackChange(e.target.value)}
        />
      </div>
      <p className="settings-modal__muted">
        {MIN_SCROLLBACK}–{MAX_SCROLLBACK} lines; takes effect on newly-opened terminal panes.
      </p>
      <label className="settings-modal__checkbox-row">
        <input
          type="checkbox"
          data-testid="settings-terminal-login-shell"
          checked={loginShell}
          onChange={(e) => handleLoginShellChange(e.target.checked)}
        />
        Spawn plain terminal panes as a login shell
      </label>
      <p className="settings-modal__muted">
        Applies to plain terminal panes only, not CLI-mode agent panes, and only to newly-created
        terminals.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Archived sessions — entry row + subpage
// ---------------------------------------------------------------------------

/** Last path segment of a cwd, for the project column. */
function projectName(cwd: string): string {
  const parts = cwd.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || cwd;
}

/**
 * The entry point for the archived-sessions subpage. Archived sessions are
 * hidden from every navigation surface (sidebar, tab bar, navigator), so this
 * panel is the only place they can be seen — and the only place they can be
 * restored from or permanently deleted.
 */
function ArchivedSessionsSection({ onOpen }: { onOpen: () => void }) {
  const sessions = usePerchStore((s) => s.sessions);
  const count = sessions.filter((s) => s.archived).length;

  return (
    <section className="settings-modal__section">
      <h3 className="settings-modal__section-title">Archived Sessions</h3>
      <div className="settings-modal__field-row">
        <span className="settings-modal__field-label">
          {count === 0 ? "None archived" : `${count} archived session${count === 1 ? "" : "s"}`}
        </span>
        <button
          type="button"
          className="settings-modal__btn settings-modal__btn--primary"
          data-testid="settings-archived-open"
          onClick={onOpen}
        >
          Manage…
        </button>
      </div>
      <p className="settings-modal__muted">
        Archiving a session hides it from the sidebar and tab bar. Restore it here to bring
        it back, or delete it permanently.
      </p>
    </section>
  );
}

/** The archived-sessions subpage itself: archived sessions grouped by host
 * (local first, then federated hosts), with per-row Restore / Delete. */
function ArchivedSessionsPanel() {
  const sessions = usePerchStore((s) => s.sessions);
  const hosts = usePerchStore((s) => s.hosts);
  const archiveSession = usePerchStore((s) => s.archiveSession);
  const deleteSession = usePerchStore((s) => s.deleteSession);

  const rows = archivedSessions(sessions);

  const hostLabel = (hostId: string): string =>
    hostId === "local" ? "Local" : (hosts.find((h) => h.id === hostId)?.name ?? hostId);

  // Group by host, matching the sidebar's mental model. "local" always sorts
  // first; the rest keep first-appearance order (rows arrive newest-first).
  const groups = new Map<string, typeof rows>();
  for (const s of rows) {
    const id = s.hostId ?? "local";
    const group = groups.get(id);
    if (group) group.push(s);
    else groups.set(id, [s]);
  }
  const groupIds = [...groups.keys()].sort((a, b) =>
    a === "local" ? -1 : b === "local" ? 1 : 0,
  );

  return (
    <section className="settings-modal__section" data-testid="settings-archived-panel">
      {rows.length === 0 ? (
        <p className="settings-modal__empty" data-testid="settings-archived-empty">
          No archived sessions.
        </p>
      ) : (
        groupIds.map((hostId) => (
          <div
            key={hostId}
            className="settings-modal__archived-group"
            data-testid={`archived-host-group-${hostId}`}
          >
            <h4 className="settings-modal__archived-group-title">{hostLabel(hostId)}</h4>
            <ul className="settings-modal__archived-list">
              {groups.get(hostId)!.map((s) => (
                <li
                  key={s.id}
                  className="settings-modal__archived-row"
                  data-testid={`archived-row-${s.id}`}
                  data-session-id={s.id}
                >
                  <div className="settings-modal__archived-body">
                    <span className="settings-modal__archived-title">
                      {s.title || "(untitled session)"}
                    </span>
                    <span className="settings-modal__archived-meta">
                      <span className="settings-modal__archived-project" title={s.cwd}>
                        {projectName(s.cwd)}
                      </span>
                      <span className="settings-modal__archived-date">
                        {new Date(s.createdAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="settings-modal__btn settings-modal__btn--primary"
                    data-testid={`archived-restore-${s.id}`}
                    onClick={() => archiveSession(s.id, false)}
                  >
                    Restore
                  </button>
                  {/* No confirmation, matching the sidebar's one-click delete. */}
                  <button
                    type="button"
                    className="settings-modal__btn settings-modal__btn--danger"
                    data-testid={`archived-delete-${s.id}`}
                    onClick={() => deleteSession(s.id)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// SettingsModal
// ---------------------------------------------------------------------------

/** Which view the modal body is showing. The modal is a flat scrolling list of
 * sections by default; "archived" swaps the body for the archived-sessions
 * subpage (reached from the Archived Sessions section's "Manage…" button). */
type SettingsView = "main" | "archived";

export function SettingsModal() {
  const settingsOpen = usePerchStore((s) => s.settingsOpen);
  const setSettingsOpen = usePerchStore((s) => s.setSettingsOpen);
  const fetchSettings = usePerchStore((s) => s.fetchSettings);
  const fetchHosts = usePerchStore((s) => s.fetchHosts);

  const panelRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<SettingsView>("main");

  // Fetch data every time the modal opens, and always open on the main view.
  useEffect(() => {
    if (settingsOpen) {
      setView("main");
      fetchSettings();
      fetchHosts();
    }
  }, [settingsOpen, fetchSettings, fetchHosts]);

  // Escape: back out of the subpage first, close the modal from the main view.
  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (view === "main") setSettingsOpen(false);
      else setView("main");
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [settingsOpen, setSettingsOpen, view]);

  if (!settingsOpen) return null;

  return (
    <div
      className="settings-modal__backdrop"
      onClick={() => setSettingsOpen(false)}
    >
      <div
        ref={panelRef}
        className="settings-modal__panel"
        data-testid="settings-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-modal__header">
          {view === "archived" && (
            <button
              type="button"
              className="settings-modal__back"
              data-testid="settings-archived-back"
              aria-label="Back to settings"
              onClick={() => setView("main")}
            >
              ‹
            </button>
          )}
          <h2 className="settings-modal__title">
            {view === "archived" ? "Archived Sessions" : "Settings"}
          </h2>
          <button
            type="button"
            className="settings-modal__close"
            aria-label="Close settings"
            onClick={() => setSettingsOpen(false)}
          >
            ✕
          </button>
        </div>

        <div className="settings-modal__body">
          {view === "archived" ? (
            <ArchivedSessionsPanel />
          ) : (
            <>
              <ThemeSection />
              <ChatModeSection />
              <NotificationsSection />
              <InterfaceSection />
              <TerminalSection />
              <ArchivedSessionsSection onOpen={() => setView("archived")} />
              <SshHostsSection />
              <CustomModelsSection />
              <DefaultCwdSection />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
