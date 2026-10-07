import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { usePerchStore, effectiveActiveProject, effectiveWorkspace } from "../store";
import { NewSessionPopover } from "../Sidebar";
import { saveTabOrder } from "../tabOrder";
import { useFileTabs, type FileTab } from "../fileTabs";
import { activateTab, sessionLabel, tabOrderKey, workspaceTabs, type TabEntry } from "../workspaceTabs";
import { useSplitSets } from "../splitSets";
import { TabSplitMenu } from "./TabSplitMenu";
import { useWorkspaceFilesStore } from "../filesystemStore";
import { openSessionPaneMenu } from "../dockview/DockviewShell";
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
const TAB_SHAPE = (shape: "square" | "round") => shape === "round" ? "rounded-full" : "rounded-none";
// Members of a split set (shown side by side in the canvas) share a bottom rule.
const TAB_SPLIT = "shadow-[inset_0_-2px_0_var(--overlay-1)]";
const CLOSE = `absolute top-1/2 right-[0.25rem] h-[1.25rem] w-[1.25rem] cursor-pointer rounded-ui bg-transparent p-0 text-[0.9rem] leading-none text-subtext-0 [border:0] [font-family:inherit] [transform:translateY(-50%)] hover:text-fg ${FOCUS}`;
// The active tab is surface-1, so its x hovers on panel-bg: fg is drawn against it in every theme
// (overlay-0 is fg-coloured in the terminal theme and hid the x).
const closeButton = (active: boolean) => cn(CLOSE, active ? "text-fg hover:bg-panel-bg" : "hover:bg-surface-1");

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
 * Dragging a tab reorders it within the strip (Wave 2 item 10) — purely
 * presentational, persisted client-side *per workspace* via `tabOrder.ts` (no
 * protocol field for tab order exists or is added). The trailing "+" opens
 * the CLI picker (`NewSessionPopover`) for this workspace's path on its host;
 * with no workspace it uses the active project's cwd, and the sidebar's
 * "+ New session" button keeps picking a *different* folder one click away.
 *
 * Files opened from the drawer's explorer sit after the sessions, before "+"
 * (`fileTabs.ts`); the active one replaces the session view in the main area.
 * Right-clicking a session tab opens its pane menu (split, zoom, stop agent),
 * since a single-pane layout shows no pane header.
 */
