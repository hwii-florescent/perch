/**
 * zoom.ts — Cmd/Ctrl +, -, 0: one zoom level for everything in the tab area (terminals, file editor
 * and explorer, browser pages). Like VS Code's window zoom, each level scales by 1.2 (`zoomFactor`).
 * Components read `--zoom` in CSS (`calc(13px * var(--zoom, 1))`) or `useZoom()`; xterm and the native
 * browser webview (`browser_show`) take the factor directly. The level is per device, kept in localStorage.
 */
import { useSyncExternalStore } from "react";

const KEY = "perch.zoomLevel";
const MIN = -5;
const MAX = 8;

const read = (): number => {
  try {
    const n = Number(localStorage.getItem(KEY));
    return Number.isInteger(n) ? Math.min(MAX, Math.max(MIN, n)) : 0;
  } catch { return 0; }
};

let level = read();
const listeners = new Set<() => void>();

export const zoomFactor = (l = level): number => Math.round(1.2 ** l * 1000) / 1000;
const apply = () => { if (typeof document !== "undefined") document.documentElement.style.setProperty("--zoom", String(zoomFactor())); };
apply();

export function setZoomLevel(next: number): void {
  next = Math.min(MAX, Math.max(MIN, next));
  if (next === level) return;
  level = next;
  try { localStorage.setItem(KEY, String(level)); } catch { /* private mode: zoom just won't persist */ }
  apply();
  listeners.forEach((l) => l());
}
export const zoomIn = () => setZoomLevel(level + 1);
export const zoomOut = () => setZoomLevel(level - 1);
export const zoomReset = () => setZoomLevel(0);

export function onZoom(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The current factor (1 = 100%); re-renders on change. */
export const useZoom = (): number => useSyncExternalStore(onZoom, () => zoomFactor());
