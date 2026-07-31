/**
 * paneLabels.ts — Wave 2 item 12: settings toggle for showing the active
 * agent as a small badge on the chat pane's dockview tab (e.g. "Chat ·
 * claude"). Client-only, no protocol involvement — persisted in localStorage,
 * default ON.
 *
 * Needs a tiny pub-sub (rather than a plain getter/setter) because two
 * independent React trees read this value: `SettingsModal`'s checkbox (which
 * writes it) and `DockviewShell.tsx`'s `PaneTab` (a module-level component
 * dockview-react renders outside `App`'s own tree — see the
 * `dockviewController.ts` register/get comment for why module-level
 * indirection is already the established pattern here). A plain module
 * variable read once on mount wouldn't pick up a change made from the other
 * tree without a full reload.
 */

import { useEffect, useState } from "react";

const STORAGE_KEY = "perch.paneLabels.enabled";
const DEFAULT_ENABLED = true;

type Listener = (enabled: boolean) => void;

const listeners = new Set<Listener>();

function readStored(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_ENABLED;
    return raw === "1";
  } catch {
    return DEFAULT_ENABLED;
  }
}

let enabled = readStored();

export function getPaneLabelsEnabled(): boolean {
  return enabled;
}

export function setPaneLabelsEnabled(next: boolean): void {
  enabled = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // ignore — worst case the preference doesn't survive a reload
  }
  for (const listener of listeners) listener(enabled);
}

/** Subscribe to changes; returns an unsubscribe function. Does not call the
 * listener immediately with the current value — callers that need the
 * initial value should call `getPaneLabelsEnabled()` themselves (this
 * mirrors `terminalBus.ts`'s `onTerminalData` shape). */
export function onPaneLabelsChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** React hook wrapper: current value, kept in sync via `onPaneLabelsChange`.
 * Used by `DockviewShell.tsx`'s `PaneTab` (a module-level component rendered
 * outside `App`'s tree by dockview-react) and `SettingsModal`'s checkbox. */
export function usePaneLabelsEnabled(): boolean {
  const [value, setValue] = useState(getPaneLabelsEnabled);
  useEffect(() => onPaneLabelsChange(setValue), []);
  return value;
}
