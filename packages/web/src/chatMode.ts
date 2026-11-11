//! Which view an agent session shows, UI (the native chat) or CLI (its terminal).
//!
//! The computer's choice is a core setting (`settings.chatMode`). A phone (a touch device, or a relay page; a narrow
//! mouse-driven window is still the computer) keeps its own, in this device's storage, so
//! switching the view on the phone never changes the computer and the other way round. Until a phone has chosen, it
//! starts from the computer's value.
import { useSyncExternalStore } from "react";
import { usePerchStore } from "./store";
import { useIsTouchPhone } from "./responsive";

export type ChatMode = "ui" | "cli";

const KEY = "perch.phoneChatMode";
const watchers = new Set<() => void>();
const valid = (value: unknown): value is ChatMode => value === "ui" || value === "cli";

// Held in memory too, so a phone whose storage refuses the write still shows the choice it was just given.
let chosen: ChatMode | null = null;
try { const stored = localStorage.getItem(KEY); if (valid(stored)) chosen = stored; } catch { /* no storage: memory only */ }

/** Choose this phone's view; the computer's is untouched. */
export function setPhoneChatMode(mode: ChatMode) {
  chosen = mode;
  try { localStorage.setItem(KEY, mode); } catch { /* memory only */ }
  watchers.forEach((watch) => watch());
}

const subscribe = (watch: () => void) => {
  watchers.add(watch);
  // Another tab of this phone choosing counts too.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY && event.key !== null) return;
    try { const stored = localStorage.getItem(KEY); chosen = valid(stored) ? stored : null; } catch { /* keep what we had */ }
    watch();
  };
  window.addEventListener("storage", onStorage);
  return () => { watchers.delete(watch); window.removeEventListener("storage", onStorage); };
};

/** The view this page shows: the phone's own on a phone, else the computer's setting. */
export function useChatMode(): ChatMode {
  const phone = useIsTouchPhone();
  const own = useSyncExternalStore(subscribe, () => chosen, () => null);
  const shared = usePerchStore((s) => s.settings?.chatMode ?? "cli");
  return phone ? (own ?? shared) : shared;
}

/** Choose the view this page shows: this phone's own, or on the computer the core's setting. */
export function useSetChatMode(): (mode: ChatMode) => void {
  const phone = useIsTouchPhone();
  const save = usePerchStore((s) => s.updateSettings);
  return (mode) => (phone ? setPhoneChatMode(mode) : save({ chatMode: mode }));
}
