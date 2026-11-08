import type { ModsStateMessage } from "@perch/shared";
import { getBasePath } from "./base";
import { newId } from "./ids";
import { socket } from "./ws";

/** Mods: folders with a `main.js` that this page imports and runs with the person's full access, as
 * in herdr's desktop app. The core owns the files (`crates/perch-core/src/mods.rs`); this keeps the
 * latest list for everything on screen. Without the capability (an older core) or a connection there
 * is nothing to show. */
export type ModsState = Omit<ModsStateMessage, "type" | "requestId">;

const CAPABILITY = "mods.v1";
const TIMEOUT_MS = 10_000;
let capabilities: string[] = [];
const pending = new Map<string, (answer: ModsState | null) => void>();

function settle(requestId: string, answer: ModsState | null) {
  pending.get(requestId)?.(answer);
  pending.delete(requestId);
}

const openers = new Set<(modId: string) => void>();
/** `perch mod open` asked this screen to show a mod. */
export const onModOpen = (handler: (modId: string) => void) => {
  openers.add(handler);
  return () => void openers.delete(handler);
};

// The mods as this screen last heard them. Everything on screen reads this, so a mod an agent just
// wrote shows up without anyone visiting Settings.
let latest: ModsState | null = null;
const watchers = new Set<() => void>();
export const subscribeMods = (watch: () => void) => (watchers.add(watch), () => void watchers.delete(watch));
export const currentMods = () => latest;
export const refreshMods = () => void listMods();

socket.onMessage((message) => {
  if (message.type === "server.info") {
    capabilities = message.capabilities ?? [];
    refreshMods();
  } else if (message.type === "mods.state") {
    const { type: _type, requestId, ...state } = message;
    latest = state;
    watchers.forEach((watch) => watch());
    settle(requestId, state);
  } else if (message.type === "mods.changed") refreshMods();
  else if (message.type === "mods.open") openers.forEach((open) => open(message.modId));
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

/** Every mod, the setting and the mods folder; `null` when the core did not answer. */
export const listMods = () => ask((requestId) => ({ type: "mods.list", requestId }));

export const enableMod = (id: string, enabled: boolean) =>
  ask((requestId) => ({ type: "mods.set", requestId, id, op: enabled ? "enable" : "disable" }));

/** Choose the window layout; `null` goes back to Perch as shipped. */
export const setLayout = (id: string | null) =>
  ask((requestId) => ({ type: "mods.set", requestId, id: id ?? "", op: "layout" }));

/** The layout to draw, if one is chosen and still parses; otherwise stock Perch. Mods being off
 * leaves no layouts at all, so the reset key also restores the stock window. */
export function activeLayout(state: ModsState | null) {
  const layout = state?.layouts?.find((candidate) => candidate.id === state.layout);
  return layout?.root && !layout.error ? layout : null;
}

/** Tells the core how loading `revision` of a mod went (`perch mod check` reads it); `null` is no error. */
export function reportMod(id: string, revision: string, error: string | null) {
  if (capabilities.includes("mods.report.v1") && socket.connected) socket.send({ type: "mods.report", id, revision, error });
}

/** Where a mod's code is served from (a person's token only). */
export const modFileUrl = (id: string) => `${window.location.origin}${getBasePath()}mods/file?${new URLSearchParams({ id })}`;
