import { create } from "zustand";
import type { AgentAttach, AgentKind, ChatUsage, ModelEntry, ServerMessage, SessionSummary, SettingsData, SettingsPatch, SshHostEntry, HostInfoMessage } from "@perch/shared";
import { socket } from "./ws";
import { emitTerminalData } from "./terminalBus";
import { defaultModel } from "./models";

export interface ToolCallEntry {
  name: string;
  input?: unknown;
  result?: unknown;
  done: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  thinking: string;
  tools: ToolCallEntry[];
  streaming: boolean;
  error?: string;
  usage?: ChatUsage;
  /** Which backend answered this message — stamped at send time so the UI
   * can label a reply even though the wire protocol doesn't echo it back. */
  agent?: AgentKind;
  model?: string;
  /** Unix ms when the first streaming chunk/thinking/tool_use arrived for
   * this assistant message. Used to compute the "Worked for Xs" display. */
  turnStartedAt?: number;
  /** Wall-clock seconds the turn took, set on chat.done. */
  elapsedSec?: number;
}

export interface TerminalMeta {
  id: string;
  cols: number;
  rows: number;
  exitCode: number | null;
}

export interface StatusInfo {
  cwd: string;
  branch: string;
  contextTokens?: number;
  costUsd?: number;
}

interface PendingTerminal {
  cols: number;
  rows: number;
  resolve: (id: string) => void;
}

interface PerchState {
  connected: boolean;
  sessionId: string | null;
  status: StatusInfo | null;
  messages: ChatMessage[];
  streamingMessageId: string | null;
  terminals: Record<string, TerminalMeta>;
  /** Per-session CLI terminal id, so toggling back into CLI mode reattaches
   * the existing PTY instead of spawning a new one. Keyed by sessionId.
   * Evicted when the cached terminal's exitCode is non-null (dead PTY), so
   * the next attach spawns a fresh one. */
  cliTerminalIds: Record<string, string>;
  agent: AgentKind;
  model: string;
  /** Server-discovered model lists, keyed by agent. Populated from server.info
   * on connect; empty arrays until the first server.info arrives. Clients must
   * not maintain their own hardcoded lists — different machines expose different
   * model sets depending on which CLI versions are installed. */
  availableModels: Record<AgentKind, ModelEntry[]>;
  /** All sessions known to the server, refreshed via session.list pushes. */
  sessions: SessionSummary[];
  /** Host info sent once per connection by the server after WS handshake. */
  serverInfo: { hostname: string; isSsh: boolean; platform: string } | null;
  /** Set while a CLI PTY is being attached for a given session, cleared on
   * success or error. Used to route ServerMessage::Error to cliError instead
   * of the chat message list when the error arrives during attach. */
  attachingCliForSession: string | null;
  /** Last error surfaced from a CLI attach attempt. Rendered as an overlay
   * inside AgentCliTerminal instead of the hidden chat list. Cleared on
   * successful attach, mode switch away from CLI, and session switch. */
  cliError: string | null;
  /** Controls whether the settings panel is open. Stage D renders the modal;
   * Stage C only wires up the open action from the sidebar gear button. */
  settingsOpen: boolean;
  /** Current settings from the server, populated after fetchSettings(). */
  settings: SettingsData | null;
  /** Current SSH hosts from the server, populated after fetchHosts(). */
  hosts: SshHostEntry[];
  /** Live connection state for each hub host, keyed by hostId. Populated
   * from `host.info` messages pushed by the server. */
  hostStates: Record<string, HostInfoMessage>;
  /** Model lists for each hub host, keyed by hostId.  "local" is seeded
   * from `server.info` on connect; remote hosts are seeded from the
   * `claudeModels`/`codexModels` fields of their `host.info` message. */
  hostModels: Record<string, { claude: ModelEntry[]; codex: ModelEntry[] }>;
  /** Which host the currently-active session belongs to.  "local" until a
   * remote session is switched to or created.  Updated by switchSession and
   * session.history (via the session's hostId). */
  activeHostId: string;

