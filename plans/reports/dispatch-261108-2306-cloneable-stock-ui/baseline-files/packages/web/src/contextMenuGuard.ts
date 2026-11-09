/**
 * contextMenuGuard.ts — a focused terminal owns every key. macOS still turns some of them (Ctrl+Enter,
 * Menu, Shift+F10) into a `contextmenu` event at the *mouse pointer*, which would open whatever menu
 * sits under it. A `contextmenu` with no pointer press, while a terminal has focus, is swallowed before
 * any menu sees it. The Enter recovery in xtermSetup listens on the same node, so it still runs.
 */
const GRACE_MS = 1000;

export function installContextMenuGuard(doc: Document = document): () => void {
  let down = false;
  let releasedAt = -Infinity;
  const press = () => { down = true; };
  const release = (event: Event) => { down = false; releasedAt = event.timeStamp; };
  const guard = (event: MouseEvent) => {
    const active = doc.activeElement;
    if (!active?.closest(".xterm") || down || event.timeStamp - releasedAt < GRACE_MS) return;
    event.preventDefault();
    event.stopPropagation();
  };
  doc.addEventListener("pointerdown", press, true);
  doc.addEventListener("pointerup", release, true);
  doc.addEventListener("pointercancel", release, true);
  doc.addEventListener("contextmenu", guard, true);
  return () => {
    doc.removeEventListener("pointerdown", press, true);
    doc.removeEventListener("pointerup", release, true);
    doc.removeEventListener("pointercancel", release, true);
    doc.removeEventListener("contextmenu", guard, true);
  };
}
