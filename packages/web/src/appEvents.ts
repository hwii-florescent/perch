/**
 * appEvents.ts — requests from the keyboard (or the home screen) to UI that
 * owns its own state: the "+" harness picker in the tab strip and the Add
 * project dialog in the sidebar. Window events keep `keybinds.ts` free of
 * component imports.
 */
import { usePerchStore } from "./store";

export const ADD_PROJECT_EVENT = "perch:add-project";
export const NEW_TAB_EVENT = "perch:new-tab";

/** Run `fn` once the sidebar is on screen (its dialogs and menus live in it). */
export function withSidebar(fn: () => void): void {
  const state = usePerchStore.getState();
  if (!state.sidebarCollapsed) return fn();
  state.toggleSidebar();
  // After the sidebar has rendered.
  setTimeout(fn, 50);
}

export function requestAddProject(): void {
  withSidebar(() => window.dispatchEvent(new Event(ADD_PROJECT_EVENT)));
}

export function requestNewTab(): void {
  window.dispatchEvent(new Event(NEW_TAB_EVENT));
}
