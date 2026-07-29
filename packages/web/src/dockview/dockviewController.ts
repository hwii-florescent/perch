/**
 * dockviewController.ts — a small module-level indirection so non-React code
 * (`keybinds.ts`, which is a plain event-listener hook, not a component that
 * can hold a dockview `api` prop) can drive the single global dockview
 * instance (`DockviewShell`) for the Phase 4 pane keybindings (leader,x/v/-/z)
 * without reaching into an ad-hoc global (`window.__dockviewApi`, etc.).
 *
 * `DockviewShell` registers a controller on mount (once `api` is available)
 * and unregisters it on unmount. `getDockviewController()` returns `null`
 * before the shell has mounted or after it unmounts — callers must treat a
 * missing controller as a no-op, not an error, since keybinds can fire before
 * the dockview instance exists (e.g. very early in a page's lifecycle).
 */
import type { DockviewApi } from "dockview-react";

export interface DockviewController {
  /** Add a new terminal panel split off the active panel (or "chat" if no
   * panel is active yet) in the given direction. Mirrors how the existing
   * toolbar "Open terminal" button (`App.tsx`) adds panels. */
  addTerminalPanel(direction: "right" | "below"): void;
  /** Close the active panel — unless it's the primary "chat" panel, which
   * must always remain (there is always exactly one Chat panel; "closing"
   * it would leave the session with no view). No-op if the active panel is
   * "chat" or if there is no active panel. */
  closeActiveTerminalPanel(): void;
  /** Toggle maximize/restore on the active panel's group. */
  toggleMaximizeActive(): void;
  /** Make the given panel the active one (used before delegating to the
   * active-panel-scoped actions above from a per-panel context menu, so
   * right-clicking a non-active tab's Split/Close/Zoom acts on that tab
   * rather than whatever happened to be active before the right-click). */
  setActivePanel(panelId: string): void;
  /** Rename a panel via the dockview panel api. Persists automatically
   * through the existing `onDidLayoutChange` -> `session.layout.set` flow
   * (dockview's serialized `GroupviewPanelState` includes `title`). */
  renamePanel(panelId: string, title: string): void;
  /** Whether the given panel may be closed — false only for the permanent
   * "chat" panel (mirrors the guard already built into
   * `closeActiveTerminalPanel`). */
  canClosePanel(panelId: string): boolean;
  /** Whether the given panel's group is currently the maximized group. */
  isPanelMaximized(panelId: string): boolean;
}

let controller: DockviewController | null = null;

export function registerDockviewController(c: DockviewController | null): void {
  controller = c;
}

export function getDockviewController(): DockviewController | null {
  return controller;
}

function newPanelId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `terminal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Build a controller bound to a live dockview `api` instance. */
export function createDockviewController(api: DockviewApi): DockviewController {
  return {
    addTerminalPanel(direction) {
      const referencePanel = api.activePanel?.id ?? "chat";
      api.addPanel({
        id: newPanelId(),
        component: "terminal",
        title: "Terminal",
        position: { referencePanel, direction },
      });
    },
    closeActiveTerminalPanel() {
      const active = api.activePanel;
      if (!active || active.id === "chat") return;
      api.removePanel(active);
    },
    toggleMaximizeActive() {
      if (api.hasMaximizedGroup()) {
        api.exitMaximizedGroup();
        return;
      }
      const active = api.activePanel;
      if (active) api.maximizeGroup(active);
    },
    setActivePanel(panelId) {
      const panel = api.panels.find((p) => p.id === panelId);
      panel?.api.setActive();
    },
    renamePanel(panelId, title) {
      const panel = api.panels.find((p) => p.id === panelId);
      panel?.api.setTitle(title);
    },
    canClosePanel(panelId) {
      return panelId !== "chat";
    },
    isPanelMaximized(panelId) {
      const panel = api.panels.find((p) => p.id === panelId);
      return panel?.api.isMaximized() ?? false;
    },
  };
}