export function TabBar() {
  const sessionId = usePerchStore((s) => s.sessionId);
  const sessions = usePerchStore((s) => s.sessions);
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const activeProject = usePerchStore((s) => s.activeProject);
  const activeWorkspaceId = usePerchStore((s) => s.activeWorkspaceId);
  const workspaces = usePerchStore((s) => s.workspaces);
  const switchSession = usePerchStore((s) => s.switchSession);
  const createSessionOnHost = usePerchStore((s) => s.createSessionOnHost);
  const renameSession = usePerchStore((s) => s.renameSession);
  const fileTabs = useFileTabs((s) => s.tabs);
  const activeFile = useFileTabs((s) => s.active);
  const showSession = useFileTabs((s) => s.showSession);
  const tabShape = usePerchStore((s) => s.settings?.tabShape === "round" ? "round" : "square");

  const [popoverAnchor, setPopoverAnchor] = useState<DOMRect | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  // Bumped after every drop purely to trigger a re-render: `orderedTabs`
  // below re-reads localStorage on every render (no memoization), so any
  // state change — including this one — is enough to reflect a fresh order.
  const [, setOrderVersion] = useState(0);

  const navState = { sessions, sessionId, activeHostId, activeProject, activeWorkspaceId, workspaces };
  const ws = effectiveWorkspace(navState);
  const project = effectiveActiveProject(navState);
  const hostId = ws?.hostId ?? project?.hostId ?? activeHostId;
  const cwd = ws?.path ?? project?.cwd ?? null;
  const projectKey = tabOrderKey(navState);

  // `workspaceTabs` scopes and orders the strip (sessions and open resources
  // alike); `keybinds.ts` cycles through the same list, so leader,n/p/1-9 and
  // the visible strip can never disagree.
  const entries = workspaceTabs(navState, fileTabs);
  const fileShown = activeFile !== null && entries.some((entry) => entry.id === activeFile);
  const sets = useSplitSets((s) => s.sets);
  const splitMenu = useSplitSets((s) => s.menu);
  const live = new Set(entries.map((entry) => entry.id));
  const splitIds = new Set(sets.flatMap((set) => {
    const members = set.ids.filter((id) => live.has(id));
    return members.length >= 2 ? members : [];
  }));

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

  function handleTabDragStart(id: string) {
    setDraggingId(id);
  }

  function handleTabDragOver(e: React.DragEvent<HTMLElement>, id: string) {
    e.preventDefault();
    if (!draggingId || draggingId === id) return;
    if (dragOverId !== id) setDragOverId(id);
  }

  function handleTabDrop(id: string) {
    if (projectKey && draggingId && draggingId !== id) {
      const ids = entries.map((entry) => entry.id);
      const fromIdx = ids.indexOf(draggingId);
      const toIdx = ids.indexOf(id);
      if (fromIdx !== -1 && toIdx !== -1) {
        ids.splice(fromIdx, 1);
        ids.splice(toIdx, 0, draggingId);
        saveTabOrder(projectKey, ids);
        setOrderVersion((v) => v + 1);
      }
    }
    setDraggingId(null);
    setDragOverId(null);
  }

  function handleTabDragEnd() {
    setDraggingId(null);
    setDragOverId(null);
  }

  function sessionTab(entry: Extract<TabEntry, { kind: "session" }>) {
    const s = entry.session;
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
        <span key={s.id} className={TAB_SLOT}>
        <button
          type="button"
          className={cn(
            "tab-bar__tab",
            segment({ active: s.id === sessionId && !fileShown }),
            TAB,
            TAB_SHAPE(tabShape),
            s.id === sessionId && !fileShown && "tab-bar__tab--active",
            splitIds.has(s.id) && TAB_SPLIT,
            s.id === draggingId && "opacity-50",
            s.id === dragOverId && "shadow-[-2px_0_0_var(--accent)]",
          )}
          data-testid={`tab-${s.id}`}
          title={s.title || "New session"}
          draggable
          onDragStart={() => handleTabDragStart(s.id)}
          onDragOver={(e) => handleTabDragOver(e, s.id)}
          onDrop={() => handleTabDrop(s.id)}
          onDragEnd={handleTabDragEnd}
          onClick={() => activateTab(entry)}
          onContextMenu={(e) => {
            e.preventDefault();
            showSession();
            if (s.id !== sessionId) switchSession(s.id);
            openSessionPaneMenu(e.clientX, e.clientY);
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
          className={closeButton(s.id === sessionId)}
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
    <div ref={stripRef} className="tab-bar flex min-w-0 flex-1 items-stretch gap-[2px] self-stretch overflow-x-auto bg-panel-bg px-[3px] py-[3px] max-[700px]:hidden" data-testid="tab-bar" data-tauri-drag-region>
      {entries.map((entry) => entry.kind === "resource" ? (
        <ResourceTabButton key={entry.id} tab={entry.tab} id={entry.id} active={entry.id === activeFile} tabShape={tabShape} split={splitIds.has(entry.id)}
          dragging={entry.id === draggingId} dragOver={entry.id === dragOverId}
          onDragStart={() => handleTabDragStart(entry.id)} onDragOver={(e) => handleTabDragOver(e, entry.id)}
          onDrop={() => handleTabDrop(entry.id)} onDragEnd={handleTabDragEnd} />
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
      {popoverAnchor && (
        <NewSessionPopover
          hostId={hostId}
          projectCwds={[]}
          fixedCwd={cwd ?? "~"}
          anchorRect={popoverAnchor}
          onClose={() => setPopoverAnchor(null)}
          onSelect={(selectedCwd, provider) => createSessionOnHost(hostId, selectedCwd, provider)}
        />
      )}
    </div>
  );
}

/** A file's or review's tab: its name, a ● while a file has unsaved changes, and ×. */
function ResourceTabButton({ tab, id, active, tabShape, split, dragging, dragOver, onDragStart, onDragOver, onDrop, onDragEnd }: {
  tab: FileTab;
  id: string;
  active: boolean;
  tabShape: "square" | "round";
  split: boolean;
  dragging: boolean;
  dragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent<HTMLElement>) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const close = useFileTabs((s) => s.close);
  const review = tab.kind === "review";
  const dirty = useWorkspaceFilesStore((s) => {
    const document = s.documents[tab.workspaceId]?.[tab.path];
    return !review && document != null && document.content !== document.savedContent;
  });
  const name = review ? "Changes" : tab.path.split("/").pop() || tab.path;
  const testId = review ? `review-tab-${tab.workspaceId}` : `file-tab-${tab.path}`;
  return (
    <span className={TAB_SLOT}>
      <button
        type="button"
        className={cn(
          "tab-bar__tab",
          segment({ active }),
          TAB,
          TAB_SHAPE(tabShape),
          active && "tab-bar__tab--active",
          split && TAB_SPLIT,
          dragging && "opacity-50",
          dragOver && "shadow-[-2px_0_0_var(--accent)]",
        )}
        data-testid={testId}
        title={review ? "Changes" : tab.path}
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        onClick={() => activateTab({ id, kind: "resource", tab })}
        onContextMenu={(e) => {
          e.preventDefault();
          useSplitSets.getState().openMenu(id, e.clientX, e.clientY);
        }}
      >
        <span className="block truncate">{name}</span>
        {dirty && <span className="text-subtext-0" aria-label="unsaved changes"> ●</span>}
      </button>
      <button
        type="button"
        className={closeButton(active)}
        data-testid={review ? `review-tab-close-${tab.workspaceId}` : `file-tab-close-${tab.path}`}
        aria-label={`Close ${name}`}
        onClick={() => close(id)}
      >
        ×
      </button>
    </span>
  );
}
