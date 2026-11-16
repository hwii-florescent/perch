// The props of the Settings pages, as the web builds them (`packages/web/src/components/settingsRoutes.tsx`,
// `AgentCatalog.tsx`, `KeybindingsSection.tsx`, `PhoneAccess.tsx`, `MachineCheck.tsx`), from the `perch` module instead
// of the web's store: one hook per page, each returning the props its stock screen takes. Saving is `send("settings.update")`
// and the core's own answer then arrives as the settings again, as in the web. What only the desktop app can do (the
// system notification permission, macOS permissions, a terminal tab for an ssh login) is the web's own wording where
// the page has it, or a hand-off ("Open in Perch"), and never a control that does nothing.
//
// Written by hand and shared by the Settings screen (`mods/react-runtime/`); `build.mjs` leaves it alone.
import { useCallback, useEffect, useRef, useState } from "react";
import { newId, useAgentChoices, useHostSnapshot } from "@perch/sdk";
import { runningHost } from "./host.js";

const host = () => runningHost();
const save = (change) => host().send("settings.update", { patch: change });
const ask = (kind, args = {}) => host().ask(kind, args);
const refused = (answer) => answer === null || (answer && typeof answer === "object" && "error" in answer && typeof answer.error === "string");

/** The core's settings (`PerchSettings`), null until it has sent them, and the one way a page writes them. */
export function useSettings() {
  const settings = useHostSnapshot((perch) => perch.settings());
  return { settings, updateSettings: save };
}

/** A question for the core asked on mount and again with `reload()`: its answer, null before one or when none came. */
function useAsked(kind, args = {}, enabled = true) {
  const [answer, setAnswer] = useState(null);
  const mounted = useRef(true);
  const key = JSON.stringify(args);
  useEffect(() => () => { mounted.current = false; }, []);
  const reload = useCallback(() => {
    if (!enabled) return Promise.resolve(null);
    return ask(kind, JSON.parse(key)).then((got) => {
      if (mounted.current && !refused(got)) setAnswer(got);
      return got;
    });
  }, [kind, key, enabled]);
  useEffect(() => { void reload(); }, [reload]);
  return [answer, reload, setAnswer];
}

// ---- General ----------------------------------------------------------------------------------------------------------

/** The web's `BROWSER_SEARCH_ENGINES` (`links.ts`), by id and label; `test/settings.test.mjs` checks they are the app's. */
export const SEARCH_ENGINES = [
  { id: "google", label: "Google" },
  { id: "duckduckgo", label: "DuckDuckGo" },
  { id: "bing", label: "Bing" },
  { id: "brave", label: "Brave" },
];
const PANE_LABELS = "perch.paneLabels.enabled";

export function useGeneralProps() {
  const { settings, updateSettings } = useSettings();
  const { choices } = useAgentChoices("local");
  const storage = host().storage;
  const [paneLabels, setPaneLabels] = useState(() => storage.getItem(PANE_LABELS) !== "0");
  return {
    settings, isMobile: false, paneLabels,
    agentChoices: choices.map((choice) => ({ id: choice.id, label: choice.label })),
    searchEngines: SEARCH_ENGINES,
    actions: {
      updateSettings,
      setPaneLabels: (on) => { storage.setItem(PANE_LABELS, on ? "1" : "0"); setPaneLabels(on); },
      // The history is the core's (the desktop app's address bar reads it), so clearing it here clears it there.
      clearBrowsingHistory: () => { host().send("browser.history.clear", {}); },
    },
  };
}

// ---- Appearance -------------------------------------------------------------------------------------------------------

/** The web's `CHAT_FONT_SIZES` (`chatFont.ts`). */
export const CHAT_FONT_SIZES = [
  { value: "0.9", label: "Small" },
  { value: "1", label: "Default" },
  { value: "1.1", label: "Large" },
  { value: "1.25", label: "Extra large" },
];
const CHAT_FONT_KEY = "perch.chatFontScale";
const SEND_WHILE_WORKING_KEY = "perch.sendWhileWorking";

export function useAppearanceProps() {
  const { settings, updateSettings } = useSettings();
  const storage = host().storage;
  const [chatTextSize, setSize] = useState(() => {
    const stored = storage.getItem(CHAT_FONT_KEY);
    return CHAT_FONT_SIZES.some((size) => size.value === stored) ? stored : "1";
  });
  const [sendWhileWorking, setSend] = useState(() => (storage.getItem(SEND_WHILE_WORKING_KEY) === "queue" ? "queue" : "steer"));
  return {
    settings, themes: host().themes(), chatTextSize, sendWhileWorking,
    chatTextSizes: CHAT_FONT_SIZES,
    actions: {
      // The window shows the theme at once (`app.theme`) and the core keeps it.
      setTheme: (name) => { host().command("app.theme", { name }); },
      setChatTextSize: (value) => { storage.setItem(CHAT_FONT_KEY, value); setSize(value); },
      setSendWhileWorking: (mode) => { storage.setItem(SEND_WHILE_WORKING_KEY, mode); setSend(mode); },
      updateSettings,
    },
  };
}

