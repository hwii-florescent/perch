import { useMemo, type MouseEvent } from "react";
import { getWorkspaceFileUrl } from "../base";
import { openTerminalLink } from "../links";
import { isRelayMode } from "../relay/transport";
import { FILE_PREVIEW_MAX_CHARS, renderFilePreview } from "../markdown";

const IMAGE_FILE = /\.(?:png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i;

/** The workspace path a relative Markdown image `src` names, or null for anything else
 * (a scheme, `//host`, an absolute path, or `..` climbing out of the workspace).
 * The server's descriptor-confined `workspace-file` route re-checks confinement. */
export function localImagePath(markdownPath: string, src: string): string | null {
  if (/^[a-z][a-z\d+.-]*:/i.test(src) || src.startsWith("/") || src.includes("\\")) return null;
  let relative: string;
  try {
    relative = decodeURIComponent(src.split(/[?#]/, 1)[0] ?? "");
  } catch {
    return null;
  }
  if (relative.includes("\0")) return null;
  const parts = markdownPath.split("/").slice(0, -1);
  for (const part of relative.split("/")) {
    if (part === "..") {
      if (parts.pop() === undefined) return null;
    } else if (part && part !== ".") parts.push(part);
  }
  const path = parts.join("/");
  return IMAGE_FILE.test(path) ? path : null;
}

/** Rendered view of the live draft (`content`), not the saved file. Relative images load through the
 * confined local file route; remote hosts, which have no such route, and everything else show placeholders. */
export function WorkspaceMarkdownPreview({ workspaceId, path, content, local }: { workspaceId: string; path: string; content: string; local: boolean }) {
  const { html, truncated } = useMemo(() => renderFilePreview(content, (src) => {
    // A relay page's <img> fetches cannot go through the tunnel, so relative images stay placeholders there.
    const image = local && !isRelayMode() ? localImagePath(path, src) : null;
    return image ? getWorkspaceFileUrl(workspaceId, image) : null;
  }), [content, local, path, workspaceId]);
  // Links act only on an explicit click and never navigate the app itself.
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const link = (event.target as Element).closest("a");
    if (!link) return;
    event.preventDefault();
    const href = link.getAttribute("href");
    if (href) openTerminalLink(event.nativeEvent, href);
  };
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto px-4 py-3 text-[0.8rem]" tabIndex={0} role="region" aria-label={`Rendered preview of ${path}`} data-testid="workspace-markdown-preview">
      {truncated && <p role="status" className="mt-0 text-[0.7rem] text-yellow" data-testid="workspace-markdown-truncated">This document is large: only the first {FILE_PREVIEW_MAX_CHARS.toLocaleString()} characters are rendered. Switch to Source to see all of it.</p>}
      {/* The html is DOMPurify-sanitized by renderFilePreview with no implicit fetches. */}
      <div className="message__markdown file-markdown" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
