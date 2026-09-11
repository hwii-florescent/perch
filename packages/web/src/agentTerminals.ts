import type { AgentControlChannel, AgentControlLease, AgentLifecycleStatus, ClientMessage, ServerMessage } from "@perch/shared";
import { socket } from "./ws";
import { onTerminalData } from "./terminalBus";

type Reply = Extract<ServerMessage, { type: "agent.terminal.opened" | "agent.control" }>;
interface Pending {
  accept: (message: Reply) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  releaseLate?: () => void;
}
interface View {
  status: AgentLifecycleStatus;
  leases: Partial<Record<AgentControlChannel, AgentControlLease>>;
  listeners: Map<string, (status: AgentLifecycleStatus, controlling: boolean) => void>;
}
const pending = new Map<string, Pending>();
const retired = new Map<string, (() => void) | undefined>();
const views = new Map<string, View>();

function retire(id: string, releaseLate?: () => void) {
  retired.set(id, releaseLate);
  if (retired.size > 128) retired.delete(retired.keys().next().value!);
}
function request(message: ClientMessage & { requestId: string }, accept: (reply: Reply) => void, releaseLate?: () => void): Promise<void> {
  if (pending.size >= 64) return Promise.reject(new Error("Too many agent requests. Try again shortly."));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(message.requestId);
      retire(message.requestId, releaseLate);
      releaseLate?.();
      reject(new Error("Agent request timed out. Reconnect to check its state."));
    }, 15_000);
    pending.set(message.requestId, { timer, reject, releaseLate, accept: (reply) => {
      try { accept(reply); resolve(); } catch (error) { reject(error); }
    } });
    socket.send(message);
  });
}
function notify(view: View) {
  for (const listener of view.listeners.values()) listener(view.status, !!view.leases.input);
}

/** Dispatch before generic chat errors; attach installs the data listener in
 * this same message turn, before any following live terminal frame. */
export function handleAgentTerminalMessage(message: ServerMessage): boolean {
  if (message.type === "agent.lifecycle.changed") {
    if (message.hostId !== "local") return false;
    for (const view of views.values()) {
      const key = view.status.key;
      if (key.workspaceId !== message.status.key.workspaceId || key.sessionId !== message.status.key.sessionId || key.agentId !== message.status.key.agentId || view.status.revision > message.status.revision) continue;
      view.status = message.status;
      if (view.leases.input?.generation !== message.status.inputOwner?.generation) delete view.leases.input;
      if (view.leases.resize?.generation !== message.status.resizeOwner?.generation) delete view.leases.resize;
      notify(view);
    }
    return true;
  }
  if (!("requestId" in message) || !message.requestId) return false;
  const item = pending.get(message.requestId);
  if (!item) {
    if (message.type === "agent.terminal.opened") retired.get(message.requestId)?.();
    return retired.has(message.requestId);
  }
  if (message.type !== "error" && message.type !== "agent.terminal.opened" && message.type !== "agent.control") return false;
  pending.delete(message.requestId);
  clearTimeout(item.timer);
  retire(message.requestId, item.releaseLate);
  if (message.type === "error") item.reject(new Error(message.message));
  else item.accept(message);
  return true;
}

socket.onConnectionChange((connected) => {
  if (connected) return;
  for (const [id, item] of pending) {
    clearTimeout(item.timer);
    retire(id, item.releaseLate);
    item.reject(new Error("Connection lost. The agent will reconnect when the host returns."));
  }
  pending.clear();
  views.clear();
});

export function sendAgentTerminalInput(terminalId: string, data: string): boolean {
  const view = views.get(terminalId);
  if (!view) return false;
  if (view.leases.input) socket.send({ type: "terminal.input", terminalId, data, generation: view.leases.input.generation });
  return true;
}
export function resizeAgentTerminal(terminalId: string, cols: number, rows: number): boolean {
  const view = views.get(terminalId);
  if (!view) return false;
  if (view.leases.resize) socket.send({ type: "terminal.resize", terminalId, cols, rows, generation: view.leases.resize.generation });
  return true;
}

export function openAgentTerminal(
  sessionId: string, providerId: string, cols: number, rows: number,
  onReady: (terminalId: string, status: AgentLifecycleStatus, replay: string) => void,
  onData: (data: string) => void,
  onStatus: (status: AgentLifecycleStatus, controlling: boolean) => void,
) {
  const viewId = crypto.randomUUID();
  let terminalId: string | undefined;
  let unsubscribe: (() => void) | undefined;
  let released = false;
  const releaseRemote = () => socket.send({ type: "agent.terminal.release", sessionId, providerId, viewId });
  const release = () => {
    released = true;
    unsubscribe?.();
    releaseRemote();
    if (terminalId) {
      const view = views.get(terminalId);
      view?.listeners.delete(viewId);
      if (!view?.listeners.size) views.delete(terminalId);
    }
  };
  async function control(channel: AgentControlChannel, acquire: boolean) {
    if (released || !terminalId) return;
    const view = views.get(terminalId);
    if (!view) return;
    const lease = view.leases[channel];
    if (!acquire && !lease) return;
    await request({
      ...(acquire ? { type: "agent.control.acquire" as const } : { type: "agent.control.release" as const, generation: lease!.generation }),
      requestId: crypto.randomUUID(), sessionId, agentId: providerId, workspaceId: view.status.key.workspaceId, channel,
    }, (reply) => {
      if (reply.type !== "agent.control" || reply.sessionId !== sessionId || reply.agentId !== providerId || reply.channel !== channel) throw new Error("Unexpected agent control response");
      // A released view cannot reclaim a lease after its response arrives.
      if (released) { releaseRemote(); return; }
      if (reply.status && reply.status.revision >= view.status.revision) view.status = reply.status;
      if (reply.lease) view.leases[channel] = reply.lease;
      else delete view.leases[channel];
      notify(view);
    });
  }
  const ready = request({ type: "agent.terminal.open", requestId: viewId, viewId, sessionId, providerId, cols, rows }, (reply) => {
    if (reply.type !== "agent.terminal.opened" || reply.status.key.sessionId !== sessionId || reply.status.providerId !== providerId) throw new Error("Unexpected agent terminal response");
    terminalId = reply.terminalId;
    if (released) { releaseRemote(); return; }
    const view = views.get(terminalId) ?? { status: reply.status, leases: {}, listeners: new Map() };
    view.status = reply.status;
    view.listeners.set(viewId, onStatus);
    views.set(terminalId, view);
    unsubscribe = onTerminalData(terminalId, onData);
    onReady(terminalId, reply.status, reply.replay);
    notify(view);
  }, releaseRemote);
  return {
    ready, release,
    takeControl: async () => { await control("input", true); await control("resize", true); },
    releaseControl: async () => { await control("resize", false); await control("input", false); },
    stop: () => { if (terminalId && views.get(terminalId)?.leases.input) socket.send({ type: "terminal.kill", terminalId }); },
  };
}
