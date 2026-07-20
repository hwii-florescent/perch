import type { ServerMessage } from "@perch/shared";

const RING_BUFFER_SIZE = 500;

interface SessionState {
  id: string;
  cwd: string;
  buffer: ServerMessage[];
}

/**
 * In-memory registry of live chat sessions. Each session keeps a small ring
 * buffer of the server-side events it has emitted so a client that
 * reconnects and sends `session.subscribe` can catch up without replaying
 * from SQLite.
 */
export class SessionRegistry {
  private readonly sessions = new Map<string, SessionState>();

  create(id: string, cwd: string): void {
    this.sessions.set(id, { id, cwd, buffer: [] });
  }

  has(id: string): boolean {
    return this.sessions.has(id);
  }

  get(id: string): SessionState | undefined {
    return this.sessions.get(id);
  }

  record(sessionId: string, message: ServerMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.buffer.push(message);
    if (session.buffer.length > RING_BUFFER_SIZE) {
      session.buffer.splice(0, session.buffer.length - RING_BUFFER_SIZE);
    }
  }

  replay(sessionId: string): ServerMessage[] {
    return this.sessions.get(sessionId)?.buffer ?? [];
  }
}
