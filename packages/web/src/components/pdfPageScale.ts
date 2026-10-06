const MAX_CANVAS_SIDE = 8192;
const MAX_CANVAS_PIXELS = 16_777_216;
const FIT_WIDTH_MARGIN = 24;

/** CSS-pixel scale for a PDF page. `ratio` is the device pixel ratio the
 * canvas will be backed at, so the caps apply to the backing store
 * (CSS size × ratio): at most 8192 px per side and 16M pixels in total.
 * ponytail: one page/canvas; a tiled renderer is the upgrade for
 * poster-sized pages at high zoom. */
export function pageScale(
  page: { width: number; height: number },
  zoom: string,
  containerWidth: number,
  ratio: number,
): number {
  const desired = zoom === "fit"
    ? Math.max(1, containerWidth - FIT_WIDTH_MARGIN) / page.width
    : Number(zoom);
  return Math.min(
    desired,
    MAX_CANVAS_SIDE / page.width / ratio,
    MAX_CANVAS_SIDE / page.height / ratio,
    Math.sqrt(MAX_CANVAS_PIXELS / (page.width * page.height)) / ratio,
  );
}