// ---- Terminal ---------------------------------------------------------------------------------------------------------

/** The scrollback the terminal honours (`xtermSetup.ts`'s MIN and MAX, and `settings.rs` here). */
export const SCROLLBACK = { min: 100, max: 200000 };

export function useTerminalProps() {
  const { settings, updateSettings } = useSettings();
  return { settings, scrollback: SCROLLBACK, actions: { updateSettings } };
}

// ---- Keyboard ---------------------------------------------------------------------------------------------------------

/** The most rows of the Keyboard page drawn at once. A screen is drawn again each frame inside a 50 ms script budget and a
 * row is a handful of elements, so the whole table (a page of 110 rows) cannot be; the page shows one group at a time,
 * a long group in parts. ponytail: the web scrolls the whole table; a window that draws a long list without rebuilding
 * it each frame (a virtual list) would show it whole. */
export const KEYBOARD_PAGE_ROWS = 20;

/** The Keyboard page's groups cut into pages of at most `KEYBOARD_PAGE_ROWS` rows: `{id, title, groups}` each, where
 * `groups` is what the stock page takes. A group over the size is cut evenly and its parts titled `(1/2)`. */
export function keyboardPages(groups) {
  return groups.flatMap((group) => {
    const parts = Math.max(1, Math.ceil(group.rows.length / KEYBOARD_PAGE_ROWS));
    const size = Math.ceil(group.rows.length / parts);
    return Array.from({ length: parts }, (_, k) => {
      const title = parts > 1 ? `${group.title} (${k + 1}/${parts})` : group.title;
      return { id: `${group.id}${parts > 1 ? `-${k + 1}` : ""}`, title, groups: [{ ...group, title, rows: group.rows.slice(k * size, (k + 1) * size) }] };
    });
  });
}

export function useKeyboardProps() {
  const keyboard = useHostSnapshot((perch) => perch.keyboard());
  const settings = useHostSnapshot((perch) => perch.settings());
  const custom = settings?.keybindings ?? {};
  const saveKeys = (keybindings) => save({ keybindings });
  return {
    groups: keyboard.groups,
    hasOverrides: keyboard.hasOverrides,
    actions: {
      // The keymap decides what the key becomes (`Keymap::record`: the web's recorder and its conflict rules) and the
      // choices are saved as the core keeps them; the window's keys follow once the core says so.
      record: (id, event) => {
        const recorded = host().recordKey(id, event);
        if (!recorded) return null;
        if (recorded.kind === "error") return { kind: "error", text: recorded.text };
        saveKeys(recorded.keybindings);
        return { kind: "saved", ...(recorded.note ? { note: recorded.note } : {}) };
      },
      clear: (id) => saveKeys({ ...custom, [id]: "" }),
      reset: (id) => {
        const next = { ...custom };
        delete next[id];
        saveKeys(next);
      },
      resetAll: () => saveKeys({}),
    },
  };
}

// ---- Notifications ----------------------------------------------------------------------------------------------------

export function useNotificationsProps() {
  const { settings, updateSettings } = useSettings();
  const [models] = useAsked("agent.models.list");
  return {
    settings,
    // The system notification permission is the desktop app's (a window of this client has no notification centre of its
    // own): the page says what it says for a browser, and its permission buttons ask for nothing.
    native: false,
    permission: { permission: "unsupported" },
    pending: false,
    error: null,
    testResult: null,
    models: Object.fromEntries((models?.harnesses ?? []).map((harness) => [harness.id, harness.models])),
    actions: {
      updateSettings,
      setToastDelivery: (delivery) => updateSettings({ toastDelivery: delivery }),
      notification: () => {},
    },
  };
}

// ---- SSH hosts --------------------------------------------------------------------------------------------------------