  sendChat: (text: string) => void;
  cancelChat: () => void;
  setAgent: (agent: AgentKind) => void;
  setModel: (model: string) => void;
  /** Ask the server for a fresh session list push. */
  listSessions: () => void;
  /** Create a brand-new session (clears local message/streaming state so
   * the UI is ready for the incoming session.created + session.history). */
  createSession: () => void;
  /** Switch to an existing session by id. No-op if already the active one. */
  switchSession: (sessionId: string) => void;
  /** Open/close the settings panel. Stage D renders content; Stage C wires
   * up the open trigger from the sidebar gear icon. */
  setSettingsOpen: (open: boolean) => void;
  /** Fetch current settings from the server. */
  fetchSettings: () => void;
  /** Apply a settings patch on the server. */
  updateSettings: (patch: SettingsPatch) => void;
  /** Fetch the SSH hosts list from the server. */
  fetchHosts: () => void;
  /** Upsert (create or update) an SSH host. */
  upsertHost: (host: SshHostEntry) => void;
  /** Delete an SSH host by id. */
  deleteHost: (id: string) => void;
  /** Create a new session on a specific hub host.  Passes hostId in the
   * session.create message; "local" omits the field (backward-compatible). */
  createSessionOnHost: (hostId: string) => void;
  createTerminal: (
    cols: number,
    rows: number,
    options?: { cwd?: string; agentAttach?: AgentAttach },
  ) => Promise<string>;
  attachAgentCli: (sessionId: string, agent: AgentKind) => Promise<string>;
  sendTerminalInput: (terminalId: string, data: string) => void;
  resizeTerminal: (terminalId: string, cols: number, rows: number) => void;
}

