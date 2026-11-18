//! markdown.mjs: how much of a Markdown file the preview renders, cut where the web cuts it (`renderFilePreview` in
//! `packages/web/src/markdown.ts`). The document itself is drawn by the window's Markdown engine (`MarkdownPreview` in
//! `sdk.mjs`, `perch-markdown`).

/** The web renders this much of a document; the rest is left to Source. */
export const FILE_PREVIEW_MAX_CHARS = 200_000;

/** `text` cut where the web cuts it, and whether it was cut. */
export function previewSource(text) {
  if (text.length <= FILE_PREVIEW_MAX_CHARS) return { source: text, truncated: false };
  const cut = text.lastIndexOf("\n", FILE_PREVIEW_MAX_CHARS);
  return { source: text.slice(0, cut > 0 ? cut : FILE_PREVIEW_MAX_CHARS), truncated: true };
}
