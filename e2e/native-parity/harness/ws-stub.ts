//! A socket that never connects: the harness feeds the app's store from a fixture, so nothing may reach for a core.
//! Same surface as `packages/web/src/ws.ts`, every call a no-op.
export type ServerMessageHandler = (msg: unknown) => void;
export type ConnectionHandler = (connected: boolean) => void;

export const socket = {
  connect(): void {},
  recoverTerminalStream(): void {},
  send(_msg: unknown): void {},
  switchSession(_sessionId: string): void {},
  newSession(): void {},
  connected: false,
  currentSessionId: null as string | null,
  onMessage(_handler: ServerMessageHandler): () => void { return () => {}; },
  onConnectionChange(_handler: ConnectionHandler): () => void { return () => {}; },
};
