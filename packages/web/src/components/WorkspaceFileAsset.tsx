import { useState } from "react";
import type { FileMetadata } from "@perch/shared";
import { getWorkspaceFileUrl } from "../base";
import { useWorkspaceFilesStore } from "../filesystemStore";
import { cn } from "../lib/cn";
import { GHOST_BUTTON } from "./ui/icon-button";
import { WorkspacePdf } from "./WorkspacePdf";

/** Media stays outside text buffers. Browser viewers handle images/audio/video;
 * PDF.js is lazy-loaded because embedded native PDF plugins are unreliable. */
export function WorkspaceFileAsset({ workspaceId, metadata }: { workspaceId: string; metadata: FileMetadata }) {
  const [failed, setFailed] = useState(false);
  const extraction = useWorkspaceFilesStore((state) => state.extractions[workspaceId]?.[metadata.path]);
  const extract = useWorkspaceFilesStore((state) => state.extractArchive);
  const url = getWorkspaceFileUrl(workspaceId, metadata.path);
  const mime = metadata.mediaType ?? "";
  const archive = ["application/zip", "application/x-tar", "application/gzip"].includes(mime);
  const image = mime.startsWith("image/");
  const video = mime.startsWith("video/");
  const audio = mime.startsWith("audio/");
  const pdf = mime === "application/pdf";
  const hasPreview = image || video || audio || pdf;
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label={`Previewing ${metadata.path}`} data-testid="workspace-file-asset">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-overlay-0 px-3 py-2 text-[0.75rem]">
        <strong className="min-w-0 flex-1 truncate" title={metadata.path}>{metadata.path}</strong>
        {archive && <button type="button" className={cn(GHOST_BUTTON, "min-h-8 px-2")} disabled={extraction?.state === "loading"} onClick={() => extract(workspaceId, metadata.path)}>
          {extraction?.state === "loading" ? "Extracting…" : "Extract"}
        </button>}
        <a className={cn(GHOST_BUTTON, "inline-flex min-h-8 items-center px-2")} href={getWorkspaceFileUrl(workspaceId, metadata.path, true)} download={metadata.name}>Download</a>
      </header>
      {extraction?.state === "ready" && <p role="status" className="m-0 px-3 py-2 text-[0.75rem] text-subtext-0">Extracted to {extraction.destination}. Find it in the file tree.</p>}
      {extraction?.state === "error" && <p role="alert" className="m-0 px-3 py-2 text-[0.75rem] text-red">{extraction.error}</p>}
      {!hasPreview || failed ? (
        <div className="grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0">
          <strong className="text-fg">{archive ? "Compressed archive" : failed ? "Preview unavailable" : "No preview for this file type"}</strong>
          <span>{archive ? "Extract into a new folder beside this archive. Existing files are never overwritten." : "Download this file to open it in another app. Media support depends on your browser and codecs."}</span>
        </div>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-auto p-3">
          {image && <img className="max-h-full max-w-full object-contain" src={url} alt={metadata.name} onError={() => setFailed(true)} data-testid="workspace-file-image" />}
          {video && <video className="max-h-full max-w-full" src={url} controls preload="metadata" onError={() => setFailed(true)} aria-label={metadata.name} data-testid="workspace-file-video" />}
          {audio && <audio className="max-w-full" src={url} controls preload="metadata" onError={() => setFailed(true)} aria-label={metadata.name} />}
          {pdf && <WorkspacePdf url={url} />}
        </div>
      )}
    </section>
  );
}
