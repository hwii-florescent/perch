import { useEffect, useRef, useState } from "react";
import { usePerchStore, activeProjectSessions, effectiveActiveProject } from "../store";
import { NewSessionPopover } from "../Sidebar";
import { applyStoredTabOrder, saveTabOrder } from "../tabOrder";
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
 * Tab strip for the sessions of the *active project* — the `(hostId, cwd)`
 * pair the sidebar's project list is scoped to (see `effectiveActiveProject`
 * in `store.ts`), the closest existing analog to herdr's Workspace/Tab
 * hierarchy. Clicking a project in the sidebar re-points this strip at that
 * project's sessions; the active project also follows whichever session is
 * opened, so the strip always contains the current session's siblings.
 *
 * Clicking a tab reuses the existing `switchSession` action (same as the
 * sidebar); double-clicking a tab renames it (Wave 1 item 2, inline input).
 * Dragging a tab reorders it within the strip (Wave 2 item 10) — purely
 * presentational, persisted client-side *per project* via `tabOrder.ts` (no
 * protocol field for tab order exists or is added). The trailing "+" opens
 * the same `NewSessionPopover` (directory browser + quick-pick) used by the
 * sidebar's "+" button (Wave 1 item 1), anchored to the button, with the
 * current project's cwd preselected as the first quick-pick option so the
 * one-click "new session in this project" fast path still exists — it's
 * just one popover-click away instead of zero. Picking a *different* folder
 * creates the session there, which makes that folder the active project (so
 * it appears in the sidebar nav and this strip re-points at it).
 */
export function TabBar() {
  const sessionId = usePerchStore((s) => s.sessionId);
  const sessions = usePerchStore((s) => s.sessions);
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const activeProject = usePerchStore((s) => s.activeProject);
  const showArchived = usePerchStore((s) => s.showArchived);
  const switchSession = usePerchStore((s) => s.switchSession);
  const createSessionOnHost = usePerchStore((s) => s.createSessionOnHost);
  const renameSession = usePerchStore((s) => s.renameSession);

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

  const navState = { sessions, sessionId, activeHostId, activeProject, showArchived };
  const project = effectiveActiveProject(navState);
  const hostId = project?.hostId ?? activeHostId;
  const cwd = project?.cwd ?? null;
  const projectKey = cwd ? `${hostId}:${cwd}` : null;

  // `activeProjectSessions` already scopes + orders (createdAt ascending) and
  // drops archived sessions — the same list `keybinds.ts` cycles through, so
  // leader,n/p and the visible strip can never disagree.
  const tabs = activeProjectSessions(navState);
  const orderedTabs = projectKey ? applyStoredTabOrder(projectKey, tabs) : tabs;

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
    <div className="tab-bar" data-testid="tab-bar">
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
          <button
            key={s.id}
            type="button"
            className={[
              "tab-bar__tab",
              s.id === sessionId ? "tab-bar__tab--active" : "",
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
            onClick={() => switchSession(s.id)}
            onDoubleClick={() => {
              setRenamingId(s.id);
              setRenameValue(s.title || "");
            }}
          >
            {tabLabel(s)}
          </button>
        )
      )}

      <button
        type="button"
        className="tab-bar__new"
        data-testid="tab-new"
        title="New session in this project"
        aria-label="New session in this project"
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
          onSelect={(selectedCwd) => createSessionOnHost(hostId, selectedCwd)}
        />
      )}
    </div>
  );
}
