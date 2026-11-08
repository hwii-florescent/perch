import { getBasePath } from "./base";
import { isRelayMode } from "./relay/transport";

/** What a mod may do on this computer through the core (`crates/perch-core/src/server/mods.rs`):
 * run a program, use files. Trusted code, like herdr's `exec`; the core only checks that the page is
 * the person's. Not available when the page reaches the core through the relay. */
async function post<T>(route: string, body: unknown): Promise<T> {
  if (isRelayMode()) throw new Error("This is not available over the relay: open Perch on the computer that runs the core.");
  const response = await fetch(`${window.location.origin}${getBasePath()}${route}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const answer = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(answer.error ?? `The core refused it (${response.status}).`);
  return answer;
}

export interface ExecResult { code: number | null; stdout: string; stderr: string }
export interface FileStat { exists: boolean; isDir?: boolean; size?: number; modified?: number }

/** Runs `cmd args` (output past 1 MiB is cut; `timeout` ms, default 30 s, at most 10 min). It
 * rejects if the program cannot start or runs out of time; a nonzero `code` is a result. `host` (an id from
 * Settings > Hosts) runs it on that computer over ssh. */
export const exec = (cmd: string, args: string[] = [], options: { cwd?: string; timeout?: number; host?: string } = {}) =>
  post<ExecResult>("mods/exec", { cmd, args, ...options });

/** Where a file call acts: this computer, or a host's (an id from Settings > Hosts, over ssh). */
export interface OnHost { host?: string }
const fs = <T>(op: string, path: string, text?: string, host?: string) => post<T>("mods/fs", { op, path, text, host });
export const readTextFile = async (path: string, on: OnHost = {}) => (await fs<{ text: string }>("read", path, undefined, on.host)).text;
/** `expected` is the text the file must hold now (null: it must not exist); a different file rejects and nothing is written. */
export async function writeTextFile(path: string, text: string, on: OnHost & { expected?: string | null } = {}) {
  if (on.expected !== undefined) {
    const now = (await statFile(path, on)).exists ? await readTextFile(path, on) : null;
    if (now !== on.expected) throw new Error(`${path} changed since it was read`);
  }
  await fs("write", path, text, on.host);
}
export const statFile = (path: string, on: OnHost = {}) => fs<FileStat>("stat", path, undefined, on.host);
export const listDir = async (path: string, on: OnHost = {}) => (await fs<{ entries: { name: string; isDir: boolean }[] }>("list", path, undefined, on.host)).entries;

/** Calls `changed` when the file or folder's size or modified time changes (checked every `every` ms,
 * 2 s by default). Returns the way to stop. */
export function watchPath(path: string, changed: () => void, every = 2000, on: OnHost = {}): () => void {
  let last = "";
  let stopped = false;
  const check = async () => {
    try {
      const now = JSON.stringify(await statFile(path, on));
      if (last && now !== last && !stopped) changed();
      last = now;
    } catch { /* unreachable for now: try again next time */ }
  };
  void check();
  const timer = window.setInterval(check, every);
  return () => { stopped = true; window.clearInterval(timer); };
}

const SHARED_KEY = "perch.mods.shared";
const readShared = (): Record<string, unknown> => {
  try { return JSON.parse(localStorage.getItem(SHARED_KEY) ?? "{}") as Record<string, unknown>; } catch { return {}; }
};
let shared = readShared();
const sharedWatchers = new Set<(key: string, value: unknown) => void>();

/** State every mod sees, kept on this screen across reloads (herdr's `shared`). Values are JSON. */
export const getShared = (key: string): unknown => shared[key];
export function setShared(key: string, value: unknown): void {
  shared = { ...shared, [key]: value };
  if (value === undefined) delete shared[key];
  try { localStorage.setItem(SHARED_KEY, JSON.stringify(shared)); } catch { /* full or private: kept in memory only */ }
  sharedWatchers.forEach((watch) => watch(key, value));
}
export const onShared = (watch: (key: string, value: unknown) => void) => (sharedWatchers.add(watch), () => void sharedWatchers.delete(watch));
