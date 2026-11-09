/**
 * ContextBridge.tsx: Context Bridge's UI (docs/CONTEXT-BRIDGE.md), mounted once in App: the terminal selection's
 * menu and the Ask agent dialog. The screen is `stock:context-bridge` (`stock-ui/context-bridge/main.tsx`) or the
 * person's package chosen for it. This file owns the explicit send: one operation id per capture, at most one send,
 * never retried after an uncertain answer, kept here (not in the screen) so a copy swapped in mid-send cannot send
 * again and shows the same state.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import type { ContextAgent, ContextPacket } from "@perch/shared";
import { askAgent, requestContext, useContextBridge } from "../contextBridge";
import { usePerchStore } from "../store";
import { activateTab } from "../workspaceTabs";
import { newId } from "../ids";
import ContextBridgeScreen from "../stock-ui/context-bridge/main";
import { StockRoute } from "./mod-root";

type Preview = { packet: ContextPacket; agents: ContextAgent[] };
type SendState = { attempted: boolean; sending: boolean; delivered: boolean; error?: string; sent?: { instruction: string; preview: Preview; targetSessionId: string } };
const IDLE: SendState = { attempted: false, sending: false, delivered: false };

export function ContextBridge() {
  const capture = useContextBridge((state) => state.capture);
  const menu = useContextBridge((state) => state.menu);
  const connected = usePerchStore((state) => state.connected);
  // One capture is one intent: a new capture starts a new send state and operation id.
  const [send, setSend] = useState<{ capture: unknown; state: SendState; operationId: string }>({ capture: null, state: IDLE, operationId: newId() });
  const current = send.capture === capture ? send : { capture, state: IDLE, operationId: newId() };
  if (current !== send) setSend(current);
  const lock = useRef<unknown>(null);
  const ids = useRef(new WeakMap<object, string>());
  const captureId = (value: object) => { if (!ids.current.has(value)) ids.current.set(value, newId()); return ids.current.get(value)!; };

  const update = useCallback((owner: unknown, next: Partial<SendState>) => setSend((now) => (now.capture === owner ? { ...now, state: { ...now.state, ...next } } : now)), []);
  const actions = useMemo(() => ({
    ask: () => { const open = useContextBridge.getState().menu; if (open) askAgent(open.workspaceId, open.source); },
    closeMenu: () => useContextBridge.setState({ menu: null }),
    preview: async (instruction: string): Promise<Preview> => {
      if (!capture) throw new Error("Nothing is being asked about.");
      const reply = await requestContext({ type: "context.preview", requestId: newId(), workspaceId: capture.workspaceId, source: capture.source, instruction });
      if (reply.type !== "context.preview.result" || reply.packet.workspaceId !== capture.workspaceId) throw new Error("Perch did not prepare this context.");
      return { packet: reply.packet, agents: reply.agents };
    },
    send: async ({ instruction, preview, targetSessionId }: { instruction: string; preview: Preview; targetSessionId: string }) => {
      if (!capture || lock.current === capture || current.state.attempted) throw new Error("This context was already sent once. Inspect the agent's CLI before asking again.");
      lock.current = capture;
      const owner = capture;
      update(owner, { attempted: true, sending: true, error: undefined, sent: { instruction, preview, targetSessionId } });
      // One operation id for this intent. Never retry uncertain delivery, even after a transport reconnect; the core
      // also durably deduplicates it and rejects a changed digest.
      try {
        const reply = await requestContext({ type: "context.send", requestId: newId(), operationId: current.operationId, workspaceId: owner.workspaceId, source: owner.source, instruction, digest: preview.packet.digest, targetSessionId });
        if (reply.type !== "agent.ui.result" || !reply.accepted || reply.sessionId !== targetSessionId) throw new Error("The agent did not confirm delivery. Inspect its CLI before sending again.");
        update(owner, { sending: false, delivered: true });
      } catch (reason) {
        update(owner, { sending: false, error: (reason as Error).message });
        throw reason;
      }
    },
    openAgent: (sessionId: string) => {
      const session = usePerchStore.getState().sessions.find((candidate) => candidate.id === sessionId);
      if (!session) return false;
      activateTab({ kind: "session", id: session.id, session });
      return true;
    },
    // Never closes while a send is in flight.
    close: () => { if (!current.state.sending) useContextBridge.setState({ capture: null }); },
  }), [capture, current, update]);

  if (!menu && !capture) return null;
  const props = {
    connected, actions, sendState: current.state,
    menu: menu ? { x: menu.x, y: menu.y, workspaceId: menu.workspaceId, sessionId: menu.source.kind === "terminal" ? menu.source.sessionId : undefined, selection: menu.source.kind === "terminal" ? menu.source.text : undefined } : null,
    capture: capture ? { id: captureId(capture), workspaceId: capture.workspaceId, source: capture.source } : null,
  };
  return <StockRoute name="context-bridge" props={props} stock={ContextBridgeScreen} />;
}
