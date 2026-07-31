import { useCallback, useEffect, useRef, useState } from "react";
import {
  DockviewDefaultTab,
  DockviewReact,
  themeAbyss,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewHeaderActionsProps,
  type IDockviewPanelHeaderProps,
  type IDockviewPanelProps,
} from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { ChatView } from "../views/Chat";
import { TerminalView } from "../views/Terminal";
import { usePerchStore } from "../store";
import { createDockviewController, getDockviewController, registerDockviewController } from "./dockviewController";
import { PaneContextMenu } from "../components/PaneContextMenu";
import { usePaneLabelsEnabled } from "../paneLabels";

/** Info needed to render `<PaneContextMenu>` for a right-clicked tab. Module
 * state (not React state) because `PaneTab` is a stable module-level
 * function passed to dockview-react as `defaultTabComponent` — dockview
 * renders it outside `DockviewShell`'s own tree, so it can't reach a
 * `useState` setter via props/context without prop-drilling through
 * dockview's own component config (which doesn't support extra params for
 * the *default* tab component). Mirrors the `dockviewController.ts`
 * register/get pattern already used to bridge `keybinds.ts` into this
 * module-level-singleton shell. */
let openPaneContextMenu: ((panelId: string, title: string, x: number, y: number) => void) | null = null;

/** Custom tab renderer applied to every dockview panel (chat + terminals),
 * layering a right-click context menu on top of the stock `DockviewDefaultTab`
 * look (drag handle, active styling, built-in close button, etc.). Also
 * renders the Wave 2 item 12 "active agent" badge on the "chat" panel's tab
 * (e.g. "Chat · claude") when the pane-labels setting is enabled — dockview's
 * own `Tab` wrapper element (which owns click/drag/context-menu handling)
 * wraps whatever this component renders as a plain child, and `.dv-default-
 * tab`'s CSS is a *descendant* selector (`.dv-tab .dv-default-tab`, not a
 * direct-child one), so nesting `DockviewDefaultTab` one level deeper inside
 * our own wrapper div is visually and behaviorally transparent. */
function PaneTab(props: IDockviewPanelHeaderProps) {
  const paneLabelsEnabled = usePaneLabelsEnabled();
  const agent = usePerchStore((s) => s.agent);
  const showAgentBadge = props.api.id === "chat" && paneLabelsEnabled;
  return (
    <div
      className="pane-tab"
      data-testid={`pane-tab-${props.api.id}`}
      onContextMenu={(e: React.MouseEvent) => {
        e.preventDefault();
        openPaneContextMenu?.(props.api.id, props.api.title ?? "", e.clientX, e.clientY);
      }}
    >
      <DockviewDefaultTab {...props} />
      {showAgentBadge && (
        // NOT "pane-tab-agent-badge": e2e's `nonChatTab()`/`[data-testid^="pane-tab-"]`
        // locators (pane-splitting.spec.ts, wave2.spec.ts) match on that
        // prefix to find the *real* terminal tab, and would otherwise also
        // match this badge, causing a Playwright strict-mode violation.
        <span className="pane-tab__agent-badge" data-testid="chat-tab-agent-badge">
          · {agent}
        </span>
      )}
    </div>
  );
}

function ChatPanel() {
  return <ChatView />;
}

function TerminalPanel(props: IDockviewPanelProps) {
  const [active, setActive] = useState(props.api.isVisible);

  useEffect(() => {
    setActive(props.api.isVisible);
    const disposable = props.api.onDidVisibilityChange((e) => setActive(e.isVisible));
    return () => disposable.dispose();
  }, [props.api]);

  return <TerminalView active={active} />;
}

const components = {
  chat: ChatPanel,
  terminal: TerminalPanel,
};

/** Group-header "+" action (Bug 3): dockview applies `rightHeaderActionsComponent`
 * to every group uniformly, so this self-filters to only render for a group
 * that actually holds a terminal panel (never the "chat" group — there's only
 * ever one chat panel and it must never gain a sibling tab this way). Clicking
 * it adds a new terminal as a TAB within this same group (`direction: "within"`)
 * rather than a new split panel, so repeated use of "Open terminal" -> "+"
 * grows one group's tab bar instead of stacking panels across the layout. */
