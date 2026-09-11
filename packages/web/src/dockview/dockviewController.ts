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
import type { DockviewApi, DockviewGroupPanel, IDockviewPanel, Position } from "dockview-react";

/** Directions accepted by `focusPaneDirection` — mirrors dockview-core's own
 * `GroupNavigationDirection` (dockview-react re-exports dockview-core's types
 * wholesale via the `dockview` package, so importing from "dockview-react"
 * needs no extra direct dependency). */
export type PaneDirection = "left" | "right" | "up" | "down";

/** Pixel step used by `growActivePane`/`shrinkActivePane` per chord press. */
const RESIZE_STEP_PX = 60;
const MIN_PANE_PX = 80;

/** The one permanent panel's id — every shell always has exactly one of
 * these, it can never be closed, and it's the fallback split target when no
 * panel is active yet. */
const PRIMARY_CHAT_PANEL_ID = "chat";

/** dockview `component` key for a session-bound chat panel (`SessionChat-
 * Panel` in DockviewShell.tsx) — as opposed to `"chat"` (the one permanent
 * panel, bound to whatever session is globally active) or `"terminal"`. */
const SESSION_CHAT_COMPONENT = "sessionChat";
const TERMINAL_COMPONENT = "terminal";
const FILES_COMPONENT = "files";
const GIT_REVIEW_COMPONENT = "gitReview";

/** Coarse classification of a dockview panel used throughout this module —
 * and unit-tested directly (see dockviewController.test.ts) because getting
 * it wrong is exactly how a session chat panel would get counted/closed as a
 * "terminal" (or vice versa). Reads `panel.view.contentComponent`, the
 * `component` string a panel was created with — NOT `panel.id`. Panel ids
 * are per-instance (a session chat panel's id encodes its session id; a
 * terminal panel's id is a random uuid) and, before this fix, `"any panel
 * whose id isn't the literal string 'chat'"` was used as a stand-in for
 * "is a terminal" — true only as long as "chat" was the only other panel
 * kind that could ever exist. Adding session-bound chat panels broke that
 * assumption, so every "is this a terminal" check in this module now goes
 * through here instead. */
export type PanelKind = "chat" | "terminal" | "sessionChat" | "files" | "gitReview" | "other";

export function panelKind(panel: Pick<IDockviewPanel, "view">): PanelKind {
  switch (panel.view.contentComponent) {
    case "chat":
      return "chat";
    case TERMINAL_COMPONENT:
      return "terminal";
    case SESSION_CHAT_COMPONENT:
      return "sessionChat";
    case FILES_COMPONENT:
      return "files";
    case GIT_REVIEW_COMPONENT:
      return "gitReview";
    default:
      return "other";
  }
}

/** Reads a `sessionChat` panel's bound session id back out of its `params`
 * (set at `addPanel`/`addSessionChatPanel` time, and round-tripped verbatim
 * through dockview's own `toJSON`/`fromJSON` layout persistence). Returns
 * undefined for any panel that isn't a `sessionChat` panel, or one whose
 * params are missing/malformed (e.g. hand-edited persisted JSON). */
export function sessionChatPanelSessionId(panel: Pick<IDockviewPanel, "view" | "params">): string | undefined {
  if (panelKind(panel) !== "sessionChat") return undefined;
  const sessionId = (panel.params as { sessionId?: unknown } | undefined)?.sessionId;
  return typeof sessionId === "string" && sessionId.length > 0 ? sessionId : undefined;
}

/** Stable panel id for a given session's chat pane — deterministic so
 * `addSessionChatPanel` can find (and re-activate) an already-open pane for
 * the same session instead of opening a duplicate. */
function sessionChatPanelId(sessionId: string): string {
  return `session-chat-${sessionId}`;
}

/** Maps `PaneDirection` (vim-style, matching `focusPaneDirection`) to
 * dockview-core's `Position` (used by `moveTo`/`addPanel`) for
 * `swapPaneDirection`. */
const DIRECTION_TO_POSITION: Record<PaneDirection, Position> = {
  left: "left",
  right: "right",
  up: "top",
  down: "bottom",
};

