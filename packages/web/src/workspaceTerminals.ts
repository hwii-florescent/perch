import type { ClientMessage, ServerMessage, WorkspaceTerminal } from "@perch/shared";
import { socket } from "./ws";
import { onTerminalData } from "./terminalBus";

type Reply = Extract<ServerMessage, { type: "terminal.opened" | "terminal.list.result" | "terminal.closed" }>;
interface Pending {
  accept: (reply: Reply) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}
const pending = new Map<string, Pending>();
const retired = new Set<string>();

function request(message: ClientMessage & { requestId: string }, accept: (reply: Reply) => void): Promise<void> {
  if (pending.size >= 64) return Promise.reject(new Error("Too many terminal requests. Try again shortly."));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(message.requestId);
      retire(message.requestId);
      reject(new Error("Terminal request timed out. Reconnect to check its state."));
    }, 15_000);
    pending.set(message.requestId, {
      timer, reject,
      accept: (reply) => { try { accept(reply); resolve(); } catch (error) { reject(error); } },
    });
    socket.send(message);
  });
}

function retire(id: string) {
  retired.add(id);
  if (retired.size > 128) retired.delete(retired.values().next().value!);
}

/** Called before the generic chat error handler, so terminal errors stay in their pane. */
export function handleWorkspaceTerminalMessage(message: ServerMessage): boolean {
  if (!("requestId" in message) || !message.requestId) return false;
  const item = pending.get(message.requestId);
  if (!item) {
    if (retired.has(message.requestId) && message.type === "terminal.opened") {
      socket.send({ type: "terminal.release", terminalId: message.terminal.id, viewId: message.requestId });
    }
    return retired.has(message.requestId);
  }
  if (message.type !== "error" && message.type !== "terminal.opened" && message.type !== "terminal.list.result" && message.type !== "terminal.closed") return false;
  clearTimeout(item.timer);
  pending.delete(message.requestId);
  retire(message.requestId);
  if (message.type === "error") item.reject(new Error(message.message));
  else item.accept(message);
  return true;
}

socket.onConnectionChange((connected) => {
  if (connected) return;
  for (const [id, item] of pending) {
    clearTimeout(item.timer);
    retire(id);
    item.reject(new Error("Connection lost. The shell will reconnect when the host returns."));
  }
  pending.clear();
});

export async function listWorkspaceTerminals(sessionId: string): Promise<WorkspaceTerminal[]> {
  let terminals: WorkspaceTerminal[] = [];
  await request({ type: "terminal.list", requestId: crypto.randomUUID(), sessionId }, (reply) => {
    if (reply.type !== "terminal.list.result" || reply.sessionId !== sessionId) throw new Error("Unexpected terminal list response");
    terminals = reply.terminals;
  });
  return terminals;
}

export function openWorkspaceTerminal(
  sessionId: string, paneId: string, cols: number, rows: number,
  onReady: (terminal: WorkspaceTerminal, replay: string) => void, onData: (data: string) => void,
): { ready: Promise<void>; release: () => void } {
  const viewId = crypto.randomUUID();
  let terminalId: string | null = null;
  let unsubscribe: (() => void) | undefined;
  let released = false;
  const release = () => {
    released = true;
    unsubscribe?.();
    if (terminalId) socket.send({ type: "terminal.release", terminalId, viewId });
  };
  const ready = request({ type: "terminal.open", requestId: viewId, sessionId, paneId, viewId, cols, rows }, (reply) => {
    if (reply.type !== "terminal.opened" || reply.terminal.sessionId !== sessionId || reply.terminal.paneId !== paneId) throw new Error("Unexpected terminal response");
    terminalId = reply.terminal.id;
    if (released) { release(); return; }
    // Install synchronously inside the WS handler, before live bytes following
    // the opened reply can arrive. Promise/effect scheduling would lose output.
    unsubscribe = onTerminalData(terminalId, onData);
    onReady(reply.terminal, reply.replay);
  });
  return { ready, release };
}

export function closeWorkspaceTerminal(sessionId: string, terminalId: string): Promise<void> {
  return request({ type: "terminal.close", requestId: crypto.randomUUID(), sessionId, terminalId }, (reply) => {
    if (reply.type !== "terminal.closed" || reply.sessionId !== sessionId || reply.terminalId !== terminalId) throw new Error("Unexpected terminal close response");
  });
}
