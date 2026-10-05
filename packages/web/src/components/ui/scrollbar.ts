/** The app-wide scrollbar width in px: `--scrollbar-size` in styles/base.css,
 * which also styles every DOM scrollbar. xterm draws its own, so it asks here. */
export function scrollbarWidth(): number {
  const px = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--scrollbar-size"));
  return px > 0 ? px : 6;
}
