import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "../lib/cn";
import { GHOST_BUTTON } from "./ui/icon-button";

/** Larger files are not decoded in the viewer (the browser would hold the whole bitmap); the
 * download action stays. The server streams any size, so this is the only bound on images. */
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const STEP = 1.25;
const MIN_SCALE = 0.05;
// Browsers blank or crash on enormous layers: never size the image past this many CSS pixels.
const MAX_SIDE = 16_384;
const BTN = cn(GHOST_BUTTON, "min-h-8 min-w-8 px-2 text-[0.75rem] max-[700px]:min-h-11 max-[700px]:min-w-11");

/** An image with Fit / 100% / zoom controls and its natural size once decoded. The `<img>` is
 * the only decoder (SVG therefore never runs script) and `url` may be an object URL. Pan is the
 * pane's own scrolling (wheel, touch, arrow keys) plus mouse drag. `onFail` swaps in the
 * viewer's download fallback. */
export function WorkspaceImage({ url, name, onFail }: { url: string; name: string; onFail: () => void }) {
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const image = useRef<HTMLImageElement | null>(null);
  const pane = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  // SVGs without intrinsic size report 0: no dimensions, and only Fit makes sense.
  const sized = natural !== null && natural.width > 0 && natural.height > 0;
  const maxScale = sized ? Math.min(8, MAX_SIDE / Math.max(natural.width, natural.height)) : 1;
  // The scale on screen: the chosen zoom, or whatever Fit works out to.
  const current = () => (zoom !== "fit" ? zoom : sized && image.current ? image.current.getBoundingClientRect().width / natural.width : 1);
  const zoomTo = (scale: number) => setZoom(Math.min(maxScale, Math.max(Math.min(MIN_SCALE, maxScale), scale)));
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey || !sized) return;
    if (event.key === "+" || event.key === "=") zoomTo(current() * STEP);
    else if (event.key === "-") zoomTo(current() / STEP);
    else if (event.key === "0") zoomTo(1);
    else return;
    event.preventDefault();
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const element = pane.current;
    if (event.pointerType !== "mouse" || event.button !== 0 || !element) return;
    drag.current = { x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop };
    element.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || !pane.current) return;
    pane.current.scrollLeft = start.left - (event.clientX - start.x);
    pane.current.scrollTop = start.top - (event.clientY - start.y);
  };
  const percent = zoom === "fit" ? "Fit" : `${Math.round(zoom * 100)}%`;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="workspace-image-viewer">
      <div className="flex shrink-0 flex-wrap items-center gap-1 px-3 py-1 text-[0.72rem] text-subtext-0" role="toolbar" aria-label="Image view">
        <button type="button" className={BTN} aria-label="Zoom out" title="Zoom out (-)" disabled={!sized} onClick={() => zoomTo(current() / STEP)}>−</button>
        <button type="button" className={BTN} aria-label="Zoom in" title="Zoom in (+)" disabled={!sized} onClick={() => zoomTo(current() * STEP)}>+</button>
        <button type="button" className={cn(BTN, zoom === "fit" && "text-fg")} aria-pressed={zoom === "fit"} onClick={() => setZoom("fit")}>Fit</button>
        <button type="button" className={cn(BTN, zoom === 1 && "text-fg")} aria-pressed={zoom === 1} title="Actual size (0)" disabled={!sized} onClick={() => zoomTo(1)}>100%</button>
        <span role="status" className="px-1" data-testid="workspace-image-info">{sized ? `${natural.width} × ${natural.height} · ${percent}` : ""}</span>
      </div>
      <div
        ref={pane}
        className={cn("flex min-h-0 min-w-0 flex-1 overflow-auto p-3", zoom !== "fit" && "cursor-grab active:cursor-grabbing")}
        tabIndex={0}
        aria-label={`${name} image. Plus and minus zoom, 0 shows actual size, arrow keys pan.`}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
      >
        <img
          ref={image}
          className={cn("m-auto", zoom === "fit" ? "max-h-full max-w-full object-contain" : "max-w-none shrink-0")}
          style={zoom !== "fit" && sized ? { width: natural.width * zoom, height: natural.height * zoom } : undefined}
          src={url}
          alt={name}
          draggable={false}
          onLoad={(event) => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          onError={onFail}
          data-testid="workspace-file-image"
        />
      </div>
    </div>
  );
}
