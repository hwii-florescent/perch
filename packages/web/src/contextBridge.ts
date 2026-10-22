import { create } from "zustand";
import type { ContextSource, ContextPreviewResultMessage, ClientMessage, ServerMessage } from "@perch/shared";
import type { Terminal } from "@xterm/xterm";
import { usePerchStore } from "./store";
import { useWorkspaceFilesStore } from "./filesystemStore";
import { socket } from "./ws";

type Capture = { workspaceId: string; source: ContextSource };
type Menu = Capture & { x: number; y: number };
export const useContextBridge = create<{ capture: Capture | null; menu: Menu | null }>(() => ({ capture: null, menu: null }));

export function contextBridgeAvailable(workspaceId: string): boolean {
  const state = usePerchStore.getState();
  return state.serverInfo?.capabilities?.includes("context.bridge.v1") === true
    && state.workspaces.some((workspace) => workspace.id === workspaceId && workspace.hostId === "local");
}
export function askAgent(workspaceId: string, source: ContextSource) {
  if (contextBridgeAvailable(workspaceId)) useContextBridge.setState({ capture: { workspaceId, source }, menu: null });
}
/** A file entry uses this view's latest unsaved draft, never an older disk read. */
export function askAgentAboutFile(workspaceId: string, path: string) {
  const doc = useWorkspaceFilesStore.getState().documents[workspaceId]?.[path];
  if (doc && doc.content !== doc.savedContent) {
    askAgent(workspaceId, { kind: "editor", path, text: doc.content, startLine: 1, endLine: doc.content.split(/\r?\n/).length, dirty: true });
  } else askAgent(workspaceId, { kind: "file", path });
}

/** Stores only selected text and identity, never a cached xterm/view callback. */
export function attachTerminalContext(container: HTMLElement, term: Terminal, sessionId: string | undefined) {
  const open = (event: MouseEvent) => {
    const session = usePerchStore.getState().sessions.find((candidate) => candidate.id === sessionId);
    const text = term.getSelection();
    if (!text || !session?.workspaceId || !contextBridgeAvailable(session.workspaceId)) return;
    event.preventDefault();
    event.stopPropagation();
    useContextBridge.setState({ menu: { x: event.clientX, y: event.clientY, workspaceId: session.workspaceId, source: { kind: "terminal", sessionId: session.id, text } } });
  };
  container.addEventListener("contextmenu", open);
  return () => {
    container.removeEventListener("contextmenu", open);
    const menu = useContextBridge.getState().menu;
    if (menu?.source.kind === "terminal" && menu.source.sessionId === sessionId) useContextBridge.setState({ menu: null });
  };
}

type Request = Extract<ClientMessage, { type: "context.preview" | "context.send" }>;
type Reply = ContextPreviewResultMessage | Extract<ServerMessage, { type: "agent.ui.result" }>;
const pending = new Map<string, { request: Request; resolve: (message: Reply) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
const retired = new Set<string>();
function retire(id: string) {
  retired.add(id);
  if (retired.size > 64) retired.delete(retired.values().next().value!);
}
export function requestContext(request: Request): Promise<Reply> {
  if (!socket.connected) return Promise.reject(new Error("Reconnect before preparing or sending context."));
  if (pending.size >= 8) return Promise.reject(new Error("Wait for the previous context request."));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(request.requestId); retire(request.requestId);
      reject(new Error(request.type === "context.send" ? "Delivery was not confirmed. Inspect the CLI; do not resend blindly." : "Context preparation timed out. Try again when connected."));
    }, 15_000);
    pending.set(request.requestId, { request, resolve, reject, timer });
    socket.send(request);
  });
}
export function handleContextBridgeMessage(message: ServerMessage): boolean {
  const id = "requestId" in message ? message.requestId : undefined;
  if (!id) return false;
  const item = pending.get(id);
  if (!item) return retired.has(id);
  if (message.type !== "error" && message.type !== "context.preview.result" && message.type !== "agent.ui.result") return false;
  pending.delete(id); retire(id); clearTimeout(item.timer);
  if (message.type === "error") item.reject(new Error(message.message));
  else if ((item.request.type === "context.preview" && message.type === "context.preview.result" && message.packet.workspaceId === item.request.workspaceId)
    || (item.request.type === "context.send" && message.type === "agent.ui.result" && message.sessionId === item.request.targetSessionId)) item.resolve(message);
  else item.reject(new Error("Unexpected context response. Preview again before sending."));
  return true;
}
socket.onConnectionChange((connected) => {
  if (connected) return;
  for (const [id, item] of pending) {
    clearTimeout(item.timer); retire(id);
    item.reject(new Error("Connection lost. Nothing will be retried automatically. If sending, inspect the CLI before sending again."));
  }
  pending.clear();
});
