import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "@perch/shared";
import type { AgentRunner } from "./agentRunner.js";
import { ClaudeRunner } from "./claudeRunner.js";
import type { HistoryDb } from "./db.js";
import type { SessionRegistry } from "./sessionRegistry.js";
import { getStatus, type LastUsage } from "./status.js";
import { TerminalManager } from "./terminalManager.js";

export interface WsHandlerDeps {
  registry: SessionRegistry;
  db: HistoryDb;
  defaultCwd: string;
}

interface SessionRuntime {
  cwd: string;
  runner: AgentRunner;
  lastUsage: LastUsage;
}

/**
 * Builds the per-connection message handler: routes each `ClientMessage` to
 * the agent runner, terminal manager, or session registry, and streams the
 * resulting `ServerMessage`s back over the socket. One `TerminalManager` and
 * one map of chat `SessionRuntime`s is created per connection; chat sessions
 * created via `session.create` live in this closure for the life of the
 * socket (they are not currently shared across connections).
 */
export function createWsHandler(deps: WsHandlerDeps) {
  return function handleConnection(ws: WebSocket): void {
    const runtimes = new Map<string, SessionRuntime>();

    const terminals = new TerminalManager(
      (terminalId, data) => send(ws, { type: "terminal.data", terminalId, data }),
      (terminalId, code) => send(ws, { type: "terminal.exit", terminalId, code }),
    );

    send(ws, { type: "status.update", ...getStatus(deps.defaultCwd) });

    ws.on("message", (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientMessage;
      } catch {
        send(ws, { type: "error", message: "invalid JSON" });
        return;
      }
      handleMessage(msg).catch((err: unknown) => {
        send(ws, { type: "error", message: err instanceof Error ? err.message : String(err) });
      });
    });

    ws.on("close", () => {
      terminals.disposeAll();
      for (const runtime of runtimes.values()) runtime.runner.cancel();
    });

    async function handleMessage(msg: ClientMessage): Promise<void> {
      switch (msg.type) {
        case "session.create": {
          const sessionId = randomUUID();
          const cwd = msg.cwd ?? deps.defaultCwd;
          deps.registry.create(sessionId, cwd);
          deps.db.createSession(sessionId, cwd);
          runtimes.set(sessionId, { cwd, runner: new ClaudeRunner({ cwd }), lastUsage: {} });
          send(ws, { type: "session.created", sessionId });
          send(ws, { type: "status.update", ...getStatus(cwd) });
          return;
        }
        case "session.subscribe": {
          for (const event of deps.registry.replay(msg.sessionId)) send(ws, event);
          return;
        }
        case "chat.send": {
          const runtime = runtimes.get(msg.sessionId);
          if (!runtime) {
            send(ws, { type: "error", message: `unknown session ${msg.sessionId}` });
            return;
          }
          deps.db.addMessage(msg.sessionId, "user", msg.text);
          const sessionId = msg.sessionId;
          await runtime.runner.send(msg.text, {
            onChunk: (text) => emit(sessionId, { type: "chat.chunk", sessionId, text }),
            onThinking: (text) => emit(sessionId, { type: "chat.thinking", sessionId, text }),
            onToolUse: (name, input) => emit(sessionId, { type: "chat.tool_use", sessionId, name, input }),
            onToolResult: (name, result) => emit(sessionId, { type: "chat.tool_result", sessionId, name, result }),
            onDone: (usage) => {
              if (usage) runtime.lastUsage = { contextTokens: usage.contextTokens, costUsd: usage.costUsd };
              emit(sessionId, { type: "chat.done", sessionId, usage });
              emit(sessionId, { type: "status.update", ...getStatus(runtime.cwd, runtime.lastUsage) });
            },
            onError: (message) => emit(sessionId, { type: "error", message }),
          });
          return;
        }
        case "chat.cancel": {
          runtimes.get(msg.sessionId)?.runner.cancel();
          return;
        }
        case "terminal.create": {
          const terminalId = terminals.create(msg.cols, msg.rows, msg.cwd ?? deps.defaultCwd);
          send(ws, { type: "terminal.created", terminalId });
          return;
        }
        case "terminal.input": {
          terminals.input(msg.terminalId, msg.data);
          return;
        }
        case "terminal.resize": {
          terminals.resize(msg.terminalId, msg.cols, msg.rows);
          return;
        }
      }
    }

    function emit(sessionId: string, event: ServerMessage): void {
      deps.registry.record(sessionId, event);
      send(ws, event);
    }
  };
}

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
