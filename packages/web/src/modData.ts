//! A mod's durable data, as the page reaches it: `POST mods/data` on the core (`crates/perch-core/src/mod_data.rs`,
//! `server/mods.rs` `data`). Per mod, kept by the core outside the mod's folder (a clone starts with none), JSON values
//! by key with a SHA-256 revision each. Also carried by the relay (an exact route), so a phone's mods have it too.
//! Bound to one mod id by `modData(id)`: `@perch/sdk`'s `useModData()` and a legacy mod's `api.data`. Trusted code can
//! name another id here; this is a lifetime and a place, not an isolation boundary.
import { getBasePath } from "./base";

export interface ModDataValue<T = unknown> { value: T; revision: string }
export interface ModDataEntry { key: string; revision: string; size: number }
export interface ModDataWriteOptions {
  /** The revision the key must hold now, or null for a key that must not exist yet; another one rejects with
   * `conflict` (and the current revision) and nothing is written. Absent: write whatever is there. */
  expected?: string | null;
}
export interface ModDataError extends Error {
  /** `conflict`: the key holds another revision. `corrupt`: its file is not JSON (write naming `revision` to replace it). */
  code?: "conflict" | "corrupt";
  /** The key's revision now (null: it has none). */
  revision?: string | null;
}
export interface ModData {
  read<T = unknown>(key: string): Promise<ModDataValue<T> | null>;
  write(key: string, value: unknown, options?: ModDataWriteOptions): Promise<string>;
  remove(key: string, options?: ModDataWriteOptions): Promise<boolean>;
  list(): Promise<ModDataEntry[]>;
  /** Calls `changed` with the mod's keys when any key's revision changes (a write from this page at once, others
   * within `every` ms, 2 s by default). Returns the way to stop. */
  watch(changed: (entries: ModDataEntry[]) => void, every?: number): () => void;
}

const fail = (message: string, extra: Partial<ModDataError> = {}): ModDataError => Object.assign(new Error(message), extra);

async function call<T>(body: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${window.location.origin}${getBasePath()}mods/data`, {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
  } catch {
    throw fail("The core could not be reached; the mod's data is unchanged.");
  }
  const answer = (await response.json().catch(() => ({}))) as T & { error?: string; revision?: string | null };
  if (response.status === 409) throw fail(answer.error ?? "The value changed since it was read.", { code: "conflict", revision: answer.revision ?? null });
  if (!response.ok) throw fail(answer.error ?? `The core refused it (${response.status}).`);
  return answer;
}

/** Writes made from this page, so a watcher hears them without waiting for its next look. */
const touched = new Map<string, Set<() => void>>();
const told = (id: string) => touched.get(id)?.forEach((listen) => listen());

export function modData(id: string): ModData {
  const list = async () => (await call<{ keys: ModDataEntry[] }>({ id, op: "list" })).keys;
  return {
    async read<T>(key: string) {
      const answer = await call<{ exists: boolean; value?: T; revision?: string; corrupt?: boolean; error?: string }>({ id, op: "read", key });
      if (answer.corrupt) throw fail(answer.error ?? `${key} is not valid JSON`, { code: "corrupt", revision: answer.revision ?? null });
      return answer.exists ? { value: answer.value as T, revision: answer.revision ?? "" } : null;
    },
    async write(key, value, options = {}) {
      if (value === undefined) throw fail("write takes a JSON value (use remove to delete a key).");
      const answer = await call<{ revision: string }>({ id, op: "write", key, value, ...("expected" in options ? { expected: options.expected } : {}) });
      told(id);
      return answer.revision;
    },
    async remove(key, options = {}) {
      const answer = await call<{ deleted: boolean }>({ id, op: "delete", key, ...("expected" in options ? { expected: options.expected } : {}) });
      told(id);
      return answer.deleted;
    },
    list,
    // ponytail: polls `list` (one small request per `every` ms per watcher), as `watchPath` does; the upgrade path is
    // the core announcing data changes on the socket like `mods.changed`.
    watch(changed, every = 2000) {
      let stopped = false;
      let last: string | null = null;
      const look = async () => {
        try {
          const entries = await list();
          const now = JSON.stringify(entries);
          if (!stopped && last !== null && now !== last) changed(entries);
          if (!stopped) last = now;
        } catch { /* unreachable for now: look again next time */ }
      };
      void look();
      const timer = window.setInterval(look, every);
      const listeners = touched.get(id) ?? new Set();
      touched.set(id, listeners);
      listeners.add(look);
      return () => {
        stopped = true;
        window.clearInterval(timer);
        listeners.delete(look);
      };
    },
  };
}