export interface DockviewController {
  /** Add a new terminal panel split off the active panel (or "chat" if no
   * panel is active yet) in the given direction. Mirrors how the existing
   * toolbar "Open terminal" button (`App.tsx`) adds panels. */
  addTerminalPanel(direction: "right" | "below"): void;
  /** Close the active panel — unless it's the primary "chat" panel, which
   * must always remain (there is always exactly one Chat panel; "closing"
   * it would leave the session with no view). No-op if the active panel is
   * "chat" or if there is no active panel. Closes terminal panels AND
   * session-chat panels alike — "chat" is the only permanent one. */
  closeActiveTerminalPanel(): void;
  /** Whether at least one terminal panel currently exists (classified by
   * `panelKind`, i.e. `component === "terminal"` — NOT "any panel whose id
   * isn't chat", which would also match session-chat panels). Backs the
   * toolbar "Open terminal" button's toggle affordance. */
  hasTerminalOpen(): boolean;
  /** Number of terminal panels currently open (`panelKind(p) === "terminal"`),
   * regardless of how they're split across groups or grouped as tabs. Used to
   * gate the close-confirmation dialog (Wave 1 item 6) — only shown when
   * `toggleTerminalGroup()` is about to close more than one. */
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
  /** Swap the active group with its spatial neighbour in `direction` (the
   * same neighbour `focusPaneDirection` would focus, via
   * `adjacentGroupInDirection`) by moving the active group to sit exactly
   * where that neighbour currently is — for a two-way split this exchanges
   * their screen positions, matching herdr's `prefix+shift+h/j/k/l`. Focus
   * follows the moved pane (repeated swaps keep acting on the same content).
   * No-op if there is no active group or no neighbour in that direction.
   * Backs leader,H/J/K/L. */
  swapPaneDirection(direction: PaneDirection): void;
  /** Grow the active group by `RESIZE_STEP_PX`, along whichever axis is
   * actually split (compares the group's bounding box against the total
   * dockview size). No-op with only one group. Backs leader,+. */
  growActivePane(): void;
  /** Shrink the active group by `RESIZE_STEP_PX` (floored at `MIN_PANE_PX`),
   * along whichever axis is actually split. No-op with only one group.
   * Backs leader,-. */
  shrinkActivePane(): void;
  /** Add (or, if one is already open, re-activate) a chat panel bound to
   * `sessionId`, split off `referencePanelId` in `direction`. `direction`
   * uses dockview's `Direction` vocabulary ("above"/"below"/"left"/"right"/
   * "within" — "within" adds it as a tab in the reference panel's group
   * rather than splitting). `title` is shown on the panel's tab. Backs both
   * the click-to-split session picker and the drag-and-drop path (see
   * `SessionSplitPopover.tsx` / `DockviewShell.tsx`'s drag handlers). */
  addSessionChatPanel(sessionId: string, title: string, referencePanelId: string, direction: Direction): void;
  /** Open the workspace-scoped file surface as a real dockview panel. A
   * deterministic id keeps one editor surface per workspace and lets the
   * persisted dockview layout restore its workspace binding. */
  openFiles(workspaceId: string, title?: string): void;
  /** Open the workspace-scoped Git/status/diff/review surface in the saved
   * dockview layout. A deterministic id prevents duplicate review panes. */
  openGitReview(workspaceId: string, title?: string): void;
  /** Session ids that currently have an open (or grouped-as-tab) chat panel
   * in this shell — used to grey out / relabel already-open sessions in the
   * split-session picker rather than let it silently create a duplicate. */
  openSessionChatIds(): string[];
}

/** Re-exported so callers (the split-session picker, DockviewShell's drag
 * handlers) can name a split direction without importing dockview-core
 * directly — mirrors how `Position` is already re-exported via the
 * `dockview-react` import above. */
