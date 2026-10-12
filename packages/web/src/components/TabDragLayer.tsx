import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import { zoneBox, useTabDrag } from "../tabDrag";

const ZONE_LABEL = { left: "Split left", right: "Split right", up: "Split above", down: "Split below" } as const;

/**
 * What a tab drag shows (`tabDrag.ts`): a ghost of the tab under the pointer, a
 * bar where a reorder would land, and on a pane the half a split would take.
 * The highlight slides between sides and pulses so the target stays easy to
 * see; a pane that cannot take the tab says why. A transparent sheet covers the
 * page so nothing underneath (terminals, iframes) reacts to the drag.
 */
export function TabDragLayer() {
  const drag = useTabDrag((s) => s.drag);
  if (!drag) return null;
  const { insert, drop } = drag;
  const zone = drop?.zone ?? null;
  const box = drop && (zone ? zoneBox(drop.pane, zone) : drop.pane);
  return createPortal(
    <div className="fixed inset-0 z-[9998] cursor-grabbing select-none" data-testid="tab-drag-layer" aria-hidden="true">
      {insert && (
        <div
          className="pointer-events-none fixed w-[3px] rounded-full bg-accent shadow-[0_0_6px_var(--accent)] transition-[left] duration-100 ease-out animate-drop-bar"
          style={{ left: insert.x - 1, top: insert.top, height: insert.height }}
          data-testid="tab-drop-bar"
        />
      )}
      {drop && box && (
        <>
          <div
            className="pointer-events-none fixed rounded-ui border border-dashed border-overlay-1"
            style={{ left: drop.pane.left, top: drop.pane.top, width: drop.pane.width, height: drop.pane.height }}
          />
          <div
            className={cn(
              "pointer-events-none fixed flex items-center justify-center rounded-ui border-2 transition-[left,top,width,height] duration-150 ease-out animate-drop-zone",
              zone ? "border-accent bg-accent/35 shadow-[inset_0_0_24px_var(--accent)]" : "border-dashed border-overlay-1 bg-surface-1/60",
            )}
            style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
            data-testid="tab-drop-zone"
            data-zone={zone ?? "blocked"}
          >
            <span className="rounded-ui bg-surface-0 px-2 py-[2px] text-[0.75rem] text-fg shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
              {zone ? ZONE_LABEL[zone] : "This split can't take that tab"}
            </span>
          </div>
        </>
      )}
      <div
        className="pointer-events-none fixed max-w-[16rem] truncate rounded-ui border border-accent bg-surface-1 px-3 py-1 text-[0.8rem] text-fg shadow-[0_6px_18px_rgba(0,0,0,0.45)]"
        style={{ left: drag.x + 12, top: drag.y + 12 }}
        data-testid="tab-drag-ghost"
      >
        {drag.label}
      </div>
    </div>,
    document.body,
  );
}
