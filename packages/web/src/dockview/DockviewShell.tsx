import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DockviewDefaultTab,
  DockviewReact,
  positionToDirection,
  themeAbyss,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewHeaderActionsProps,
  type IDockviewPanelHeaderProps,
  type IDockviewPanelProps,
} from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import "./paneSplit.css";
import { ChatView } from "../views/Chat";
import { TerminalView } from "../views/Terminal";
import { usePerchStore } from "../store";
import {
  createDockviewController,
  getDockviewController,
  panelKind,
  registerDockviewController,
  sessionChatPanelSessionId,
} from "./dockviewController";
import { PaneContextMenu } from "../components/PaneContextMenu";
import { SessionSplitPopover } from "./SessionSplitPopover";
import { isSessionDrag, readSessionDragId } from "./sessionDrag";
import { usePaneLabelsEnabled } from "../paneLabels";
import { WorkspaceFilesView } from "../components/WorkspaceFiles";
import { WorkspaceGitReviewPane } from "../components/WorkspaceGitReviewPane";

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

/** Same bridge pattern as `openPaneContextMenu` above, for the "split with
 * another session" picker (`SessionSplitPopover.tsx`) opened from
 * `PaneGroupHeaderActions`'s new button — that component is also rendered by
 * dockview outside `DockviewShell`'s own tree. */
let openSessionSplitPopover: ((referencePanelId: string, x: number, y: number) => void) | null = null;

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
  const agent = usePerchStore((s) => {
    const sessionId = typeof props.params?.sessionId === "string" ? props.params.sessionId : s.sessionId;
    if (!sessionId) return s.agent;
    const session = s.sessions.find((candidate) => candidate.id === sessionId);
    const mode = s.sessionModes[sessionId]?.mode ?? s.settings?.chatMode ?? "hosted";
    return mode === "cli" || session?.cliProviderId === "pi" || session?.cliProviderId === "omp"
      ? s.cliAgentBySession[sessionId] ?? session?.cliProviderId ?? s.agent
      : s.hostedAgentBySession[sessionId] ?? session?.lastAgent ?? s.agent;
  });
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

/** Renders a split-pane chat bound to a specific session (added via
 * `DockviewController.addSessionChatPanel` — the "Split with session" picker
 * or drag-and-drop, both below). `params.sessionId` is set at `addPanel`
 * time and round-trips through dockview's own layout persistence
 * (`toJSON`/`fromJSON`), so a restored layout reconstructs this with the
 * same binding automatically — no bespoke persistence code needed here.
 * The wrapper div carries the `session-pane-<id>` testid the task asked for;
 * `display: contents` keeps it out of the box tree entirely so it doesn't
 * disturb `ChatView`'s `.chat` height/flex model (see that file's own CSS
 * comment on its `.dv-react-part` parent contract). */
function SessionChatPanel(props: IDockviewPanelProps) {
  const sessionId = typeof props.params?.sessionId === "string" ? (props.params.sessionId as string) : undefined;
  if (!sessionId) {
    // Malformed/legacy params (shouldn't happen via addSessionChatPanel, but
    // a hand-edited or future-incompatible persisted layout could produce
    // one) — degrade instead of crashing.
    return <div className="inactive-session-pane">Session pane is missing its session id.</div>;
  }
  return (
    <div data-testid={`session-pane-${sessionId}`} style={{ display: "contents" }}>
      <ChatView sessionId={sessionId} />
    </div>
  );
}

function TerminalPanel(props: IDockviewPanelProps) {
  const [active, setActive] = useState(props.api.isVisible);
  const [ownerSessionId] = useState(() => usePerchStore.getState().sessionId ?? undefined);

  useEffect(() => {
    setActive(props.api.isVisible);
    const disposable = props.api.onDidVisibilityChange((e) => setActive(e.isVisible));
    return () => disposable.dispose();
  }, [props.api]);

  const paneId = typeof props.params?.shellPaneId === "string" ? props.params.shellPaneId : props.api.id;
  return <TerminalView active={active} paneId={paneId} sessionId={ownerSessionId} layoutPanelId={props.api.id}
    onPaneChange={(shellPaneId) => props.api.updateParameters({ shellPaneId })} />;
}

/** Workspace file panels are ordinary dockview components so the explorer,
 * editor, and its selected workspace travel with the user's saved mixed-pane
 * layout. The workspace id is carried in panel params and therefore survives
 * a session layout round trip without coupling Dockview to the filesystem
 * store. */
