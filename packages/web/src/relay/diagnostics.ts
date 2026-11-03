/** Phone-side connection evidence only. Never record URLs, room ids, keys,
 * pairing codes, tokens, payloads, or peer-supplied close/error text. */
import { useSyncExternalStore } from "react";

export type ConnectionStage = "direct" | "link-ready" | "preparing-encryption" | "connecting-relay" | "waiting-for-computer" | "tunnel-ready" | "opening-perch" | "connected" | "failed";
export interface RelayDiagnostics {
  mode: "direct" | "relay";
  stage: ConnectionStage;
  attempts: number;
  linkPresent: boolean;
  /** Truncated SHA-256 of the public room id, never the room id or key itself. */
  roomFingerprint: string | null;
  tokenPresent: boolean;
  storageAvailable: boolean | null;
  secureContext: boolean;
  webCrypto: boolean;
  error: string | null;
  closeCode: number | null;
  failureStage: ConnectionStage | null;
}

let snapshot: RelayDiagnostics = {
  mode: "direct", stage: "direct", attempts: 0, linkPresent: false, roomFingerprint: null, tokenPresent: false,
  storageAvailable: null, secureContext: false, webCrypto: false,
  error: null, closeCode: null, failureStage: null,
};
const listeners = new Set<() => void>();

export function reportConnection(update: Partial<RelayDiagnostics>): void {
  let failureStage = snapshot.failureStage;
  if (update.error && snapshot.stage !== "failed") failureStage = snapshot.stage;
  const closeCode = update.error ? update.closeCode ?? null : update.closeCode ?? snapshot.closeCode;
  snapshot = { ...snapshot, ...update, failureStage, closeCode };
  for (const listener of listeners) listener();
}

export const getRelayDiagnostics = () => snapshot;
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useRelayDiagnostics = () => useSyncExternalStore(subscribe, getRelayDiagnostics);

/** An allowlisted report, not a dump of browser storage or transport objects. */
export function connectionReport(connected: boolean): string {
  return JSON.stringify({ reportVersion: 1, perchConnected: connected, ...snapshot }, null, 2);
}
