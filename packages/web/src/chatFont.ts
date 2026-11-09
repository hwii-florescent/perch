/**
 * chatFont.ts — the chat's own text size, a per-device preference (localStorage, like zoom.ts).
 * It is a factor on `--chat-font-scale`, read by the chat's message text in components/ui/chat.ts;
 * code, tables and cards inside a message size in `em`, so they follow. Cmd +/- zoom still scales everything.
 */
import { useSyncExternalStore } from "react";

const KEY = "perch.chatFontScale";
export const CHAT_FONT_SIZES = [
  { value: "0.9", label: "Small" },
  { value: "1", label: "Default" },
  { value: "1.1", label: "Large" },
  { value: "1.25", label: "Extra large" },
] as const;

const read = (): string => {
  try {
    const stored = localStorage.getItem(KEY);
    return CHAT_FONT_SIZES.some((size) => size.value === stored) ? stored! : "1";
  } catch { return "1"; }
};

let scale = read();
const listeners = new Set<() => void>();
const apply = () => { if (typeof document !== "undefined") document.documentElement.style.setProperty("--chat-font-scale", scale); };
apply();

export function setChatFontScale(next: string): void {
  if (next === scale || !CHAT_FONT_SIZES.some((size) => size.value === next)) return;
  scale = next;
  try { localStorage.setItem(KEY, scale); } catch { /* private mode: it just won't persist */ }
  apply();
  listeners.forEach((listener) => listener());
}

export const useChatFontScale = (): string => useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => scale);
