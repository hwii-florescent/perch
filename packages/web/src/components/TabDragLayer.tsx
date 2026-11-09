/**
 * TabDragLayer.tsx: what a tab drag shows (`tabDrag.ts` owns the drag). The screen is `stock:tab-drag`
 * (`stock-ui/tab-drag/main.tsx`) or the person's package chosen for it; this file hands it the drag in flight, with
 * the box a drop would take already worked out, and draws nothing while no tab is dragged.
 */
import { zoneBox, useTabDrag } from "../tabDrag";
import TabDrag from "../stock-ui/tab-drag/main";
import { StockRoute } from "./mod-root";

export function TabDragLayer() {
  const drag = useTabDrag((s) => s.drag);
  if (!drag) return null;
  const { drop } = drag;
  const view = {
    id: drag.id, label: drag.label, x: drag.x, y: drag.y, overStrip: drag.overStrip, look: drag.look,
    drop: drop ? { pane: drop.pane, zone: drop.zone, box: drop.zone ? zoneBox(drop.pane, drop.zone) : drop.pane } : null,
  };
  return <StockRoute name="tab-drag" props={{ drag: view }} stock={TabDrag} />;
}
