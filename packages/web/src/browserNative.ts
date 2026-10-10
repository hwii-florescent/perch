import { fileTabKey, useFileTabs } from "./fileTabs";
import { tauriInvoke } from "./links";

/** True in the desktop app, where a browser tab is a native child webview (`browser.rs`). */
export const nativeBrowser = tauriInvoke !== undefined;

/** The webview id for a tab: its key as hex, which is all `browser.rs` accepts (letters, digits, `-`). */
export const browserId = (key: string) => [...new TextEncoder().encode(key)].map((b) => b.toString(16).padStart(2, "0")).join("");

// One call at a time, in order: the commands are async on the Rust side, so
// unqueued a `hide` could overtake the `show` before it.
let queue: Promise<unknown> = Promise.resolve();

/** Run a `browser_*` command. A failed call (page gone, bad URL) resolves to null. */
export function browserCall<T = null>(command: string, args: Record<string, unknown>): Promise<T | null> {
  const run = queue.then(() => tauriInvoke?.(`browser_${command}`, args) as Promise<T>).catch(() => null);
  queue = run;
  return run;
}

// A closed tab destroys its page. Switching tabs only hides it, so a page keeps its state.
useFileTabs.subscribe((state, previous) => {
  if (!nativeBrowser || state.tabs === previous.tabs) return;
  const open = new Set(state.tabs.map(fileTabKey));
  for (const tab of previous.tabs) {
    const key = fileTabKey(tab);
    if (tab.kind === "browser" && !open.has(key)) void browserCall("close", { id: browserId(key) });
  }
});
