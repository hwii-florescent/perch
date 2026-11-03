/**
 * Markdown rendering for chat content, shared by the transcript bubbles
 * (`views/Chat.tsx`) and plan cards (`components/PlanCard.tsx`).
 *
 * It lives in its own module rather than in `Chat.tsx` because PlanCard is
 * imported *by* Chat.tsx — having it reach back for the renderer would make
 * the two files circular. Bundlers tolerate that (both bindings are hoisted
 * function declarations), but it's a trap for whoever next adds module-level
 * initialization to either file.
 */
import { marked } from "marked";
import DOMPurify from "dompurify";
import { repairMarkdown } from "./markdownRepair";

/** Render markdown text to sanitized HTML. Guard: only runs in browser.
 * While a message is still streaming, run it through `repairMarkdown` first
 * so a growing, incomplete string (open code fence, dangling `**`, etc.)
 * doesn't render visibly broken for a frame or two — see markdownRepair.ts. */
export function renderMarkdown(text: string, streaming: boolean): string {
  if (typeof window === "undefined") return text;
  const source = streaming ? repairMarkdown(text) : text;
  const html = marked.parse(source, { async: false }) as string;
  return DOMPurify.sanitize(html);
}

/** The rendered preview of a file stays bounded: past this many characters only the head is rendered. */
export const FILE_PREVIEW_MAX_CHARS = 200_000;

const FILE_PREVIEW_TAGS = "a abbr b blockquote br code dd del details div dl dt em h1 h2 h3 h4 h5 h6 hr i img input ins kbd li mark ol p pre q s samp small span strong sub summary sup table tbody td tfoot th thead tr u ul".split(" ");
const FILE_PREVIEW_ATTRS = ["href", "rel", "src", "alt", "title", "class", "type", "checked", "disabled", "start", "colspan", "rowspan", "align"];
// Elements that would fetch or embed something. Each becomes a text placeholder before sanitizing.
const FETCHING = "img, video, audio, iframe, embed, object";
const PASSIVE_DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp);/i;

// A private DOMPurify instance: its config never touches the chat renderer's.
let filePurify: ReturnType<typeof DOMPurify> | undefined;

function placeholder(doc: Document, element: Element, url: string): HTMLElement {
  const span = doc.createElement("span");
  span.className = "md-placeholder";
  const tag = element.tagName.toLowerCase();
  const alt = tag === "img" ? element.getAttribute("alt") : element.getAttribute("title");
  const shown = url.startsWith("data:") ? "data URL" : url.length > 200 ? `${url.slice(0, 200)}…` : url;
  // textContent only: the URL is displayed, never loaded or linked.
  span.textContent = `[${tag === "img" ? "image" : tag}${alt ? `: ${alt}` : ""}]${shown ? ` ${shown}` : ""}`;
  return span;
}

/**
 * Markdown for the file viewer: the chat parser with a stricter, separate sanitizer.
 * Nothing in the output loads on its own. Images, media and frames become text
 * placeholders (alt text and the URL as text) unless `resolveImage` maps a relative
 * `src` to a confined same-origin URL, or it is an inline raster `data:` image.
 * Scripts, handlers, styles, SVG, srcset and unsafe URLs are dropped by the allowlist.
 */
export function renderFilePreview(text: string, resolveImage: (src: string) => string | null = () => null): { html: string; truncated: boolean } {
  if (typeof window === "undefined") return { html: "", truncated: false };
  let source = text;
  const truncated = text.length > FILE_PREVIEW_MAX_CHARS;
  if (truncated) {
    const cut = text.lastIndexOf("\n", FILE_PREVIEW_MAX_CHARS);
    source = text.slice(0, cut > 0 ? cut : FILE_PREVIEW_MAX_CHARS);
  }
  // DOMParser documents are inert: parsing here fetches nothing.
  const doc = new DOMParser().parseFromString(marked.parse(source, { async: false }) as string, "text/html");
  // Untrusted `class` could borrow the app's own utility classes (fixed, inset-0, z-50…) to cover and spoof
  // Perch's UI. Only marked's `language-*` on <code> survives; our own placeholder class is added below.
  for (const element of Array.from(doc.body.querySelectorAll("[class]"))) {
    const language = element.tagName === "CODE" && /^language-[\w#+.-]+$/.test(element.getAttribute("class") ?? "") ? element.getAttribute("class")! : null;
    element.removeAttribute("class");
    if (language) element.setAttribute("class", language);
  }
  for (const element of Array.from(doc.body.querySelectorAll(FETCHING))) {
    const src = (element.getAttribute("src") ?? element.getAttribute("data") ?? element.querySelector("source[src]")?.getAttribute("src") ?? element.getAttribute("srcset")?.trim().split(/\s+/)[0] ?? "").trim();
    if (element.tagName === "IMG" && !element.hasAttribute("srcset") && src) {
      const local = PASSIVE_DATA_IMAGE.test(src) ? src : resolveImage(src);
      if (local) {
        element.setAttribute("src", local);
        continue;
      }
    }
    element.replaceWith(placeholder(doc, element, src));
  }
  for (const input of Array.from(doc.body.querySelectorAll("input"))) {
    if (input.getAttribute("type") === "checkbox") input.setAttribute("disabled", "");
    else input.remove();
  }
  for (const link of Array.from(doc.body.querySelectorAll("a"))) {
    const href = link.getAttribute("href") ?? "";
    // Only absolute http(s) links stay; the viewer's click handler decides how they open.
    if (/^https?:\/\//i.test(href)) link.setAttribute("rel", "noopener noreferrer");
    else {
      if (href) link.setAttribute("title", href);
      link.removeAttribute("href");
    }
  }
  filePurify ??= DOMPurify(window);
  const html = filePurify.sanitize(doc.body.innerHTML, { ALLOWED_TAGS: FILE_PREVIEW_TAGS, ALLOWED_ATTR: FILE_PREVIEW_ATTRS, ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false });
  return { html, truncated };
}
