import { useEffect, useRef, useState } from "react";
import { usePerchStore, activeWorkspaceSessions, effectiveActiveProject, effectiveWorkspace } from "../store";
import { NewSessionPopover } from "../Sidebar";
import { applyStoredTabOrder, saveTabOrder } from "../tabOrder";
import { fileTabKey, useFileTabs, type FileTab } from "../fileTabs";
import { useWorkspaceFilesStore } from "../filesystemStore";
import { openSessionPaneMenu } from "../dockview/DockviewShell";
import type { SessionSummary } from "@perch/shared";

const MAX_TAB_LABEL = 24;

/** Short pill label for a tab. Falls back to "New session" for a session
 * with no user messages yet (title is "" until the first chat.send). */
function tabLabel(session: SessionSummary): string {
  const title = session.title.trim();
  if (!title) return "New session";
  return title.length > MAX_TAB_LABEL ? `${title.slice(0, MAX_TAB_LABEL - 1)}…` : title;
}

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
  const archiveSession = usePerchStore((s) => s.archiveSession);
  const fileTabs = useFileTabs((s) => s.tabs);
  const activeFile = useFileTabs((s) => s.active);
  const showSession = useFileTabs((s) => s.showSession);

  const [popoverAnchor, setPopoverAnchor] = useState<DOMRect | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
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
  const projectKey = ws ? `${ws.hostId}:ws:${ws.id}` : cwd ? `${hostId}:${cwd}` : null;

  // `activeWorkspaceSessions` already scopes + orders (createdAt ascending) and
  // drops archived sessions — the same list `keybinds.ts` cycles through, so
  // leader,n/p and the visible strip can never disagree.
  const tabs = activeWorkspaceSessions(navState);
  const orderedTabs = projectKey ? applyStoredTabOrder(projectKey, tabs) : tabs;
  const workspaceFiles = ws ? fileTabs.filter((tab) => tab.workspaceId === ws.id) : [];
  const fileShown = activeFile !== null && workspaceFiles.some((tab) => fileTabKey(tab) === activeFile);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.select();
  }, [renamingId]);

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

  function handleTabDragOver(e: React.DragEvent<HTMLButtonElement>, id: string) {
    e.preventDefault();
    if (!draggingId || draggingId === id) return;
    if (dragOverId !== id) setDragOverId(id);
  }

  function handleTabDrop(id: string) {
    if (projectKey && draggingId && draggingId !== id) {
      const ids = orderedTabs.map((s) => s.id);
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

  return (
    <div className="tab-bar" data-testid="tab-bar" data-tauri-drag-region>
      {orderedTabs.map((s) =>
        renamingId === s.id ? (
          <input
            key={s.id}
            ref={renameInputRef}
            type="text"
            className="tab-bar__rename-input"
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
          <span key={s.id} className="tab-bar__tab-wrap">
          <button
            type="button"
            className={[
              "tab-bar__tab",
              s.id === sessionId && !fileShown ? "tab-bar__tab--active" : "",
              s.id === draggingId ? "tab-bar__tab--dragging" : "",
              s.id === dragOverId ? "tab-bar__tab--drag-over" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-testid={`tab-${s.id}`}
            title={s.title || "New session"}
            draggable
            onDragStart={() => handleTabDragStart(s.id)}
            onDragOver={(e) => handleTabDragOver(e, s.id)}
            onDrop={() => handleTabDrop(s.id)}
            onDragEnd={handleTabDragEnd}
            onClick={() => { showSession(); switchSession(s.id); }}
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
            {tabLabel(s)}
          </button>
          {/* Archive, not delete: Settings → Archived sessions restores it,
           * and an idle archived agent hibernates on its own. */}
          <button
            type="button"
            className={"tab-bar__close" + (s.id === sessionId ? " tab-bar__close--active" : "")}
            data-testid={`tab-close-${s.id}`}
            title="Close session (restore it from Settings → Archived sessions)"
            aria-label={`Close ${tabLabel(s)}`}
            onClick={() => archiveSession(s.id, true)}
          >
            ×
          </button>
          </span>
        )
      )}

      {workspaceFiles.map((tab) => <FileTabButton key={fileTabKey(tab)} tab={tab} active={fileTabKey(tab) === activeFile} />)}

      <button
        type="button"
        className="tab-bar__new"
        data-testid="tab-new"
        title="New session in this workspace"
        aria-label="New session in this workspace"
        onClick={handleNewClick}
      >
        {"+"}
      </button>
      {popoverAnchor && (
        <NewSessionPopover
          hostId={hostId}
          projectCwds={cwd ? [cwd] : []}
          anchorRect={popoverAnchor}
          onClose={() => setPopoverAnchor(null)}
          onSelect={(selectedCwd, provider) => createSessionOnHost(hostId, selectedCwd, provider)}
        />
      )}
    </div>
  );
}

/** A file's tab: its name, a ● while it has unsaved changes, and ×. */
function FileTabButton({ tab, active }: { tab: FileTab; active: boolean }) {
  const open = useFileTabs((s) => s.open);
  const close = useFileTabs((s) => s.close);
  const dirty = useWorkspaceFilesStore((s) => {
    const document = s.documents[tab.workspaceId]?.[tab.path];
    return document != null && document.content !== document.savedContent;
  });
  const name = tab.path.split("/").pop() || tab.path;
  return (
    <span className="tab-bar__tab-wrap">
      <button
        type="button"
        className={"tab-bar__tab tab-bar__tab--file" + (active ? " tab-bar__tab--active" : "")}
        data-testid={`file-tab-${tab.path}`}
        title={tab.path}
        onClick={() => open(tab.workspaceId, tab.path)}
      >
        {name}{dirty && <span className="tab-bar__dirty" aria-label="unsaved changes"> ●</span>}
      </button>
      <button
        type="button"
        className={"tab-bar__close" + (active ? " tab-bar__close--active" : "")}
        data-testid={`file-tab-close-${tab.path}`}
        aria-label={`Close ${name}`}
        onClick={() => close(fileTabKey(tab))}
      >
        ×
      </button>
    </span>
  );
}
