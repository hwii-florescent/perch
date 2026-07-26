/**
 * SettingsModal.tsx — Stage D settings panel, updated for Stage F2.
 *
 * Rendered as a fixed overlay from App.tsx whenever `settingsOpen` is true.
 * On open it fetches settings + hosts from the server. Sections:
 *  - SSH Hosts: list with live state dot + enabled toggle/delete; add form
 *    (with optional directUrl and remoteCmd inputs).
 *  - Custom models: per agent, list + add.
 *  - Default working directory: text input + Save.
 */

import { useEffect, useRef, useState } from "react";
import { usePerchStore } from "../store";
import type { SshHostEntry, ModelEntry, HostConnectionState } from "@perch/shared";

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
      ...(directUrl ? { directUrl } : {}),
      ...(remoteCmd ? { remoteCmd } : {}),
    });
    setNewName("");
    setNewSshHost("");
    setNewPort("7788");
    setNewDirectUrl("");
    setNewRemoteCmd("");
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
// SettingsModal
// ---------------------------------------------------------------------------

export function SettingsModal() {
  const settingsOpen = usePerchStore((s) => s.settingsOpen);
  const setSettingsOpen = usePerchStore((s) => s.setSettingsOpen);
  const fetchSettings = usePerchStore((s) => s.fetchSettings);
  const fetchHosts = usePerchStore((s) => s.fetchHosts);

  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch data every time the modal opens.
  useEffect(() => {
    if (settingsOpen) {
      fetchSettings();
      fetchHosts();
    }
  }, [settingsOpen, fetchSettings, fetchHosts]);

  // Close on Escape.
  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [settingsOpen, setSettingsOpen]);

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
          <h2 className="settings-modal__title">Settings</h2>
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
          <SshHostsSection />
          <CustomModelsSection />
          <DefaultCwdSection />
        </div>
      </div>
    </div>
  );
}
