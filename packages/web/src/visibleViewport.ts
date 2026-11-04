/**
 * Keep the phone's app inside the part of the screen the on-screen keyboard leaves.
 *
 * iOS does not shrink the layout viewport (`100dvh`) for the keyboard: it slides the visual
 * viewport up and scrolls the page, so the header goes off the top and the terminal's bottom
 * stays under the keys. `.app--mobile` (base.css) is `position: fixed` and sized by these two
 * variables instead: `--visible-height` is the visual viewport's height and `--visible-top`
 * how far iOS panned it.
 */
export function trackVisibleViewport(
  root: HTMLElement = document.documentElement,
  viewport: VisualViewport | null = window.visualViewport,
): () => void {
  if (!viewport) return () => {};
  const update = () => {
    root.style.setProperty("--visible-height", `${viewport.height}px`);
    root.style.setProperty("--visible-top", `${viewport.offsetTop}px`);
  };
  update();
  viewport.addEventListener("resize", update);
  viewport.addEventListener("scroll", update);
  return () => {
    viewport.removeEventListener("resize", update);
    viewport.removeEventListener("scroll", update);
    root.style.removeProperty("--visible-height");
    root.style.removeProperty("--visible-top");
  };
}
