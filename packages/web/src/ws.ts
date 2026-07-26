import type { ClientMessage, ServerMessage } from "@perch/shared";
import { getWsUrl } from "./base";

export type ServerMessageHandler = (msg: ServerMessage) => void;
export type ConnectionHandler = (connected: boolean) => void;

const MAX_BACKOFF_MS = 10_000;
const INITIAL_BACKOFF_MS = 500;

/** localStorage key holding the last known session id, so a page reload or
 * PWA reopen resumes the same session instead of starting a blank one. */
const SESSION_ID_STORAGE_KEY = "perch.sessionId";

function loadStoredSessionId(): string | null {
  try {
    return localStorage.getItem(SESSION_ID_STORAGE_KEY);
  } catch {
    return null; // localStorage unavailable (private mode, SSR, etc.)
  }
}

function storeSessionId(sessionId: string): void {
  try {
    localStorage.setItem(SESSION_ID_STORAGE_KEY, sessionId);
  } catch {
    // ignore — worst case we just start fresh next time
  }
}

/**
 * Thin WS transport: connects (with capped exponential-backoff reconnect),
 * performs the minimal `session.create`/`session.resume` -> `session.created`
 * -> `session.subscribe` handshake so a page refresh (or a transient
 * reconnect) resumes the same session and replays its history, and fans
 * every `ServerMessage` out to subscribers. All other protocol/state
 * handling lives in the zustand store (see store.ts).
 */
class PerchSocket {
  private ws: WebSocket | null = null;
  private handlers = new Set<ServerMessageHandler>();
  private connectionHandlers = new Set<ConnectionHandler>();
  private backoffMs = INITIAL_BACKOFF_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionId: string | null = null;
  private started = false;

  connect(): void {
    if (this.started) return;
    this.started = true;
    this.sessionId = loadStoredSessionId();
    this.open();
  }

  private open(): void {
    const ws = new WebSocket(getWsUrl());
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.backoffMs = INITIAL_BACKOFF_MS;
      for (const handler of this.connectionHandlers) handler(true);
      // Resume the last known session (persisted in localStorage) on every
      // (re)connect — including transient WS drops, not just page loads —
      // so history and claude context continuity survive both. Only mint a
      // brand-new session when we've never had one.
      const storedId = this.sessionId ?? loadStoredSessionId();
      if (storedId) {
        this.send({ type: "session.resume", sessionId: storedId });
      } else {
        this.send({ type: "session.create" });
      }
    });

    ws.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }
      if (msg.type === "session.created") {
        this.sessionId = msg.sessionId;
        storeSessionId(msg.sessionId);
        this.send({ type: "session.subscribe", sessionId: msg.sessionId });
      }
      for (const handler of this.handlers) handler(msg);
    });

    ws.addEventListener("close", () => {
      for (const handler of this.connectionHandlers) handler(false);
      this.scheduleReconnect();
    });
    ws.addEventListener("error", () => ws.close());
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, this.backoffMs);
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /** Switch to an existing session: update internal state, persist to
   * localStorage, and tell the server to resume+subscribe. The server will
   * reply with `session.created` (echoing the id) + `session.history`, which
   * the existing message handler already handles — it stores the id and
   * fires session.subscribe, so history repopulates the message list. */
  switchSession(sessionId: string): void {
    this.sessionId = sessionId;
    storeSessionId(sessionId);
    this.send({ type: "session.resume", sessionId });
  }

  /** Start a completely new session. Clears the stored session id so that
   * if the WS reconnects before session.created arrives it won't try to
   * resurrect the old session. The server will reply with session.created
   * carrying the new id, and the existing handler will persist it. */
  newSession(): void {
    this.sessionId = null;
    try {
      localStorage.removeItem("perch.sessionId");
    } catch {
      // ignore
    }
    this.send({ type: "session.create" });
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get currentSessionId(): string | null {
    return this.sessionId;
  }

  /** Subscribe to every inbound ServerMessage; returns an unsubscribe fn. */
  onMessage(handler: ServerMessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /** Subscribe to raw transport connect/disconnect events. */
  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }
}

export const socket = new PerchSocket();
