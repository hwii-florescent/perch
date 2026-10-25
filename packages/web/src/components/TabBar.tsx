import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { usePerchStore, effectiveActiveProject, effectiveWorkspace } from "../store";
import { NewSessionPopover } from "../Sidebar";
import { useTabOrderVersion } from "../tabOrder";
import { isBlankBrowser, openBlankBrowser, useFileTabs, type FileTab } from "../fileTabs";
import { FileEntryMenu } from "./FileEntryMenu";
import { activateTab, sessionLabel, tabName, workspaceTabs, type TabEntry } from "../workspaceTabs";
import { useSplitSets } from "../splitSets";
import { TAB_PANE_CLASS, tabPaneStates, type TabPaneState } from "../tabPaneState";
import { beginTabDrag, useTabDrag } from "../tabDrag";
import { TabDragLayer } from "./TabDragLayer";
import { TabSplitMenu } from "./TabSplitMenu";
import { useWorkspaceFilesStore } from "../filesystemStore";
import { segment } from "./ui/segment";
import { NEW_TAB_EVENT } from "../appEvents";
import { requestCloseSession } from "../closeGuard";

// Every tab sits in a wrapper that reserves room for its x (pr-[1.6rem]).
// Operational text uses subtext-0: on surface-0 and panel-bg it contrasts at least as much as
// overlay-1 in every theme (themes.test.ts). The palettes set the absolute level.
// The strip scrolls (overflow-x-auto), which clips outlines, so focus rings sit inside (-2px).
const FOCUS = "focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]";
const TAB = `min-w-0 flex-1 text-left px-3 pr-[1.6rem] text-[0.8rem] leading-[1.2] whitespace-nowrap ${FOCUS}`;
// Small gutters inset each tab from its neighbors and the strip edge, like a browser tab bar.
const TAB_SLOT = "relative flex min-w-[7rem] max-w-[16rem] flex-1 basis-0 items-stretch";
// "square" is the shell's soft corner (--radius-pane), not a literal square.
const TAB_SHAPE = (shape: "square" | "round") => shape === "round" ? "rounded-full" : "rounded-ui";
const CLOSE = `absolute top-1/2 right-[0.25rem] h-[1.25rem] w-[1.25rem] cursor-pointer rounded-ui bg-transparent p-0 text-[0.9rem] leading-none text-subtext-0 [border:0] [font-family:inherit] [transform:translateY(-50%)] hover:text-fg ${FOCUS}`;
// The focused tab is filled, so its x hovers on panel-bg: fg is drawn against it in every theme
// (overlay-0 is fg-coloured in the terminal theme and hid the x).
const closeButton = (state: TabPaneState) => cn(CLOSE, state === "focused" ? "text-fg hover:bg-panel-bg" : "hover:bg-surface-1");

/**
 * Tab strip for the sessions of the *current workspace*: a project checkout
 * or one of its git worktrees (`effectiveWorkspace` in `store/selectors.ts`),
 * the same scope the Files/Git drawer follows. Where the host has no
 * workspace records it falls back to the project, the `(hostId, cwd)` pair
 * the sidebar is scoped to (`effectiveActiveProject`). The strip always
 * contains the current session's siblings.
 *
 * Clicking a tab reuses the existing `switchSession` action (same as the
 * sidebar); double-clicking a tab renames it (Wave 1 item 2, inline input).
 * Dragging a tab (`tabDrag.ts`) reorders it within the strip, or splits the
 * canvas when dropped on a side of a pane; the order is persisted client-side
 * *per workspace* via `tabOrder.ts` (no protocol field for tab order exists
 * or is added). The trailing "+" opens
 * the CLI picker (`NewSessionPopover`) for this workspace's path on its host;
 * with no workspace it uses the active project's cwd, and the sidebar's
 * "+ New session" button keeps picking a *different* folder one click away.
 *
 * Files opened from the drawer's explorer sit after the sessions, before "+"
 * (`fileTabs.ts`); the active one replaces the session view in the main area.
 * Right-clicking a session tab opens its pane menu (split, zoom, stop agent),
 * since a single-pane layout shows no pane header.
 *
 * The strip has no split marker: the canvas shows a split, and the tabs show which
 * panes are on screen (subdued fill) and which has focus (stronger fill, heavier
 * text). See `tabPaneState.ts`.
 */
