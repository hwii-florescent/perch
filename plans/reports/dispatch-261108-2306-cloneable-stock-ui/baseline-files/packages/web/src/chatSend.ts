/**
 * chatSend.ts — what Enter does in the chat composer while the agent is working: `steer` (into the
 * running turn, the default) or `queue` (behind it). Alt/Option+Enter does the other one. A per-device
 * preference in localStorage. Claude and OpenCode have no separate steer command, so they ignore it.
 */
import { useSyncExternalStore } from "react";

export type SendWhileWorking = "steer" | "queue";
const KEY = "perch.sendWhileWorking";

const read = (): SendWhileWorking => {
  try { return localStorage.getItem(KEY) === "queue" ? "queue" : "steer"; } catch { return "steer"; }
};

let mode = read();
const listeners = new Set<() => void>();

export function setSendWhileWorking(next: SendWhileWorking): void {
  if (next === mode) return;
  mode = next;
  try { localStorage.setItem(KEY, mode); } catch { /* private mode: it just won't persist */ }
  listeners.forEach((listener) => listener());
}

export const useSendWhileWorking = (): SendWhileWorking => useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => mode);

/** The delivery for one send: Alt/Option held takes the other mode. */
export const deliveryFor = (preferred: SendWhileWorking, alt: boolean): SendWhileWorking => alt ? (preferred === "steer" ? "queue" : "steer") : preferred;