export function useHostsProps() {
  const entries = useHostSnapshot((perch) => perch.hostEntries());
  const [names] = useAsked("machine.hosts");
  const [pending, setPending] = useState(null);
  const [result, setResult] = useState(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const look = (install, sshHost, onCore) => {
    setPending(install ? "install" : "check");
    setResult(null);
    ask(install ? "machine.install" : "machine.probe", { sshHost: sshHost.trim() }).then((got) => {
      if (!mounted.current) return;
      setPending(null);
      if (refused(got)) {
        setResult({ sshHost: sshHost.trim(), error: { kind: "failed", message: got?.error ?? "Perch did not answer.", hint: "Check the connection to Perch and try again." } });
        return;
      }
      setResult({ sshHost: got.sshHost, probe: got.probe, installedPath: got.installedPath, error: got.error, loginArgv: got.loginArgv });
      if (got.probe?.coreVersion) onCore?.();
    });
  };
  return {
    hosts: entries.hosts, hostStates: entries.hostStates,
    machine: { sshConfigHosts: names?.hosts ?? [], pending, result },
    actions: {
      addHost: (form) => {
        const name = form.name.trim();
        const sshHost = form.sshHost.trim();
        if (!name || !sshHost) return false;
        const port = parseInt(form.port, 10);
        const directUrl = form.directUrl.trim() || undefined;
        const remoteCmd = form.remoteCmd.trim() || undefined;
        return host().send("hosts.upsert", {
          host: {
            id: newId(), name, sshHost, remotePort: Number.isFinite(port) ? port : 7788, enabled: true, mode: form.mode,
            ...(directUrl ? { directUrl } : {}), ...(remoteCmd ? { remoteCmd } : {}),
          },
        });
      },
      upsertHost: (entry) => { host().send("hosts.upsert", { host: { ...entry, mode: entry.mode ?? "perch" } }); },
      deleteHost: (id) => { host().send("hosts.delete", { id }); },
      checkMachine: (sshHost, onCore) => look(false, sshHost, onCore),
      installCore: (sshHost, onCore) => look(true, sshHost, onCore),
      // The web opens a terminal tab running ssh so the person can log in; that tab is the desktop app's to open.
      logIn: () => { host().command("handoff.open", { place: "settings" }); },
    },
  };
}

// ---- Devices ----------------------------------------------------------------------------------------------------------

/** What the pairing QR carries (`PhoneAccess.tsx`): the address plus the code, in the #hash. */
export const pairLink = (address, code) => `${address}${address.includes("#") ? "&" : "#"}pair=${code}`;

export function useDevicesProps() {
  const { settings, updateSettings } = useSettings();
  // The core pushes a status when phone access changes; this window asks again when the setting does.
  const [phone, reloadPhone] = useAsked("phone.access.get", {}, true);
  const [listed, , setListed] = useAsked("device.list");
  const [pairing, setPairing] = useState(null);
  useEffect(() => { void reloadPhone(); }, [settings?.phoneAccess, settings?.relayUrl, reloadPhone]);
  // While Tailscale is being set up, look again so its address appears on its own.
  const waiting = !!phone?.enabled && !!phone.tailscale && phone.tailscale !== "running";
  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setInterval(() => { void reloadPhone(); }, 5000);
    return () => clearInterval(timer);
  }, [waiting, reloadPhone]);
  // A code that has run out is gone.
  useEffect(() => {
    if (!pairing) return undefined;
    const timer = setTimeout(() => setPairing(null), Math.max(0, pairing.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [pairing]);
  const take = (answer) => { if (answer && Array.isArray(answer.devices)) setListed(answer); };
  return {
    settings, isMobile: false, phone, devices: listed?.devices ?? [], pairing,
    actions: {
      updateSettings,
      pairStart: () => { ask("device.pair.start").then((got) => { if (got?.code) setPairing({ code: got.code, expiresAt: Date.now() + got.expiresInMs }); }); },
      pairCancel: () => { setPairing(null); ask("device.pair.cancel").then(take); },
      revoke: (deviceId) => { ask("device.revoke", { deviceId }).then(take); },
      pairLink,
      openExternal: (url) => { host().command("link.open", { url }); },
    },
  };
}

// ---- Agents -----------------------------------------------------------------------------------------------------------

export function useAgentsProps() {
  const entries = useHostSnapshot((perch) => perch.hostEntries());
  const connected = useHostSnapshot((perch) => perch.statusLine().connected);
  const [hostId, setHostId] = useState("local");
  const configurable = useHostSnapshot((perch) => perch.coreCan("agent.provider.configure", hostId));
  const discoverable = useHostSnapshot((perch) => perch.coreCan("agent.manifest.list", hostId));
  const [state, setState] = useState({ state: "idle" });
  const [manifests, setManifests] = useState([]);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const fetchList = useCallback((update) => {
    if (!connected || !discoverable) return;
    setState((was) => ({ ...was, state: "loading", error: undefined }));
    const asking = update ? ask("agent.provider.configure", { hostId, providerId: update.providerId, enabled: update.enabled ?? null, isDefault: update.isDefault ?? null }) : ask("agent.manifest.list", { hostId });
    asking.then((got) => {
      if (!mounted.current) return;
      if (refused(got)) setState({ state: "error", error: got?.error ?? "Perch did not answer." });
      else { setManifests(got.manifests ?? []); setState({ state: "ready" }); }
    });
  }, [hostId, connected, discoverable]);
  useEffect(() => { setManifests([]); fetchList(); }, [fetchList]);
  // Only agents that start in a terminal are listed here.
  const agents = manifests.filter((entry) => entry.supportedModes.includes("cli") && entry.capabilities.includes("interactiveTerminal"));
  return {
    connected, hostId, configurable, discoverable, agents,
    hosts: entries.hosts.map((entry) => ({ id: entry.id, name: entry.name })),
    hostName: hostId === "local" ? "this host" : entries.hosts.find((entry) => entry.id === hostId)?.name ?? hostId,
    catalog: state,
    actions: {
      selectHost: setHostId,
      refresh: () => fetchList(),
      setEnabled: (providerId, enabled) => fetchList({ providerId, enabled }),
      setDefault: (providerId) => fetchList({ providerId, isDefault: true }),
      openExternal: (url) => { host().command("link.open", { url }); },
    },
  };
}