function TerminalGroupHeaderActions({ panels }: IDockviewHeaderActionsProps) {
  const terminalPanel = panels.find((p) => p.id !== "chat");
  if (!terminalPanel) return null;
  return (
    <button
      type="button"
      className="dockview-group-action dockview-group-action--add-terminal"
      data-testid="terminal-add-tab"
      title="Add terminal"
      aria-label="Add terminal"
      onClick={() => getDockviewController()?.addTerminalTabInGroup(terminalPanel.id)}
    >
      +
    </button>
  );
}

const LAYOUT_SAVE_DEBOUNCE_MS = 500;

/** Blank/no-saved-layout/corrupt-JSON fallback: single Chat panel, matching
 * the shell's pre-Phase-3 default.
 *
 * `handleReady` already seeds this exact single-panel layout on mount, and
 * every brand-new session's first `session.layout` reply is `layout: null`
 * (nothing saved yet) — a very common case. If the live layout already IS
 * the default, skip the clear()+addPanel() churn: `clear()` disposes and
 * `addPanel()` re-creates the panel's component instance, which would
 * needlessly unmount/remount `ChatView` (discarding in-progress local state
 * such as unsent typed text) purely to reproduce the layout that's already
 * showing. */
function applyDefaultLayout(api: DockviewApi) {
  const panels = api.panels;
  if (panels.length === 1 && panels[0]?.id === "chat") return;
  api.clear();
  api.addPanel({ id: "chat", component: "chat", title: "Chat" });
}

