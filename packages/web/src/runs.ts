/** Explicit Run uses a new owned process, never input to an existing terminal.
 * A lost acknowledgement has an UNKNOWN outcome. No retries or reconnect queue.
 */
import { socket } from "./ws";
import { newId } from "./ids";
import { usePerchStore } from "./store";

export function runInWorkspace(workspaceId: string, command: string): Promise<string> {
  const state = usePerchStore.getState();
  const workspace = state.workspaces.find((w) => w.id === workspaceId);
  if (!socket.connected || !workspace || workspace.hostId !== "local" || !state.serverInfo?.capabilities?.includes("workspace.run.v1")) {
    return Promise.reject(new Error("Run needs a connected local workspace and an updated core."));
  }
  const requestId = newId();
  return new Promise((resolve, reject) => {
    const unknown = () => finish(new Error("Run outcome is unknown. Check the nest’s terminals before running again."));
    const timer = setTimeout(unknown, 20_000);
    const off = socket.onMessage((reply) => {
      if (!("requestId" in reply) || reply.requestId !== requestId) return;
      if (reply.type === "workspace.run.started") finish(undefined, reply.sessionId);
      else if (reply.type === "error") finish(new Error(reply.message));
    });
    const offConnection = socket.onConnectionChange((connected) => { if (!connected) unknown(); });
    function finish(error?: Error, sessionId?: string) {
      clearTimeout(timer); off(); offConnection();
      if (error) reject(error);
      else if (sessionId) resolve(sessionId);
    }
    socket.send({ type: "workspace.run", requestId, workspaceId, command });
  });
}