const pendingTerminals: PendingTerminal[] = [];

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const usePerchStore = create<PerchState>((set, get) => ({
  connected: false,
  sessionId: null,
  status: null,
  messages: [],
  streamingMessageId: null,
  terminals: {},
  cliTerminalIds: {},
  agent: "claude",
  model: "",
  availableModels: { claude: [], codex: [] },
  sessions: [],
  serverInfo: null,
  attachingCliForSession: null,
  cliError: null,
  settingsOpen: false,
  settings: null,
  hosts: [],
  hostStates: {},
  hostModels: { local: { claude: [], codex: [] } },
  activeHostId: "local",

  sendChat: (text) => {
    const { sessionId, agent, model } = get();
    if (!sessionId || !text.trim()) return;
    const userMessage: ChatMessage = {
      id: newId(),
      role: "user",
      text,
      thinking: "",
      tools: [],
      streaming: false,
    };
    const assistantMessage: ChatMessage = {
      id: newId(),
      role: "assistant",
      text: "",
      thinking: "",
      tools: [],
      streaming: true,
      agent,
      model,
    };
    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      streamingMessageId: assistantMessage.id,
    }));
    socket.send({ type: "chat.send", sessionId, text, agent, model });
  },

  cancelChat: () => {
    const { sessionId } = get();
    if (!sessionId) return;
    socket.send({ type: "chat.cancel", sessionId });
  },

  setAgent: (agent) => {
    const state = get();
    // Prefer the active host's model list; fall back to server.info-derived list.
    const hostModelEntry = state.hostModels[state.activeHostId];
    const available = (hostModelEntry ? hostModelEntry[agent] : undefined) ?? state.availableModels[agent];
    set({ agent, model: defaultModel(agent, available) });
  },

  setModel: (model) => {
    set({ model });
  },

  listSessions: () => {
    socket.send({ type: "session.list" });
  },

  createSession: () => {
    // Clear local UI state so the view is blank while we wait for the
    // server's session.created + session.history pair to arrive.
    set({ messages: [], streamingMessageId: null });
    socket.newSession();
  },

  switchSession: (sessionId) => {
    if (get().sessionId === sessionId) return;
    // Look up last agent/model from the sessions list and update the dropdowns
    // so they reflect the session being switched to, not the one left behind.
    const s = get().sessions.find((s) => s.id === sessionId);
    const newAgent: AgentKind = (s?.lastAgent as AgentKind | undefined) ?? "claude";
    const newHostId = s?.hostId ?? "local";
    // Use the active host's model list for reconciliation; fall back to
    // local availableModels when the host has no model info yet.
    const hostModelEntry = get().hostModels[newHostId];
    const available = hostModelEntry?.[newAgent] ?? get().availableModels[newAgent];
    const newModel = s?.lastModel ?? defaultModel(newAgent, available);
    set({ messages: [], streamingMessageId: null, agent: newAgent, model: newModel, cliError: null, activeHostId: newHostId });
    socket.switchSession(sessionId);
  },

  setSettingsOpen: (open) => {
    set({ settingsOpen: open });
  },

  fetchSettings: () => {
    socket.send({ type: "settings.get" });
  },

  updateSettings: (patch) => {
    socket.send({ type: "settings.update", patch });
  },

  fetchHosts: () => {
    socket.send({ type: "hosts.list" });
  },

  upsertHost: (host) => {
    socket.send({ type: "hosts.upsert", host });
  },

  deleteHost: (id) => {
    socket.send({ type: "hosts.delete", id });
  },

  createSessionOnHost: (hostId) => {
    // Clear local UI state so the view is blank while waiting for
    // session.created + session.history.
    set({ messages: [], streamingMessageId: null, activeHostId: hostId });
    if (hostId === "local") {
      socket.newSession();
    } else {
      // Clear the stored sessionId so a mid-flight reconnect doesn't try
      // to resume the old session before session.created arrives.
      try { localStorage.removeItem("perch.sessionId"); } catch { /* ignore */ }
      socket.send({ type: "session.create", hostId });
    }
  },

  createTerminal: (cols, rows, options) => {
    return new Promise<string>((resolve) => {
      pendingTerminals.push({ cols, rows, resolve });
      socket.send({
        type: "terminal.create",
        cols,
        rows,
        cwd: options?.cwd,
        agentAttach: options?.agentAttach,
      });
    });
  },

  attachAgentCli: (sessionId, agent) => {
    const existing = get().cliTerminalIds[sessionId];
    // Evict stale cache entry if the cached terminal has already exited, so we
    // fall through and spawn a fresh PTY instead of reattaching the dead one.
    if (existing) {
      const exitCode = get().terminals[existing]?.exitCode ?? null;
      if (exitCode == null) {
        // Still alive — reattach.
        return Promise.resolve(existing);
      }
      // Dead — remove from cache (and the stale terminals entry) and fall through.
      set((state) => {
        const { [sessionId]: _removed, ...restCli } = state.cliTerminalIds;
        const { [existing]: _dead, ...restTerminals } = state.terminals;
        return { cliTerminalIds: restCli, terminals: restTerminals };
      });
    }
    set({ attachingCliForSession: sessionId, cliError: null });
    return get()
      .createTerminal(80, 24, { agentAttach: { sessionId, agent } })
      .then((id) => {
        set((state) => ({
          cliTerminalIds: { ...state.cliTerminalIds, [sessionId]: id },
          attachingCliForSession: null,
        }));
        return id;
      });
  },

  sendTerminalInput: (terminalId, data) => {
    socket.send({ type: "terminal.input", terminalId, data });
  },

  resizeTerminal: (terminalId, cols, rows) => {
    socket.send({ type: "terminal.resize", terminalId, cols, rows });
    set((state) => {
      const existing = state.terminals[terminalId];
      if (!existing) return state;
      return {
        terminals: { ...state.terminals, [terminalId]: { ...existing, cols, rows } },
      };
    });
  },
}));

/** Immutably patch the currently-streaming assistant message, if any. */
function updateStreamingMessage(update: (msg: ChatMessage) => ChatMessage): void {
  const { streamingMessageId, messages } = usePerchStore.getState();
  if (!streamingMessageId) return;
  usePerchStore.setState({
    messages: messages.map((m) => (m.id === streamingMessageId ? update(m) : m)),
  });
}

