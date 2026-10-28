import { fileTabKey, useFileTabs } from "./fileTabs";
import { tauriInvoke } from "./links";
import { useBrowserPages } from "./browserPages";

/** True in the desktop app, where a browser tab is a native child webview (`browser.rs`). */
export const nativeBrowser = tauriInvoke !== undefined;

/** The webview id for a tab: its key as hex, which is all `browser.rs` accepts (letters, digits, `-`). */
export const browserId = (key: string) => [...new TextEncoder().encode(key)].map((b) => b.toString(16).padStart(2, "0")).join("");

// One call at a time, in order: the commands are async on the Rust side, so
// unqueued a `hide` could overtake the `show` before it.
let queue: Promise<unknown> = Promise.resolve();

/** Run a `browser_*` command. A failed call (page gone, bad URL) resolves to null. */
export function browserCall<T = null>(command: string, args: Record<string, unknown>, current: () => boolean = () => true): Promise<T | null> {
  const run = queue.then(() => {
    if (command === "close" && typeof args.id === "string") {
      browserAddressDrafts.delete(args.id);
      if (focusedBrowser === args.id) focusedBrowser = null;
    }
    const from = focusedBrowser;
    if (!current()) return null;
    const payload = command === "focus" ? { from, ...args } : args;
    return tauriInvoke?.(`browser_${command}`, payload) as Promise<T>;
  }).catch(() => null);
  queue = run;
  return run;
}

/** Native focus notices are validated by keybinds.ts before reaching this module. */
let focusedBrowser: string | null = null;
let focusRevision = 0;
export const browserHasFocus = (id: string) => focusedBrowser === id;
export function noteBrowserFocus(id: string): void {
  focusRevision++;
  focusedBrowser = id;
  browserAddressDrafts.delete(id);
}

/** An address draft/selection lives only as long as its tab, never in persisted page history. */
export const browserAddressDrafts = new Map<string, {
  value: string; start: number | null; end: number | null; direction: "forward" | "backward" | "none" | null;
}>();

export const BROWSER_COVERS = '[role="dialog"], [role="menu"], [role="listbox"], .pane-context-menu__item, [data-testid="settings-modal"]';

// Main-document inputs (including dialogs/address bars) must own the native responder too.
// Keep the page's return target while a temporary cover owns input. Explicit activation
// also calls this: focusing an already-active DOM input does not emit another focusin.
export function focusMainResponder(target: EventTarget | null): void {
  if (!nativeBrowser || !focusedBrowser || !(target instanceof HTMLElement) || !target.isConnected || document.activeElement !== target) return;
  const from = focusedBrowser, revision = focusRevision;
  void browserCall("focus", { id: null, from }, () => {
    if (revision !== focusRevision || focusedBrowser !== from || !target.isConnected || document.activeElement !== target) return false;
    if (!target.closest(BROWSER_COVERS)) focusedBrowser = null;
    return true;
  });
}

/**
 * Drag passthrough. A native page sits above the web view and swallows pointer events, so a tab
 * or divider drag would stall over one (Orca sets `pointer-events: none` on its webviews; a native
 * child webview has no such switch). While any drag holds this, every page is hidden
 * (`WorkspaceBrowser` reads `passthroughActive`) and the pane's placeholder takes the pointer.
 * Returns an idempotent release; holds nest.
 * ponytail: the page is blank during the drag; a snapshot placeholder would need a native capture.
 */
let holds = 0;
const passthroughListeners = new Set<() => void>();
export const passthroughActive = () => holds > 0;
export function onPassthrough(listener: () => void): () => void {
  passthroughListeners.add(listener);
  return () => { passthroughListeners.delete(listener); };
}
export function acquirePassthrough(): () => void {
  if (!nativeBrowser) return () => {};
  holds++;
  passthroughListeners.forEach((listener) => listener());
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds--;
    passthroughListeners.forEach((listener) => listener());
  };
}

// A closed tab destroys its page and forgets its saved address. Switching tabs only hides it, so a page keeps its state.
useFileTabs.subscribe((state, previous) => {
  if (state.tabs === previous.tabs) return;
  const open = new Set(state.tabs.map(fileTabKey));
  for (const tab of previous.tabs) {
    const key = fileTabKey(tab);
    if (tab.kind !== "browser" || open.has(key)) continue;
    useBrowserPages.getState().forget(key);
    void browserCall("close", { id: browserId(key) });
  }
});