function FilesPanel(props: IDockviewPanelProps) {
  const workspaceId = typeof props.params?.workspaceId === "string"
    ? props.params.workspaceId
    : undefined;
  if (!workspaceId) {
    return <div className="inactive-session-pane">File pane is missing its workspace id.</div>;
  }
  const initialPath = typeof props.params?.path === "string" ? props.params.path : undefined;
  return (
    <WorkspaceFilesView
      workspaceId={workspaceId}
      initialPath={initialPath}
      onPathChange={(path) => props.api.updateParameters({ workspaceId, path })}
      onClose={() => props.api.close()}
    />
  );
}

/** Workspace Git/status/diff/review surface. Git data is keyed by the durable
 * workspace id carried in Dockview params, so a restored mixed layout cannot
 * accidentally display another project's branch or comments. */
function GitReviewPanel(props: IDockviewPanelProps) {
  const workspaceId = typeof props.params?.workspaceId === "string"
    ? props.params.workspaceId
    : undefined;
  if (!workspaceId) {
    return <div className="inactive-session-pane">Git pane is missing its workspace id.</div>;
  }
  return <WorkspaceGitReviewPane workspaceId={workspaceId} />;
}

const components = {
  chat: ChatPanel,
  terminal: TerminalPanel,
  sessionChat: SessionChatPanel,
  files: FilesPanel,
  gitReview: GitReviewPanel,
};

/** Group-header "+" action (Bug 3): dockview applies `rightHeaderActionsComponent`
 * to every group uniformly, so this self-filters to only render for a group
 * that actually holds a terminal panel (never the "chat" group — there's only
 * ever one chat panel and it must never gain a sibling tab this way). Clicking
 * it adds a new terminal as a TAB within this same group (`direction: "within"`)
 * rather than a new split panel, so repeated use of "Open terminal" -> "+"
 * grows one group's tab bar instead of stacking panels across the layout.
 *
 * The sibling "⋯" button next to it (`data-testid="pane-group-menu"`) is the
 * *discoverability* fix for split/zoom/rename/close: before this, the only
 * way to reach `PaneContextMenu` was a right-click on a tab, or memorizing
 * the `Ctrl+Space` leader chord — the chat group (a brand-new session's
 * *only* pane) had no visible affordance suggesting panes can be split at
 * all. This button renders in every group, including chat's, and opens the
 * exact same context menu the right-click already does, anchored under the
 * button instead of at a cursor position. */