function handleServerMessage(msg: ServerMessage): void {
  switch (msg.type) {
    case "session.created": {
      usePerchStore.setState({ sessionId: msg.sessionId });
      // Refresh the session list so the sidebar shows the new entry.
      usePerchStore.getState().listSessions();
      break;
    }
    case "session.list": {
      usePerchStore.setState({ sessions: msg.sessions });
      break;
    }
    case "session.updated": {
      usePerchStore.setState((state) => {
        const exists = state.sessions.some((s) => s.id === msg.session.id);
        const sessions = exists
          ? state.sessions.map((s) => (s.id === msg.session.id ? msg.session : s))
          : [msg.session, ...state.sessions];
        return { sessions };
      });
      break;
    }
    case "server.info": {
      const availableModels: Record<AgentKind, ModelEntry[]> = {
        claude: msg.claudeModels,
        codex: msg.codexModels,
      };
      usePerchStore.setState((state) => {
        // Seed hostModels["local"] from server.info so the ModelChip can use
        // the active host's model list when activeHostId is "local".
        const newHostModels = {
          ...state.hostModels,
          local: { claude: msg.claudeModels, codex: msg.codexModels },
        };
        // Reconcile the current model against the newly-arrived list.
        // Only reset if the current model is genuinely absent — don't fight
        // the history-derived model from session.history (which arrives after
        // server.info and is the higher-authority source).
        const currentList = availableModels[state.agent];
        const modelStillValid =
          state.model === "" || currentList.some((m) => m.id === state.model);
        const reconciledModel = modelStillValid
          ? state.model || defaultModel(state.agent, currentList)
          : defaultModel(state.agent, currentList);
        return {
          serverInfo: {
            hostname: msg.hostname,
            isSsh: msg.isSsh,
            platform: msg.platform,
          },
          availableModels,
          hostModels: newHostModels,
          model: reconciledModel,
        };
      });
      break;
    }
    case "session.history": {
      const messages: ChatMessage[] = msg.messages.map((h) => ({
        id: h.id,
        role: h.role,
        text: h.text,
        thinking: h.thinking ?? "",
        tools: [],
        streaming: false,
        agent: h.agent,
        model: h.model,
      }));
      usePerchStore.setState({ messages, streamingMessageId: null });
      // Derive agent/model from the last assistant message in history — this
      // is the most reliable source since it arrives after switchSession's
      // optimistic update (which reads from sessions[] list metadata).
      const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && m.agent);
      if (lastAssistant?.agent) {
        const a = lastAssistant.agent as AgentKind;
        // Use the active host's model list for reconciliation.
        const state = usePerchStore.getState();
        const activeHostId = state.activeHostId;
        const hostModelEntry = state.hostModels[activeHostId];
        const available = hostModelEntry?.[a] ?? state.availableModels[a];
        const m = lastAssistant.model ?? defaultModel(a, available);
        usePerchStore.setState({ agent: a, model: m });
      }
      // Update activeHostId from the session's known hostId if available.
      // session.history carries sessionId; look it up in sessions[].
      const sessionEntry = usePerchStore.getState().sessions.find((s) => s.id === msg.sessionId);
      if (sessionEntry?.hostId) {
        usePerchStore.setState({ activeHostId: sessionEntry.hostId });
      }
      break;
    }
    case "status.update": {
      usePerchStore.setState({
        status: {
          cwd: msg.cwd,
          branch: msg.branch,
          contextTokens: msg.contextTokens,
          costUsd: msg.costUsd,
        },
      });
      break;
    }
    case "chat.chunk": {
      updateStreamingMessage((m) => ({
        ...m,
        text: m.text + msg.text,
        turnStartedAt: m.turnStartedAt ?? Date.now(),
      }));
      break;
    }
    case "chat.thinking": {
      updateStreamingMessage((m) => ({
        ...m,
        thinking: m.thinking + msg.text,
        turnStartedAt: m.turnStartedAt ?? Date.now(),
      }));
      break;
    }
    case "chat.tool_use": {
      updateStreamingMessage((m) => ({
        ...m,
        tools: [...m.tools, { name: msg.name, input: msg.input, done: false }],
        turnStartedAt: m.turnStartedAt ?? Date.now(),
      }));
      break;
    }
    case "chat.tool_result": {
      updateStreamingMessage((m) => {
        const idx = [...m.tools].reverse().findIndex((t) => t.name === msg.name && !t.done);
        if (idx === -1) {
          return { ...m, tools: [...m.tools, { name: msg.name, result: msg.result, done: true }] };
        }
        const realIdx = m.tools.length - 1 - idx;
        const tools = m.tools.slice();
        tools[realIdx] = { ...tools[realIdx], name: msg.name, result: msg.result, done: true };
        return { ...m, tools };
      });
      break;
    }
    case "chat.done": {
      updateStreamingMessage((m) => ({
        ...m,
        streaming: false,
        usage: msg.usage,
        elapsedSec: m.turnStartedAt != null
          ? Math.round((Date.now() - m.turnStartedAt) / 1000)
          : undefined,
      }));
      usePerchStore.setState({ streamingMessageId: null });
      break;
    }
    case "error": {
      const { streamingMessageId, attachingCliForSession } = usePerchStore.getState();
      if (streamingMessageId) {
        updateStreamingMessage((m) => ({ ...m, streaming: false, error: msg.message }));
        usePerchStore.setState({ streamingMessageId: null });
      } else if (attachingCliForSession != null) {
        // Error arrived while a CLI PTY attach was in flight — surface it as
        // the cliError overlay (visible in CLI mode) instead of pushing it
        // into the chat message list which is hidden in CLI mode.
        usePerchStore.setState({ cliError: msg.message, attachingCliForSession: null });
      } else {
        usePerchStore.setState((state) => ({
          messages: [
            ...state.messages,
            {
              id: newId(),
              role: "assistant",
              text: "",
              thinking: "",
              tools: [],
              streaming: false,
              error: msg.message,
            },
          ],
        }));
      }
      break;
    }
    case "terminal.created": {
      const pending = pendingTerminals.shift();
      usePerchStore.setState((state) => ({
        terminals: {
          ...state.terminals,
          [msg.terminalId]: {
            id: msg.terminalId,
            cols: pending?.cols ?? 80,
            rows: pending?.rows ?? 24,
            exitCode: null,
          },
        },
      }));
      pending?.resolve(msg.terminalId);
      break;
    }
    case "terminal.data": {
      // Bypass zustand entirely - see terminalBus.ts.
      emitTerminalData(msg.terminalId, msg.data);
      break;
    }
    case "terminal.exit": {
      usePerchStore.setState((state) => {
        const existing = state.terminals[msg.terminalId];
        if (!existing) return state;
        return {
          terminals: {
            ...state.terminals,
            [msg.terminalId]: { ...existing, exitCode: msg.code },
          },
        };
      });
      break;
    }
    case "settings.current": {
      usePerchStore.setState({ settings: msg.settings });
      break;
    }
    case "hosts.list": {
      usePerchStore.setState({ hosts: msg.hosts });
      break;
    }
    case "hosts.updated": {
      usePerchStore.setState({ hosts: msg.hosts });
      break;
    }
    case "host.info": {
      // Upsert into hostStates.
      usePerchStore.setState((state) => ({
        hostStates: { ...state.hostStates, [msg.hostId]: msg },
      }));
      // When the host transitions to connected and carries model lists,
      // update hostModels so the ModelChip can show the correct list when
      // this host is active.
      if (msg.state === "connected" && (msg.claudeModels || msg.codexModels)) {
        usePerchStore.setState((state) => ({
          hostModels: {
            ...state.hostModels,
            [msg.hostId]: {
              claude: msg.claudeModels ?? state.hostModels[msg.hostId]?.claude ?? [],
              codex: msg.codexModels ?? state.hostModels[msg.hostId]?.codex ?? [],
            },
          },
        }));
      }
      break;
    }
  }
}

socket.onMessage(handleServerMessage);
socket.onConnectionChange((connected) => {
  // Dropping the transport also invalidates the session; a fresh
  // session.create/subscribe handshake runs on reconnect (see ws.ts).
  usePerchStore.setState(connected ? { connected } : { connected, sessionId: null });
});
socket.connect();
