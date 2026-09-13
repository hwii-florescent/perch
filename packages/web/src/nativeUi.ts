import type { ClientMessage, NativeUiSnapshot, ServerMessage } from "@perch/shared";
import { socket } from "./ws";

type Reply = Extract<ServerMessage, { type: "agent.ui.snapshot" | "agent.ui.result" }>;
type Request = Extract<ClientMessage, { type: "agent.ui.get" | "agent.ui.prompt" | "agent.ui.cancel" }>;
const listeners = new Map<string, Set<(snapshot: NativeUiSnapshot) => void>>();
const pending = new Map<string, { request: Request; resolve: (reply: Reply) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
const retired = new Set<string>();
const key = (session: string, provider: string) => JSON.stringify([session, provider]);
function retire(id: string) {
  retired.add(id);
  if (retired.size > 128) retired.delete(retired.values().next().value!);
}
export function subscribeNativeUi(session: string, provider: string, listener: (snapshot: NativeUiSnapshot) => void) {
  const id = key(session, provider);
  const set = listeners.get(id) ?? new Set();
  set.add(listener); listeners.set(id, set);
  return () => { set.delete(listener); if (!set.size) listeners.delete(id); };
}
export function requestNativeUi(request: Request): Promise<Reply> {
  if (pending.size >= 32) return Promise.reject(new Error("Too many pending actions. Wait for the CLI to respond."));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(request.requestId); retire(request.requestId);
      reject(new Error("The CLI has not confirmed this action. Reconnect to inspect the conversation before sending again."));
    }, 15_000);
    pending.set(request.requestId, { request, resolve, reject, timer });
    socket.send(request);
  });
}
export function handleNativeUiMessage(message: ServerMessage): boolean {
  const id = "requestId" in message ? message.requestId : undefined;
  const item = id ? pending.get(id) : undefined;
  if (message.type !== "agent.ui.snapshot" && message.type !== "agent.ui.result" && !(message.type === "error" && (item || (id && retired.has(id))))) return false;
  if (item && id) {
    pending.delete(id); retire(id); clearTimeout(item.timer);
    if (message.type === "error") item.reject(new Error(message.message));
    else if (message.sessionId !== item.request.sessionId || (message.type === "agent.ui.snapshot" && message.providerId !== item.request.providerId)) item.reject(new Error("Unexpected native CLI response"));
    else item.resolve(message);
  }
  if (message.type === "agent.ui.snapshot") {
    for (const listener of listeners.get(key(message.sessionId, message.providerId)) ?? []) listener(message.snapshot);
  }
  return true;
}
socket.onConnectionChange((connected) => {
  if (connected) return;
  for (const [id, item] of pending) {
    clearTimeout(item.timer); retire(id);
    item.reject(new Error("Connection lost. Reconnect to inspect the CLI's conversation."));
  }
  pending.clear();
});