export function TabBar() {
  const sessionId = usePerchStore((s) => s.sessionId);
  const sessions = usePerchStore((s) => s.sessions);
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const activeProject = usePerchStore((s) => s.activeProject);
  const activeWorkspaceId = usePerchStore((s) => s.activeWorkspaceId);
  const workspaces = usePerchStore((s) => s.workspaces);
  const createSessionOnHost = usePerchStore((s) => s.createSessionOnHost);
  const renameSession = usePerchStore((s) => s.renameSession);
  const fileTabs = useFileTabs((s) => s.tabs);
  const activeFile = useFileTabs((s) => s.active);
  const tabShape = usePerchStore((s) => s.settings?.tabShape === "round" ? "round" : "square");

  const [popoverAnchor, setPopoverAnchor] = useState<DOMRect | null>(null);
  // The "+" menu's New file: the explorer's name prompt, creating in the workspace root.
  const [newFile, setNewFile] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const draggingId = useTabDrag((s) => s.drag?.id ?? null);
  // The order is read from storage on every render: a saved drag order must re-render the strip.
  useTabOrderVersion();

  const navState = { sessions, sessionId, activeHostId, activeProject, activeWorkspaceId, workspaces };
  const ws = effectiveWorkspace(navState);
  const project = effectiveActiveProject(navState);
  const hostId = ws?.hostId ?? project?.hostId ?? activeHostId;
  const cwd = ws?.path ?? project?.cwd ?? null;

  // `workspaceTabs` scopes and orders the strip (sessions and open resources
  // alike); `keybinds.ts` cycles through the same list, so leader,n/p/1-9 and
  // the visible strip can never disagree.
  const entries = workspaceTabs(navState, fileTabs);
  const fileShown = activeFile !== null && entries.some((entry) => entry.id === activeFile);
  const sets = useSplitSets((s) => s.sets);
  const zoomedId = useSplitSets((s) => s.zoomedId);
  const splitMenu = useSplitSets((s) => s.menu);
  const paneStates = tabPaneStates(sets, entries.map((entry) => entry.id), fileShown ? activeFile : sessionId, zoomedId);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.select();
  }, [renamingId]);

  // Cmd+T (keybinds.ts): open the harness picker as the "+" button would.
  useEffect(() => {
    const open = () => {
      const button = stripRef.current?.querySelector('[data-testid="tab-new"]');
      if (button) setPopoverAnchor(button.getBoundingClientRect());
    };
    window.addEventListener(NEW_TAB_EVENT, open);
    return () => window.removeEventListener(NEW_TAB_EVENT, open);
  }, []);

  // The strip scrolls when tabs overflow: keep the active one in view, also when the strip narrows.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const reveal = () => strip.querySelector(".tab-bar__tab--active")?.scrollIntoView({ inline: "nearest", block: "nearest" });
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [sessionId, activeFile, entries.length]);

  function commitRename() {
    if (renamingId) {
      const trimmed = renameValue.trim();
      if (trimmed) renameSession(renamingId, trimmed);
    }
    setRenamingId(null);
  }

  function handleNewClick(e: React.MouseEvent<HTMLButtonElement>) {
    // The launcher always lets the user choose the CLI before starting it.
    setPopoverAnchor(e.currentTarget.getBoundingClientRect());
  }

  function sessionTab(entry: Extract<TabEntry, { kind: "session" }>) {
    const s = entry.session;
    const state = paneStates.get(s.id) ?? "hidden";
    return (
      renamingId === s.id ? (
        <input
          key={s.id}
          ref={renameInputRef}
          type="text"
          className="w-40 shrink-0 rounded-ui border border-accent bg-surface-0 px-2 py-1 text-[0.8rem] leading-[1.2] text-fg [font-family:inherit] [outline:none]"
          data-testid="rename-input"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setRenamingId(null);
          }}
        />
      ) : (
        <span key={s.id} className={TAB_SLOT} data-tab-entry={s.id}>
        <button
          type="button"
          className={cn(
            "tab-bar__tab",
            segment(),
            TAB,
            TAB_SHAPE(tabShape),
            TAB_PANE_CLASS[state],
            state === "focused" && "tab-bar__tab--active",
            s.id === draggingId && "opacity-40",
          )}
          data-pane-state={state}
          data-testid={`tab-${s.id}`}
          title={s.title || "New session"}
          onPointerDown={(e) => beginTabDrag(e, s.id, sessionLabel(s))}
          onClick={() => activateTab(entry)}
          onContextMenu={(e) => {
            e.preventDefault();
            useSplitSets.getState().openMenu(s.id, e.clientX, e.clientY);
          }}
          onDoubleClick={() => {
            setRenamingId(s.id);
            setRenameValue(s.title || "");
          }}
        >
          <span className="truncate">{sessionLabel(s)}</span>
        </button>
        {/* Like closing a tab in Orca: the session, its agent and its shells
         * end (the agent's own transcript stays on disk). */}
        <button
          type="button"
          className={closeButton(state)}
          data-testid={`tab-close-${s.id}`}
          title="Close session"
          aria-label={`Close ${sessionLabel(s)}`}
          onClick={() => requestCloseSession(s.id)}
        >
          ×
        </button>
        </span>
      )
    );
  }

  return (
    <div ref={stripRef} className="tab-bar flex min-w-0 flex-1 items-stretch gap-1 self-stretch overflow-x-auto bg-panel-bg px-2 py-1 max-[700px]:hidden" data-testid="tab-bar" data-tauri-drag-region>
      {entries.map((entry) => entry.kind === "resource" ? (
        <ResourceTabButton key={entry.id} tab={entry.tab} id={entry.id} state={paneStates.get(entry.id) ?? "hidden"} tabShape={tabShape}
          dragging={entry.id === draggingId} />
      ) : sessionTab(entry))}

      <button
        type="button"
        className={cn(segment(), `w-7 shrink-0 justify-center text-[0.8rem] leading-none ${FOCUS}`, TAB_SHAPE(tabShape))}
        data-testid="tab-new"
        title="New session in this workspace"
        aria-label="New session in this workspace"
        onClick={handleNewClick}
      >
        {"+"}
      </button>
      {splitMenu && <TabSplitMenu entries={entries} menu={splitMenu} />}
      <TabDragLayer />
      {popoverAnchor && (
        <NewSessionPopover
          hostId={hostId}
          projectCwds={[]}
          fixedCwd={cwd ?? "~"}
          anchorRect={popoverAnchor}
          onClose={() => setPopoverAnchor(null)}
          onSelect={(selectedCwd, provider) => createSessionOnHost(hostId, selectedCwd, provider)}
          extras={ws ? [
            { id: "browser", label: "New browser", icon: <BrowserIcon />, onSelect: () => openBlankBrowser(ws.id) },
            { id: "file", label: "New file", icon: <FileIcon />, onSelect: () => setNewFile(true) },
          ] : undefined}
        />
      )}
      {newFile && ws && (
        <FileEntryMenu
          workspaceId={ws.id}
          workspacePath={ws.path}
          target={null}
          x={0}
          y={0}
          initialStage="newFile"
          onClose={() => setNewFile(false)}
          onOpenFile={(path) => useFileTabs.getState().open(ws.id, path)}
          onExpand={() => {}}
          onRefresh={() => {}}
        />
      )}
    </div>
  );
}

