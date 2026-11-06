/** The local UI credential every e2e core is started with (slice 3a: no tokenless loopback).
 *
 * One random value per run, chosen here and inherited by every process the runner starts:
 * cores read it from `PERCH_LOCAL_TOKEN` (a launcher hook; the core removes it from its own
 * environment and from every agent's), browsers get it as the `perch_local` cookie, and Node
 * clients send it as a bearer header or `?token=`. It is a test credential for throwaway cores
 * on private state, never printed.
 */
import { randomBytes } from "node:crypto";

export const LOCAL_TOKEN = (process.env.PERCH_LOCAL_TOKEN ||= `e2e_${randomBytes(24).toString("hex")}`);

/** The cookie that signs a browser context in to a core on 127.0.0.1 (cookies ignore ports). */
export function localCookie() {
  return { name: "perch_local", value: LOCAL_TOKEN, domain: "127.0.0.1", path: "/", expires: -1, httpOnly: true, secure: false, sameSite: "Strict" as const };
}

/** A storage state for a context that is the core's own UI, with optional per-origin storage. */
export function localStorageState(origins: { origin: string; localStorage: { name: string; value: string }[] }[] = []) {
  return { cookies: [localCookie()], origins };
}

/** For Node `fetch`/HTTP clients. */
export function localHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${LOCAL_TOKEN}` };
}

/** For Node WebSocket clients, which cannot set headers: the token rides in the query. */
export function withLocalToken(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}token=${LOCAL_TOKEN}`;
}
