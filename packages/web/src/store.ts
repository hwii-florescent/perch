import { create } from "zustand";
import type { AgentAttach, AgentKind, ChatUsage, ServerMessage } from "@perch/shared";
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
   * the existing PTY instead of spawning a new one. Keyed by sessionId. */
  cliTerminalIds: Record<string, string>;
  agent: AgentKind;
  model: string;

  sendChat: (text: string) => void;
  cancelChat: () => void;
  setAgent: (agent: AgentKind) => void;
  setModel: (model: string) => void;
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
  model: defaultModel("claude"),

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
    set({ agent, model: defaultModel(agent) });
  },

  setModel: (model) => {
    set({ model });
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
    if (existing) return Promise.resolve(existing);
    return get()
      .createTerminal(80, 24, { agentAttach: { sessionId, agent } })
      .then((id) => {
        set((state) => ({ cliTerminalIds: { ...state.cliTerminalIds, [sessionId]: id } }));
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
      updateStreamingMessage((m) => ({ ...m, text: m.text + msg.text }));
      break;
    }
    case "chat.thinking": {
      updateStreamingMessage((m) => ({ ...m, thinking: m.thinking + msg.text }));
      break;
    }
    case "chat.tool_use": {
      updateStreamingMessage((m) => ({
        ...m,
        tools: [...m.tools, { name: msg.name, input: msg.input, done: false }],
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
      updateStreamingMessage((m) => ({ ...m, streaming: false, usage: msg.usage }));
      usePerchStore.setState({ streamingMessageId: null });
      break;
    }
    case "error": {
      const { streamingMessageId } = usePerchStore.getState();
      if (streamingMessageId) {
        updateStreamingMessage((m) => ({ ...m, streaming: false, error: msg.message }));
        usePerchStore.setState({ streamingMessageId: null });
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
  }
}

socket.onMessage(handleServerMessage);
socket.onConnectionChange((connected) => {
  // Dropping the transport also invalidates the session; a fresh
  // session.create/subscribe handshake runs on reconnect (see ws.ts).
  usePerchStore.setState(connected ? { connected } : { connected, sessionId: null });
});
socket.connect();