export type Direction = "left" | "right" | "above" | "below" | "within";

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
      const referencePanel = api.activePanel?.id ?? PRIMARY_CHAT_PANEL_ID;
      api.addPanel({
        id: newPanelId(),
        component: TERMINAL_COMPONENT,
        title: "Terminal",
        position: { referencePanel, direction },
      });
    },
    closeActiveTerminalPanel() {
      const active = api.activePanel;
      if (!active || active.id === PRIMARY_CHAT_PANEL_ID) return;
      api.removePanel(active);
    },
    hasTerminalOpen() {
      return api.panels.some((p) => panelKind(p) === "terminal");
    },
    terminalPanelCount() {
      return api.panels.filter((p) => panelKind(p) === "terminal").length;
    },
    toggleTerminalGroup() {
      const terminalPanels = api.panels.filter((p) => panelKind(p) === "terminal");
      if (terminalPanels.length > 0) {
        // Close every terminal panel — across however many split groups they
        // ended up in — collapsing back to just "chat" (and any session-chat
        // panels, which this toggle never touches) and resetting the toggle
        // to "closed". Removing a group's last panel disposes the group
        // itself, so this needs no separate group bookkeeping.
        for (const panel of terminalPanels) api.removePanel(panel);
        return;
      }
      api.addPanel({
        id: newPanelId(),
        component: TERMINAL_COMPONENT,
        title: "Terminal",
        position: { referencePanel: PRIMARY_CHAT_PANEL_ID, direction: "below" },
      });
    },
    addTerminalTabInGroup(referencePanelId) {
      api.addPanel({
        id: newPanelId(),
        component: TERMINAL_COMPONENT,
        title: "Terminal",
        position: { referencePanel: referencePanelId, direction: "within" },
      });
    },
    addSessionChatPanel(sessionId, title, referencePanelId, direction) {
      const id = sessionChatPanelId(sessionId);
      const existing = api.panels.find((p) => p.id === id);
      if (existing) {
        existing.api.setActive();
        return;
      }
      const reference = api.panels.some((p) => p.id === referencePanelId)
        ? referencePanelId
        : (api.activePanel?.id ?? PRIMARY_CHAT_PANEL_ID);
      api.addPanel({
        id,
        component: SESSION_CHAT_COMPONENT,
        title,
        params: { sessionId },
        position: { referencePanel: reference, direction },
      });
    },
    openFiles(workspaceId, title) {
      if (!workspaceId) return;
      const id = `files-${workspaceId}`;
      const existing = api.panels.find((panel) => panel.id === id);
      if (existing) {
        existing.api.setActive();
        return;
      }
      const referencePanel = api.activePanel?.id ?? PRIMARY_CHAT_PANEL_ID;
      api.addPanel({
        id,
        component: FILES_COMPONENT,
        title: title || "Files",
        params: { workspaceId },
        position: { referencePanel, direction: "right" },
      });
    },
    openGitReview(workspaceId, title) {
      if (!workspaceId) return;
      const id = `git-review-${workspaceId}`;
      const existing = api.panels.find((panel) => panel.id === id);
      if (existing) {
        existing.api.setActive();
        return;
      }
      const referencePanel = api.activePanel?.id ?? PRIMARY_CHAT_PANEL_ID;
      api.addPanel({
        id,
        component: GIT_REVIEW_COMPONENT,
        title: title || "Git & review",
        params: { workspaceId },
        position: { referencePanel, direction: "right" },
      });
    },
    openSessionChatIds() {
      return api.panels.map((p) => sessionChatPanelSessionId(p)).filter((id): id is string => id !== undefined);
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
      return panelId !== PRIMARY_CHAT_PANEL_ID;
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
    swapPaneDirection(direction) {
      const active = api.activeGroup;
      if (!active) return;
      const adjacent = api.adjacentGroupInDirection(active, direction);
      if (!adjacent || adjacent === active) return;
      // `adjacentGroupInDirection` returns the narrower `IDockviewGroupPanel`
      // view; `moveTo` needs the concrete `DockviewGroupPanel` from
      // `api.groups` (same instance, just the wider type `swapActivePane-
      // WithNext` above already works with).
      const target = api.groups.find((g) => g.id === adjacent.id);
      if (!target || target === active) return;
      // Move the active group to sit where `target` is — `position` uses the
      // *same* direction that located `target` (e.g. direction "left" found
      // a neighbour to the left, and moving active to "left" of that
      // neighbour puts active exactly there), which swaps the two groups'
      // positions for the common two-way-split case.
      active.api.moveTo({ group: target, position: DIRECTION_TO_POSITION[direction] });
      // Focus follows the moved pane — repeated leader,H/J/K/L should keep
      // acting on the same content, the way repeated tmux pane-swaps do.
      active.api.setActive();
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
