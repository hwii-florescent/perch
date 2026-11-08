/**
 * A picture of the app, drawn from its own DOM (the page cannot ask the OS for a screenshot): the page is
 * copied with its computed styles written inline, put in an SVG `foreignObject` and painted to a canvas.
 * Text, colors, borders, shadows and layout come out as shown; what is not in the DOM does not — terminal
 * canvases are copied as pictures, web fonts fall back to system ones, and the desktop's native Browser
 * pane is not part of the page. `perch mod shot` and `api.screenshot()` use it.
 */
const MAX_NODES = 8000;
const MAX_WIDTH = 1600;

function inlineStyles(from: Element, to: Element, budget: { left: number }) {
  if (budget.left-- <= 0) return;
  const computed = getComputedStyle(from);
  let css = "";
  for (let i = 0; i < computed.length; i++) css += `${computed[i]}:${computed.getPropertyValue(computed[i]!)};`;
  (to as HTMLElement).setAttribute("style", css);
  if (from instanceof HTMLCanvasElement && to instanceof HTMLElement) {
    // A canvas has no pixels in a copy: swap in a picture of it.
    try {
      const img = document.createElementNS("http://www.w3.org/1999/xhtml", "img");
      img.setAttribute("src", from.toDataURL("image/png"));
      img.setAttribute("style", css);
      to.replaceWith(img);
    } catch { /* a tainted or lost context stays blank */ }
    return;
  }
  if (from instanceof HTMLInputElement || from instanceof HTMLTextAreaElement) to.setAttribute("value", from.value);
  const [a, b] = [from.children, to.children];
  for (let i = 0; i < a.length && i < b.length; i++) inlineStyles(a[i]!, b[i]!, budget);
}

/** The app as a PNG data URL, at most 1600 px wide. */
export async function screenshot(): Promise<string> {
  const root = document.documentElement;
  const width = root.clientWidth, height = root.clientHeight;
  const scale = Math.min(1, MAX_WIDTH / width);
  const copy = root.cloneNode(true) as HTMLElement;
  // Walk the page and its copy together first (they match position for position), then drop what must
  // not travel: scripts, frames, stylesheets (every style is already written inline).
  inlineStyles(root, copy, { left: 1 });
  const body = copy.querySelector("body");
  if (body) inlineStyles(document.body, body, { left: MAX_NODES });
  copy.querySelectorAll("script, noscript, iframe, video, audio, link, style").forEach((el) => el.remove());
  copy.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  const xml = new XMLSerializer().serializeToString(copy);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${xml}</foreignObject></svg>`;
  const image = new Image();
  image.decoding = "sync";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("The page could not be drawn into a picture."));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas to draw on.");
  context.scale(scale, scale);
  context.drawImage(image, 0, 0);
  return canvas.toDataURL("image/png");
}
