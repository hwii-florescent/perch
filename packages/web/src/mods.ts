import type { ModsStateMessage } from "@perch/shared";
import { getBasePath } from "./base";
import { newId } from "./ids";
import { socket } from "./ws";

/** Mods: folders a person or an agent writes, approved by a person (or the person's own policy).
 * The core owns the rules, the files and the approval (`crates/perch-core/src/mods.rs`,
 * `server/mods.rs`); this only asks and tells. A click here is a person's, which is why approving is
 * possible over the socket. Without the capability (an older core) or a connection there is nothing
 * to show. */
export type ModsState = Omit<ModsStateMessage, "type" | "requestId">;

const CAPABILITY = "mods.v1";
const TIMEOUT_MS = 70_000; // a run may take 60 s
let capabilities: string[] = [];
const pending = new Map<string, (answer: ModsState | null) => void>();

function settle(requestId: string, answer: ModsState | null) {
  pending.get(requestId)?.(answer);
  pending.delete(requestId);
}

socket.onMessage((message) => {
  if (message.type === "server.info") capabilities = message.capabilities ?? [];
  else if (message.type === "mods.state") {
    const { type: _type, requestId, ...state } = message;
    settle(requestId, state);
  }
});
// A dropped connection never answers: let waiting requests finish.
socket.onConnectionChange((connected) => {
  if (!connected) for (const id of [...pending.keys()]) settle(id, null);
});

export const modsAvailable = () => capabilities.includes(CAPABILITY) && socket.connected;

function ask(build: (requestId: string) => Parameters<typeof socket.send>[0]): Promise<ModsState | null> {
  if (!modsAvailable()) return Promise.resolve(null);
  const requestId = newId();
  return new Promise((resolve) => {
    pending.set(requestId, resolve);
    setTimeout(() => settle(requestId, null), TIMEOUT_MS);
    socket.send(build(requestId));
  });
}

/** Every mod, the policy and the mods folder; `null` when the core did not answer. */
export const listMods = () => ask((requestId) => ({ type: "mods.list", requestId }));

/** Approve names the hash the person looked at; a manifest that changed since is refused. */
export const approveMod = (id: string, hash: string) =>
  ask((requestId) => ({ type: "mods.set", requestId, id, op: "approve", hash }));

export const enableMod = (id: string, enabled: boolean) =>
  ask((requestId) => ({ type: "mods.set", requestId, id, op: enabled ? "enable" : "disable" }));

/** The answer carries `run`: how the action ended and what it printed. */
export const runModAction = (id: string, action: string) =>
  ask((requestId) => ({ type: "mods.set", requestId, id, op: "run", action }));

/** Where a panel's page is served from. It is shown only inside a sandboxed iframe. */
export const modPanelUrl = (id: string, panel: string) =>
  `${window.location.origin}${getBasePath()}mods/panel?${new URLSearchParams({ id, panel })}`;