const ICON = { viewBox: "0 0 16 16", width: 14, height: 14, fill: "none", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const BrowserIcon = () => <svg {...ICON}><circle cx="8" cy="8" r="6" /><path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12" /></svg>;
const FileIcon = () => <svg {...ICON}><path d="M9 2H4.5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5.5zM9 2v3.5h3.5" /></svg>;

/** A file's or review's tab: its name, a ● while a file has unsaved changes, and ×. */
function ResourceTabButton({ tab, id, state, tabShape, dragging }: {
  tab: FileTab;
  id: string;
  state: TabPaneState;
  tabShape: "square" | "round";
  dragging: boolean;
}) {
  const close = useFileTabs((s) => s.close);
  const pin = useFileTabs((s) => s.pin);
  const review = tab.kind === "review";
  const dirty = useWorkspaceFilesStore((s) => {
    const document = s.documents[tab.workspaceId]?.[tab.path];
    return !review && document != null && document.content !== document.savedContent;
  });
  const browser = tab.kind === "browser";
  const name = tabName(tab);
  const testId = review ? `review-tab-${tab.workspaceId}` : browser ? "browser-tab" : `file-tab-${tab.path}`;
  return (
    <span className={TAB_SLOT} data-tab-entry={id}>
      <button
        type="button"
        className={cn(
          "tab-bar__tab",
          segment(),
          TAB,
          TAB_SHAPE(tabShape),
          TAB_PANE_CLASS[state],
          state === "focused" && "tab-bar__tab--active",
          dragging && "opacity-40",
        )}
        data-pane-state={state}
        data-testid={testId}
        title={review ? "Changes" : isBlankBrowser(tab) ? "New browser" : tab.path}
        onPointerDown={(e) => beginTabDrag(e, id, name)}
        onClick={() => activateTab({ id, kind: "resource", tab })}
        onDoubleClick={() => pin(id)}
        onContextMenu={(e) => {
          e.preventDefault();
          useSplitSets.getState().openMenu(id, e.clientX, e.clientY);
        }}
      >
        <span className={cn("block truncate", tab.preview && "italic")}>{name}</span>
        {dirty && <span className="text-subtext-0" aria-label="unsaved changes"> ●</span>}
      </button>
      <button
        type="button"
        className={closeButton(state)}
        data-testid={review ? `review-tab-close-${tab.workspaceId}` : browser ? "browser-tab-close" : `file-tab-close-${tab.path}`}
        aria-label={`Close ${name}`}
        onClick={() => close(id)}
      >
        ×
      </button>
    </span>
  );
}
