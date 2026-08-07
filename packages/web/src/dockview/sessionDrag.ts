/**
 * sessionDrag.ts — the custom HTML5 drag-and-drop payload used to drag a
 * *session* (from `SessionSplitPopover.tsx`'s picker list) onto the dockview
 * shell and have it split/tab in as that session's own chat panel.
 *
 * This is deliberately NOT dockview's own internal panel-drag payload
 * (`PanelTransfer`/`LocalSelectionTransfer` — see dockview-core's
 * `dnd/dataTransfer.ts`): that mechanism only carries "move this already-
 * existing dockview panel", set exclusively by dockview's own tab drag
 * handles. A session in the picker list isn't a dockview panel yet — it may
 * not have one open at all — so it rides its own plain `DataTransfer` mime
 * type instead. dockview's group drop-target machinery still recognizes and
 * shows its native overlay for *any* drag (see `DockviewShell.tsx`'s
 * `onUnhandledDragOver` wiring, which calls `.accept()` specifically for
 * this mime type); only the final `onDidDrop` handling — reading the
 * dropped session id back out via `readSessionDragId` — is custom.
 */

export const SESSION_DRAG_MIME = "application/x-perch-session-id";

/** Call from a draggable session chip's `onDragStart`. */
export function beginSessionDrag(e: React.DragEvent, sessionId: string): void {
  e.dataTransfer.setData(SESSION_DRAG_MIME, sessionId);
  e.dataTransfer.effectAllowed = "copy";
}

/** Call from dockview's `onUnhandledDragOver`/`onDidDrop` handlers to detect
 * (and read) this payload. Native HTML5 DnD only exposes `getData()` values
 * during the actual `drop` event (browsers withhold data during `dragover`
 * for security reasons) — `dataTransfer.types` is readable at every stage,
 * so `isSessionDrag` (dragover) and `readSessionDragId` (drop) are split
 * accordingly; don't call `readSessionDragId` from a dragover handler
 * expecting a value. */
export function isSessionDrag(dataTransfer: DataTransfer | null): boolean {
  return !!dataTransfer?.types.includes(SESSION_DRAG_MIME);
}

export function readSessionDragId(dataTransfer: DataTransfer | null): string | undefined {
  const id = dataTransfer?.getData(SESSION_DRAG_MIME);
  return id ? id : undefined;
}
