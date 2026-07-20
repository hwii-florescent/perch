import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface MessageRow {
  id: number;
  session_id: string;
  role: string;
  content: string;
  created_at: number;
}

interface SqliteStatementLike {
  run(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

interface SqliteHandleLike {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatementLike;
  close(): void;
}

const DEFAULT_DB_PATH = path.join(os.homedir(), ".perch", "history.sqlite");

/**
 * Session/message history, persisted to SQLite. Prefers `better-sqlite3`
 * (native, synchronous); if it fails to load (e.g. no prebuilt binary for
 * this platform and no build toolchain), falls back to the experimental
 * `node:sqlite` built into Node 22, which has a compatible enough
 * prepare().run()/.all() surface for what we need here.
 */
export class HistoryDb {
  private constructor(private readonly db: SqliteHandleLike) {
    this.migrate();
  }

  static async open(dbPath: string = DEFAULT_DB_PATH): Promise<HistoryDb> {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const db = await openHandle(dbPath);
    return new HistoryDb(db);
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        cwd TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  }

  createSession(id: string, cwd: string): void {
    this.db
      .prepare("INSERT OR IGNORE INTO sessions (id, cwd, created_at) VALUES (?, ?, ?)")
      .run(id, cwd, Date.now());
  }

  addMessage(sessionId: string, role: string, content: string): void {
    this.db
      .prepare("INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)")
      .run(sessionId, role, content, Date.now());
  }

  getMessages(sessionId: string): MessageRow[] {
    return this.db
      .prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC")
      .all(sessionId) as MessageRow[];
  }

  close(): void {
    this.db.close();
  }
}

async function openHandle(dbPath: string): Promise<SqliteHandleLike> {
  try {
    const mod = await import("better-sqlite3");
    const Database = mod.default;
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    return db as unknown as SqliteHandleLike;
  } catch (err) {
    console.warn(
      `[perch] better-sqlite3 unavailable (${(err as Error).message}); falling back to node:sqlite`,
    );
    const { DatabaseSync } = await import("node:sqlite");
    return new DatabaseSync(dbPath) as unknown as SqliteHandleLike;
  }
}
