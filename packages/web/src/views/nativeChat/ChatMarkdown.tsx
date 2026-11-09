import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { FsLink } from "@perch/shared";
import { splitMarkdown } from "../../markdown";
import { usePerchStore } from "../../store";
import { useFileTabs } from "../../fileTabs";
import { openTerminalLink, tauriInvoke, webUrl } from "../../links";
import { workspaceRecord } from "../../terminalScope";
import { joinPath } from "../../fileOps";
import { cn } from "../../lib/cn";
import "../../chatFont"; // applies the saved --chat-font-scale as soon as a chat can show
import { CodeBlock } from "./CodeBlock";
import { SafeHtml } from "./SafeHtml";
import { PerchUi } from "./UiBlocksView";
import { parseUi } from "./uiBlocks";
import { couldBeFile, linkTargets, requestFileLinks } from "./fileLinks";

const FILE_LINK = "cursor-pointer rounded-ui bg-surface-1 px-1 font-mono text-[0.9em] text-fg no-underline hover:text-accent";

/**
 * An agent's Markdown, the one way a package draws it (`Markdown` in `@perch/sdk` 1.5). This is a fixed part of
 * Perch, not package source: the HTML comes from `markdown.ts` (marked + DOMPurify) and is sanitized again where it
 * is inserted (`SafeHtml`, nodes, never an HTML string); `perch-ui` blocks are parsed as plain data (`uiBlocks.ts`)
 * and drawn as text; code is highlighted by Perch's own grammar. A click on a link never navigates the app: a web
 * URL opens outside it, a link the core resolved to a file of the workspace (`fileLinks`) opens it as a tab
 * (Cmd/Ctrl: the default app, local desktop only), and anything else does nothing.
 */
export function ChatMarkdown({ text, streaming = false, fileLinks }: { text: string; streaming?: boolean; fileLinks?: { workspaceId: string; hostId: string } }) {
  const segments = useMemo(() => splitMarkdown(text, streaming), [text, streaming]);
  const html = useMemo(() => segments.map((segment) => (segment.kind === "html" ? segment.html : "")).join(""), [segments]);
  const body = useRef<HTMLDivElement>(null);
  const { workspaceId, hostId } = fileLinks ?? {};
  // Links that name a file in the workspace become pills that open it; the core decides which do.
  const [files, setFiles] = useState<ReadonlyMap<string, FsLink>>(new Map());
  const [linkError, setLinkError] = useState<string | null>(null);
  useEffect(() => {
    if (!workspaceId || !hostId || streaming) return;
    const targets = linkTargets(html);
    if (!targets.length) return;
    let current = true;
    requestFileLinks(workspaceId, hostId, targets).then((links) => { if (current) setFiles(new Map(links.map((link) => [link.href, link]))); }, () => {});
    return () => { current = false; };
  }, [html, workspaceId, hostId, streaming]);
  useEffect(() => {
    for (const anchor of Array.from(body.current?.querySelectorAll("a[href]") ?? [])) {
      const link = files.get(anchor.getAttribute("href")!.trim());
      if (!link) continue;
      anchor.classList.add(...FILE_LINK.split(" "));
      anchor.setAttribute("data-file-path", link.path);
      anchor.setAttribute("title", link.line ? `${link.path}:${link.line}` : link.path);
    }
  }, [html, files]);
  const open = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as Element).closest?.("a[href]");
    if (!anchor) return;
    // Never navigate the app itself, even before file resolution or for an unsupported scheme.
    event.preventDefault();
    setLinkError(null);
    const href = anchor.getAttribute("href")?.trim() ?? "";
    if (webUrl(href)) { openTerminalLink(event.nativeEvent, href); return; }
    if (!workspaceId || !couldBeFile(href)) return;
    const link = files.get(href);
    if (!link) return;
    if (event.metaKey || event.ctrlKey) {
      const workspace = workspaceRecord(usePerchStore.getState(), workspaceId);
      if (!tauriInvoke || workspace?.hostId !== "local") {
        setLinkError("Open in the default app is only available for local files in the desktop app.");
        return;
      }
      void tauriInvoke("open_in_default_app", { path: joinPath(workspace.path.replace(/\/+$/, ""), link.path) })
        .catch((error: unknown) => setLinkError(error instanceof Error ? error.message : String(error)));
    } else useFileTabs.getState().open(workspaceId, link.path);
  };
  return <>
    <div ref={body} onClick={open} className="message__markdown whitespace-normal" data-testid="chat-markdown">
      {segments.map((segment, index) => {
        if (segment.kind === "html") return <SafeHtml key={index} html={segment.html} />;
        const ui = segment.lang === "perch-ui" ? parseUi(segment.text) : null;
        return ui ? <PerchUi key={index} blocks={ui} /> : <CodeBlock key={index} lang={segment.lang} text={segment.text} />;
      })}
    </div>
    {linkError && <div className={cn("message__error", "mt-[0.35rem] text-red")} role="alert">{linkError}</div>}
  </>;
}