function PaneGroupHeaderActions({ panels, activePanel }: IDockviewHeaderActionsProps) {
  // Classified by `component`, not "any panel whose id isn't chat" — a
  // session-chat panel's id is `session-chat-<sessionId>` (definitely not
  // "chat"), so the old id-based check would have wrongly treated a
  // session-chat group as a terminal group and rendered this "+" button
  // there too (which would then add a TERMINAL tab into someone's session
  // chat group). See dockviewController.ts's `panelKind`.
  const terminalPanel = panels.find((p) => panelKind(p) === "terminal");
  return (
    <>
      {terminalPanel && (
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
      )}
      {activePanel && (
        <button
          type="button"
          className="dockview-group-action dockview-group-action--split-session"
          data-testid="pane-split-session"
          title="Split with another session"
          aria-label="Split with another session"
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
            const rect = e.currentTarget.getBoundingClientRect();
            openSessionSplitPopover?.(activePanel.id, rect.right, rect.bottom);
          }}
        >
          ⛶
        </button>
      )}
      {activePanel && (
        <button
          type="button"
          className="dockview-group-action dockview-group-action--pane-menu"
          data-testid="pane-group-menu"
          title="Split / zoom / rename / close pane"
          aria-label="Split / zoom / rename / close pane"
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
            const rect = e.currentTarget.getBoundingClientRect();
            openPaneContextMenu?.(activePanel.id, activePanel.title ?? "", rect.right, rect.bottom);
          }}
        >
          ⋯
        </button>
      )}
    </>
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
  const [readyApi, setReadyApi] = useState<DockviewApi | null>(null);
  const sessionId = usePerchStore((s) => s.sessionId);
  const sessions = usePerchStore((s) => s.sessions);
  const sessionLayouts = usePerchStore((s) => s.sessionLayouts);
  const workspaceFilesWorkspaceId = usePerchStore((s) => s.workspaceFilesWorkspaceId);
  const closeWorkspaceFiles = usePerchStore((s) => s.closeWorkspaceFiles);
  const workspaceGitReviewWorkspaceId = usePerchStore((s) => s.workspaceGitReviewWorkspaceId);
  const closeWorkspaceGitReview = usePerchStore((s) => s.closeWorkspaceGitReview);
  const fetchSessionLayout = usePerchStore((s) => s.fetchSessionLayout);
  const saveSessionLayout = usePerchStore((s) => s.saveSessionLayout);

  // Phase 5: right-click context menu state for the currently-targeted tab
  // (null when no menu is open). Populated via the module-level
  // `openPaneContextMenu` bridge set below so `PaneTab` (rendered by
  // dockview outside this component's own tree) can reach this state.
  const [contextMenu, setContextMenu] = useState<{ panelId: string; title: string; x: number; y: number } | null>(
    null,
  );

  // "Split with another session" picker state — which group's header button
  // opened it (`referencePanelId`, so the pick/drag target lands there) and
  // where to anchor it. Same module-level-bridge pattern as `contextMenu`
  // above, since `PaneGroupHeaderActions` also renders outside this tree.
  const [sessionSplit, setSessionSplit] = useState<{ referencePanelId: string; x: number; y: number } | null>(null);

  // Unregister the dockview controller (Phase 4 keybindings) on unmount so
  // a stale controller pointing at a disposed api never lingers. Also wires
  // (and tears down) the Phase 5 pane-context-menu bridge and the
  // session-split-popover bridge.
  useEffect(() => {
    openPaneContextMenu = (panelId, title, x, y) => setContextMenu({ panelId, title, x, y });
    openSessionSplitPopover = (referencePanelId, x, y) => setSessionSplit({ referencePanelId, x, y });
    return () => {
      registerDockviewController(null);
      openPaneContextMenu = null;
      openSessionSplitPopover = null;
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
  const savedPanelIdsRef = useRef("");

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

  useEffect(() => {
    window.addEventListener("pagehide", flushPendingSave);
    window.addEventListener("beforeunload", flushPendingSave);
    return () => {
      window.removeEventListener("pagehide", flushPendingSave);
      window.removeEventListener("beforeunload", flushPendingSave);
      flushPendingSave();
    };
  }, [flushPendingSave]);

  const handleReady = useCallback(
    (event: DockviewReadyEvent) => {
      apiRef.current = event.api;
      // A fast layout reply can precede Dockview's onReady callback. Ref
      // assignment alone would never rerun the restore effect in that case.
      setReadyApi(event.api);
      // Default panel so the shell never renders empty while the first
      // session.layout round-trip is in flight.
      event.api.addPanel({ id: "chat", component: "chat", title: "Chat" });
      onReady?.(event.api);

      // Phase 4: expose this dockview instance to keybinds.ts (leader,x/v/-/z)
      // via the module-level controller — see dockviewController.ts for why.
      const controller = createDockviewController(event.api);
      registerDockviewController(controller);
      // A click can arrive before Dockview has emitted onReady (especially
      // while restoring a cold page). Consume the pending navigation now
      // that a live controller exists instead of dropping the user's action.
      const pendingWorkspaceId = usePerchStore.getState().workspaceFilesWorkspaceId;
      if (pendingWorkspaceId) {
        controller.openFiles(pendingWorkspaceId);
        usePerchStore.getState().closeWorkspaceFiles();
      }
      const pendingGitWorkspaceId = usePerchStore.getState().workspaceGitReviewWorkspaceId;
      if (pendingGitWorkspaceId) {
        controller.openGitReview(pendingGitWorkspaceId);
        usePerchStore.getState().closeWorkspaceGitReview();
      }

      event.api.onDidLayoutChange(() => {
        if (restoringRef.current) return;
        const activeId = appliedSessionIdRef.current;
        if (!activeId) return;
        const snapshot = event.api.toJSON();
        pendingSaveRef.current = { sessionId: activeId, snapshot };
        const panelIds = Object.keys(snapshot.panels).sort().join("\0");
        // Opening/closing a pane is already a completed user action. Save it
        // immediately; only frequent layout/resize updates need debouncing.
        if (panelIds !== savedPanelIdsRef.current) {
          savedPanelIdsRef.current = panelIds;
          flushPendingSave();
          return;
        }
        if (saveTimerRef.current != null) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(flushPendingSave, LAYOUT_SAVE_DEBOUNCE_MS);
      });

      // Drag-and-drop a session (from `SessionSplitPopover.tsx`'s picker
      // list) onto any edge/centre of any group, splitting/tabbing it in as
      // that session's own chat panel — dockview's OWN native drop-target
      // overlay (the same highlight a terminal-tab drag already shows) does
      // all the hover/zone-detection work; we only opt our custom drag
      // payload into it (`onUnhandledDragOver`, which by default rejects any
      // drag that isn't dockview's own internal panel-move data) and read the
      // payload back out once dockview reports it as "unhandled" (`onDidDrop`
      // fires only for drags dockview itself didn't know how to process —
      // exactly external drags like this one). See `sessionDrag.ts`'s header
      // comment for the full mechanism.
      event.api.onUnhandledDragOver((e) => {
        if (e.nativeEvent instanceof DragEvent && isSessionDrag(e.nativeEvent.dataTransfer)) {
          e.accept();
        }
      });
      event.api.onDidDrop((e) => {
        if (!(e.nativeEvent instanceof DragEvent)) return;
        const draggedSessionId = readSessionDragId(e.nativeEvent.dataTransfer);
        if (!draggedSessionId) return; // not our drag — nothing to do
        const referencePanelId = e.panel?.id ?? e.group?.activePanel?.id ?? "chat";
        const direction = positionToDirection(e.position);
        const title = usePerchStore.getState().sessions.find((s) => s.id === draggedSessionId)?.title ?? "Session";
        getDockviewController()?.addSessionChatPanel(draggedSessionId, title, referencePanelId, direction);
      });
    },
    [onReady, flushPendingSave],
  );

  // WorkspaceOverview lives outside Dockview and records an intent in the
  // store. Turning that intent into a real panel here keeps navigation robust
  // across desktop/mobile shells and makes the file surface part of the same
  // persisted layout as chat and terminals.
  useEffect(() => {
    if (!workspaceFilesWorkspaceId) return;
    const controller = getDockviewController();
    if (!controller) return;
    controller.openFiles(workspaceFilesWorkspaceId);
    closeWorkspaceFiles();
  }, [closeWorkspaceFiles, workspaceFilesWorkspaceId]);

  useEffect(() => {
    if (!workspaceGitReviewWorkspaceId) return;
    const controller = getDockviewController();
    if (!controller) return;
    controller.openGitReview(workspaceGitReviewWorkspaceId);
    closeWorkspaceGitReview();
  }, [closeWorkspaceGitReview, workspaceGitReviewWorkspaceId]);

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
    const api = readyApi;
    if (!api || !sessionId) return;
    if (appliedSessionIdRef.current === sessionId) return; // already applied this activation

    const current = usePerchStore.getState().sessionLayouts;
    if (!(sessionId in current)) return; // reply hasn't arrived yet (or was just invalidated)
    const layout = current[sessionId];

    restoringRef.current = true;
    try {
      if (layout) {
        // Stable Dockview pane IDs reattach to server-owned shells. Restoring
        // a layout or changing viewport releases views without closing shells.
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
      savedPanelIdsRef.current = Object.keys(api.toJSON().panels).sort().join("\0");
    }
    // sessionLayouts is intentionally in the dependency array (to re-run
    // this effect when a new reply arrives) even though the value used
    // inside is read fresh via getState().
  }, [sessionId, sessionLayouts, readyApi]);

  return (
    <>
      <DockviewReact
        className="dockview-theme-perch"
        theme={themeAbyss}
        components={components}
        defaultTabComponent={PaneTab}
        rightHeaderActionsComponent={PaneGroupHeaderActions}
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
      {sessionSplit &&
        (() => {
          const controller = getDockviewController();
          const api = apiRef.current;
          if (!controller || !api) return null;
          // Exclude whichever session the triggering group is already
          // showing — splitting a pane with the very session it's already
          // bound to would just be a same-session duplicate.
          const excludeId = referencePanelSessionId(api, sessionSplit.referencePanelId, sessionId);
          const candidates = sessions.filter((s) => !s.archived && s.id !== excludeId);
          return (
            <SessionSplitPopover
              sessions={candidates}
              openSessionIds={controller.openSessionChatIds()}
              x={sessionSplit.x}
              y={sessionSplit.y}
              onPick={(pickedSessionId, title) =>
                controller.addSessionChatPanel(pickedSessionId, title, sessionSplit.referencePanelId, "right")
              }
              onClose={() => setSessionSplit(null)}
            />
          );
        })()}
    </>
  );
}

/** Which session (if any) `referencePanelId` is currently showing — "chat"
 * (the one permanent panel) shows `activeSessionId`; a `sessionChat` panel
 * shows whatever session id is in its own params. Used only to keep the
 * split-session picker from offering "split this pane with the session it's
 * already showing". */
function referencePanelSessionId(api: DockviewApi, referencePanelId: string, activeSessionId: string | null): string | undefined {
  if (referencePanelId === "chat") return activeSessionId ?? undefined;
  const panel = api.panels.find((p) => p.id === referencePanelId);
  return panel ? sessionChatPanelSessionId(panel) : undefined;
}
