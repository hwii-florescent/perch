/**
 * dockviewController.ts — a small module-level indirection so non-React code
 * (`keybinds.ts`, which is a plain event-listener hook, not a component that
 * can hold a dockview `api` prop) can drive the single global dockview
 * instance (`DockviewShell`) for the Phase 4/Wave 2 pane keybindings
 * (leader,x/v/_/z/h/j/k/l/o/}/+/-) without reaching into an ad-hoc global
 * (`window.__dockviewApi`, etc.).
 *
 * `DockviewShell` registers a controller on mount (once `api` is available)
 * and unregisters it on unmount. `getDockviewController()` returns `null`
 * before the shell has mounted or after it unmounts — callers must treat a
 * missing controller as a no-op, not an error, since keybinds can fire before
 * the dockview instance exists (e.g. very early in a page's lifecycle).
 */
import type { DockviewApi, DockviewGroupPanel, Position } from "dockview-react";

/** Directions accepted by `focusPaneDirection` — mirrors dockview-core's own
 * `GroupNavigationDirection` (dockview-react re-exports dockview-core's types
 * wholesale via the `dockview` package, so importing from "dockview-react"
 * needs no extra direct dependency). */
export type PaneDirection = "left" | "right" | "up" | "down";

/** Pixel step used by `growActivePane`/`shrinkActivePane` per chord press. */
const RESIZE_STEP_PX = 60;
const MIN_PANE_PX = 80;

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
  /** Whether at least one terminal panel currently exists (any panel whose id
   * isn't "chat" — this shell only ever has "chat" and "terminal" panels).
   * Backs the toolbar "Open terminal" button's toggle affordance. */
  hasTerminalOpen(): boolean;
  /** Number of terminal panels currently open (any panel whose id isn't
   * "chat"), regardless of how they're split across groups or grouped as
   * tabs. Used to gate the close-confirmation dialog (Wave 1 item 6) — only
   * shown when `toggleTerminalGroup()` is about to close more than one. */
  terminalPanelCount(): number;
  /** Toolbar "Open terminal" button behavior: if no terminal panel exists,
   * open one split below "chat" (same placement the button always used).
   * If any terminal panel(s) already exist — regardless of how many separate
   * groups they're spread across via splits — close all of them, collapsing
   * back to the single "chat" panel and resetting the toggle to "closed".
   * Deriving open/closed from live panel state (rather than tracking a
   * separate boolean) means the toggle self-corrects no matter how a
   * terminal pane was closed (this button, the pane context menu's "Close",
   * or a tab's own close button). */
  toggleTerminalGroup(): void;
  /** Add a new terminal panel as a TAB within the same group as
   * `referencePanelId`, instead of a new split. Backs the "+" action shown
   * in a terminal group's own header (see `DockviewShell.tsx`'s
   * `rightHeaderActionsComponent`), so opening more terminals from an
   * already-open group grows that group's tab bar rather than stacking new
   * panels. */
  addTerminalTabInGroup(referencePanelId: string): void;
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
  /** Wave 2 item 8: move dockview's active-group focus to the nearest group
   * spatially adjacent to the current active group in `direction` (comparing
   * group centre points, via dockview-core's `adjacentGroupInDirection`).
   * No-op if there is no active group, or no group in that direction (e.g.
   * pressing "focus right" while already in the rightmost pane). */
  focusPaneDirection(direction: PaneDirection): void;
  /** Cycle dockview's focus to the next panel/group in tab order (wraps
   * around). Backs leader,o. */
  cycleToNextPane(): void;
  /** Swap the active group with the "next" group (cyclic order of
   * `api.groups`) by moving the active group to sit on whichever side the
   * next group currently occupies — for the common two-way split this
   * exchanges their screen positions. No-op with fewer than two groups.
   * Backs leader,}. */
  swapActivePaneWithNext(): void;
  /** Grow the active group by `RESIZE_STEP_PX`, along whichever axis is
   * actually split (compares the group's bounding box against the total
   * dockview size). No-op with only one group. Backs leader,+. */
  growActivePane(): void;
  /** Shrink the active group by `RESIZE_STEP_PX` (floored at `MIN_PANE_PX`),
   * along whichever axis is actually split. No-op with only one group.
   * Backs leader,-. */
  shrinkActivePane(): void;
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
    hasTerminalOpen() {
      return api.panels.some((p) => p.id !== "chat");
    },
    terminalPanelCount() {
      return api.panels.filter((p) => p.id !== "chat").length;
    },
    toggleTerminalGroup() {
      const terminalPanels = api.panels.filter((p) => p.id !== "chat");
      if (terminalPanels.length > 0) {
        // Close every terminal panel — across however many split groups they
        // ended up in — collapsing back to just "chat" and resetting the
        // toggle to "closed". Removing a group's last panel disposes the
        // group itself, so this needs no separate group bookkeeping.
        for (const panel of terminalPanels) api.removePanel(panel);
        return;
      }
      api.addPanel({
        id: newPanelId(),
        component: "terminal",
        title: "Terminal",
        position: { referencePanel: "chat", direction: "below" },
      });
    },
    addTerminalTabInGroup(referencePanelId) {
      api.addPanel({
        id: newPanelId(),
        component: "terminal",
        title: "Terminal",
        position: { referencePanel: referencePanelId, direction: "within" },
      });
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
    focusPaneDirection(direction) {
      const active = api.activeGroup;
      if (!active) return;
      const target = api.adjacentGroupInDirection(active, direction);
      target?.api.setActive();
    },
    cycleToNextPane() {
      api.moveToNext({ includePanel: true });
    },
    swapActivePaneWithNext() {
      const groups: DockviewGroupPanel[] = api.groups;
      if (groups.length < 2) return;
      const active = api.activeGroup;
      if (!active) return;
      const idx = groups.indexOf(active);
      const next = groups[(idx + 1) % groups.length];
      if (!next || next === active) return;

      const activeBox = active.api.boundingBox;
      const nextBox = next.api.boundingBox;
      // Insert `active` on whichever side `next` currently occupies relative
      // to `active` — for a simple two-way split this exchanges their visual
      // order (e.g. left|right becomes right|left). Falls back to "right"
      // when geometry isn't available yet (e.g. not yet laid out).
      let position: Position = "right";
      if (activeBox && nextBox) {
        const dx = nextBox.left - activeBox.left;
        const dy = nextBox.top - activeBox.top;
        if (Math.abs(dx) >= Math.abs(dy)) {
          position = dx >= 0 ? "right" : "left";
        } else {
          position = dy >= 0 ? "bottom" : "top";
        }
      }
      active.api.moveTo({ group: next, position });
    },
    growActivePane() {
      resizeActivePane(api, RESIZE_STEP_PX);
    },
    shrinkActivePane() {
      resizeActivePane(api, -RESIZE_STEP_PX);
    },
  };
}

/** Shared by `growActivePane`/`shrinkActivePane`: adjusts the active group's
 * size along whichever axis is actually split (its bounding box is smaller
 * than the whole dockview area on that axis), floored at `MIN_PANE_PX`. */
function resizeActivePane(api: DockviewApi, delta: number): void {
  if (api.groups.length < 2) return;
  const active = api.activeGroup;
  if (!active) return;
  const box = active.api.boundingBox;
  const width = box?.width ?? active.api.width;
  const height = box?.height ?? active.api.height;
  const splitHorizontally = width < api.width - 1;
  const splitVertically = height < api.height - 1;
  const next: { width?: number; height?: number } = {};
  if (splitHorizontally) next.width = Math.max(MIN_PANE_PX, width + delta);
  if (splitVertically) next.height = Math.max(MIN_PANE_PX, height + delta);
  if (next.width === undefined && next.height === undefined) return;
  active.api.setSize(next);
}