export function DockviewShell({ onReady }: { onReady?: (api: DockviewApi) => void }) {
  const apiRef = useRef<DockviewApi | null>(null);
  const sessionId = usePerchStore((s) => s.sessionId);
  const sessionLayouts = usePerchStore((s) => s.sessionLayouts);
  const fetchSessionLayout = usePerchStore((s) => s.fetchSessionLayout);
  const saveSessionLayout = usePerchStore((s) => s.saveSessionLayout);

  // Phase 5: right-click context menu state for the currently-targeted tab
  // (null when no menu is open). Populated via the module-level
  // `openPaneContextMenu` bridge set below so `PaneTab` (rendered by
  // dockview outside this component's own tree) can reach this state.
  const [contextMenu, setContextMenu] = useState<{ panelId: string; title: string; x: number; y: number } | null>(
    null,
  );

  // Unregister the dockview controller (Phase 4 keybindings) on unmount so
  // a stale controller pointing at a disposed api never lingers. Also wires
  // (and tears down) the Phase 5 pane-context-menu bridge.
  useEffect(() => {
    openPaneContextMenu = (panelId, title, x, y) => setContextMenu({ panelId, title, x, y });
    return () => {
      registerDockviewController(null);
      openPaneContextMenu = null;
    };
  }, []);

  // Which session's layout is currently materialized in the live dockview
  // instance, for the *current activation* (reset to null every time
  // sessionId changes, even if we've visited this same session before — see
  // the fetch effect below for why re-visits must not reuse a stale cache
  // hit). Lets the onDidLayoutChange listener know who to save against, and
  // lets the apply effect know it's already handled this activation.
  const appliedSessionIdRef = useRef<string | null>(null);
  // Guards onDidLayoutChange from persisting a layout WE are in the middle of
  // programmatically restoring (fromJSON/clear/addPanel all fire the event).
  const restoringRef = useRef(false);
  // Debounced-save bookkeeping. A pending save always records which session
  // it belongs to (captured at the time of the layout-change event, not at
  // timer-fire time) and the snapshot to send, so a fast session switch can
  // flush it immediately instead of silently dropping the edit.
  const pendingSaveRef = useRef<{ sessionId: string; snapshot: unknown } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPendingSave = useCallback(() => {
    if (saveTimerRef.current != null) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingSaveRef.current;
    if (pending) {
      pendingSaveRef.current = null;
      saveSessionLayout(pending.sessionId, pending.snapshot);
    }
  }, [saveSessionLayout]);

  const handleReady = useCallback(
    (event: DockviewReadyEvent) => {
      apiRef.current = event.api;
      // Default panel so the shell never renders empty while the first
      // session.layout round-trip is in flight.
      event.api.addPanel({ id: "chat", component: "chat", title: "Chat" });
      onReady?.(event.api);

      // Phase 4: expose this dockview instance to keybinds.ts (leader,x/v/-/z)
      // via the module-level controller — see dockviewController.ts for why.
      registerDockviewController(createDockviewController(event.api));

      event.api.onDidLayoutChange(() => {
        if (restoringRef.current) return;
        const activeId = appliedSessionIdRef.current;
        if (!activeId) return;
        pendingSaveRef.current = { sessionId: activeId, snapshot: event.api.toJSON() };
        if (saveTimerRef.current != null) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(flushPendingSave, LAYOUT_SAVE_DEBOUNCE_MS);
      });
    },
    [onReady, flushPendingSave],
  );

  // On every session switch: flush any pending save for the session being
  // left, mark this activation as "not yet applied", and — critically —
  // synchronously invalidate any cache entry left over from a *previous*
  // activation of this same session before asking the server for a fresh
  // one. Re-visiting a session (A -> B -> A) would otherwise find A's old
  // cache entry (fetched before this test's edits were saved) still
  // present, apply it immediately as a "flash", and later ignore the real
  // reply because the effect below only re-applies once per activation.
  // Worse, that flash is a *real* dockview mutation (clear+addPanel), which
  // can itself trigger onDidLayoutChange asynchronously and queue a save
  // that then overwrites the correct persisted layout once flushed. The
  // invalidation below is done via getState()/setState() rather than the
  // `sessionLayouts` value from the hook, so the apply effect (which also
  // reads via getState()) sees it has been cleared within this same commit
  // — plain `useState`/store-subscription values from this render's closure
  // would still show the stale entry until a subsequent render.
  useEffect(() => {
    if (!sessionId) return;
    flushPendingSave();
    appliedSessionIdRef.current = null;
    usePerchStore.setState((state) => {
      if (!(sessionId in state.sessionLayouts)) return state;
      const next = { ...state.sessionLayouts };
      delete next[sessionId];
      return { sessionLayouts: next };
    });
    fetchSessionLayout(sessionId);
  }, [sessionId, fetchSessionLayout, flushPendingSave]);

  // Apply the layout once the server's reply for the *current* activation
  // has landed (a session switch can happen well before the round-trip
  // resolves). Reads the live store state directly rather than the
  // `sessionLayouts` value captured by this render's hook subscription, so
  // it reliably observes the invalidation performed by the effect above
  // within the same commit (see comment there).
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !sessionId) return;
    if (appliedSessionIdRef.current === sessionId) return; // already applied this activation

    const current = usePerchStore.getState().sessionLayouts;
    if (!(sessionId in current)) return; // reply hasn't arrived yet (or was just invalidated)
    const layout = current[sessionId];

    restoringRef.current = true;
    try {
      if (layout) {
        // Stale-terminal-panel policy: a saved layout's "terminal" panel
        // entries carry only a dockview-internal panel id, never a backend
        // PTY/terminal id — `TerminalView` always spawns a brand-new PTY on
        // mount regardless of that id (see views/Terminal.tsx). So there is
        // nothing "stale" to reconcile: restoring old terminal panes just
        // respawns fresh shells in the same pane positions, which is the
        // simplest robust behavior and requires no special-casing here.
        api.fromJSON(layout as Parameters<DockviewApi["fromJSON"]>[0]);
      } else {
        applyDefaultLayout(api);
      }
    } catch {
      // Corrupt/incompatible JSON (e.g. saved by a different dockview
      // version) — fall back to the default layout instead of crashing.
      applyDefaultLayout(api);
    } finally {
      restoringRef.current = false;
      appliedSessionIdRef.current = sessionId;
    }
    // sessionLayouts is intentionally in the dependency array (to re-run
    // this effect when a new reply arrives) even though the value used
    // inside is read fresh via getState().
  }, [sessionId, sessionLayouts]);

  return (
    <>
      <DockviewReact
        className="dockview-theme-perch"
        theme={themeAbyss}
        components={components}
        defaultTabComponent={PaneTab}
        rightHeaderActionsComponent={TerminalGroupHeaderActions}
        onReady={handleReady}
      />
      {contextMenu &&
        (() => {
          const controller = getDockviewController();
          if (!controller) return null;
          return (
            <PaneContextMenu
              panelId={contextMenu.panelId}
              title={contextMenu.title}
              x={contextMenu.x}
              y={contextMenu.y}
              controller={controller}
              onClose={() => setContextMenu(null)}
            />
          );
        })()}
    </>
  );
}
