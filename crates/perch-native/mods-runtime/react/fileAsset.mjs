//! `FileAsset` for the native client: the web's `WorkspaceFileAsset` (same markup and classes, so the parity gate
//! names the same boxes) with what a browser did natively done by the host's `perch-media` module (`perch.media`):
//! the image is an engine node drawn by `perch-media`'s `Image`, and PDF, audio and video are a card whose buttons
//! open the workspace's real file in Quick Look or its default app. The web's Fit / 100% / zoom arithmetic, keys and
//! messages are its own, line for line.
//!
//! From the host: `perch.media` (the module), `perch.mediaFile(workspaceId, path)` →
//! `{ root: string | null, extraction: { state, destination?, error? } | null }` (`root` is the workspace's absolute
//! folder on this computer, null for a remote workspace), and the command `files.extract { workspaceId, path }`.
import { createElement as h, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../../../packages/web/src/lib/cn.ts";
import { GHOST_BUTTON } from "../../../../packages/web/src/components/ui/icon-button.ts";
import { assetKind } from "../../../../packages/web/src/components/workspaceFileKind.ts";

/** The web's `MAX_IMAGE_BYTES`; `perch-media` refuses the same. */
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const STEP = 1.25;
const MIN_SCALE = 0.05;
const MAX_SIDE = 16_384;
const BTN = cn(GHOST_BUTTON, "min-h-8 min-w-8 px-2 text-[0.75rem] max-[700px]:min-h-11 max-[700px]:min-w-11");
const KIND_LABEL = { pdf: "PDF document", audio: "Audio", video: "Video" };

let keys = 0;

/** `files.tsx`'s size label. */
export function sizeLabel(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The scale after one step from `current`, clamped as the web's viewer clamps it. */
export function zoomStep(current, natural, direction) {
  const maxScale = natural ? Math.min(8, MAX_SIDE / Math.max(natural.width, natural.height)) : 1;
  const scale = direction === "in" ? current * STEP : direction === "out" ? current / STEP : 1;
  return Math.min(maxScale, Math.max(Math.min(MIN_SCALE, maxScale), scale));
}

/** The workspace's real file: its folder and the relative path, or null when there is none on this computer. */
export function realPath(root, path) {
  if (typeof root !== "string" || !root.startsWith("/")) return null;
  return `${root.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function WorkspaceImage({ media, workspaceId, metadata, onFail }) {
  const key = useMemo(() => `media-${++keys}`, []);
  const [natural, setNatural] = useState(null);
  const [zoom, setZoom] = useState("fit");
  useEffect(() => {
    let live = true;
    media.open(key, { workspaceId, path: metadata.path, mediaType: metadata.mediaType ?? "", size: metadata.size })
      .then((size) => { if (live) setNatural(size ?? { width: 0, height: 0 }); }, (error) => { if (live) onFail(String(error?.message ?? error)); });
    return () => { live = false; media.release(key); };
  }, [key]);
  useEffect(() => { media.setZoom(key, zoom === "fit" ? null : zoom); }, [key, zoom]);
  const sized = natural !== null && natural.width > 0 && natural.height > 0;
  const current = () => (zoom !== "fit" ? zoom : media.fitScale(key) ?? 1);
  const step = (direction) => setZoom(zoomStep(current(), natural, direction));
  const onKeyDown = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || !sized) return;
    if (event.key === "+" || event.key === "=") step("in");
    else if (event.key === "-") step("out");
    else if (event.key === "0") step("actual");
    else return;
    event.preventDefault();
  };
  const percent = zoom === "fit" ? "Fit" : `${Math.round(zoom * 100)}%`;
  return h("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col", "data-testid": "workspace-image-viewer" },
    h("div", { className: "flex shrink-0 flex-wrap items-center gap-1 px-3 py-1 text-[0.72rem] text-subtext-0", role: "toolbar", "aria-label": "Image view" },
      h("button", { type: "button", className: BTN, "aria-label": "Zoom out", title: "Zoom out (-)", disabled: !sized, onClick: () => step("out") }, "−"),
      h("button", { type: "button", className: BTN, "aria-label": "Zoom in", title: "Zoom in (+)", disabled: !sized, onClick: () => step("in") }, "+"),
      h("button", { type: "button", className: cn(BTN, zoom === "fit" && "text-fg"), "aria-pressed": zoom === "fit", onClick: () => setZoom("fit") }, "Fit"),
      h("button", { type: "button", className: cn(BTN, zoom === 1 && "text-fg"), "aria-pressed": zoom === 1, title: "Actual size (0)", disabled: !sized, onClick: () => step("actual") }, "100%"),
      h("span", { role: "status", className: "px-1", "data-testid": "workspace-image-info" }, sized ? `${natural.width} × ${natural.height} · ${percent}` : "")),
    h("div", {
      className: "flex min-h-0 min-w-0 flex-1",
      tabIndex: 0,
      "aria-label": `${metadata.name} image. Plus and minus zoom, 0 shows actual size, arrow keys pan.`,
      onKeyDown,
    }, natural === null
      ? h("span", { className: "m-auto text-[0.8rem] text-subtext-0", role: "status" }, "Loading…")
      : h("div", { className: "relative min-h-0 min-w-0 flex-1", "data-perch-engine": "image", "data-perch-key": key, "data-testid": "workspace-file-image" })));
}

/** Media stays outside text buffers: images draw natively, PDF, audio and video open outside Perch. */
export function FileAsset({ workspaceId, metadata, perch }) {
  const [failed, setFailed] = useState(false);
  const info = perch.mediaFile?.(workspaceId, metadata.path) ?? { root: null, extraction: null };
  const extraction = info.extraction;
  const kind = assetKind(metadata.mediaType);
  const file = realPath(info.root, metadata.path);
  const remote = file === null;
  const archive = kind === "archive";
  const oversized = kind === "image" && metadata.size > MAX_IMAGE_BYTES;
  const hasPreview = kind !== undefined && !archive && !remote && !oversized;
  let unavailableDescription = "Open this file in Quick Look or its default app.";
  if (remote) unavailableDescription = "Use your SSH tools to download this file. Perch will not open a remote path on this machine.";
  else if (archive) unavailableDescription = "Extract into a new folder beside this archive. Existing files are never overwritten.";
  let unavailableTitle = "No preview for this file type";
  if (remote) unavailableTitle = "Remote media is not available yet";
  else if (archive) unavailableTitle = "Compressed archive";
  else if (oversized) {
    unavailableTitle = "Image too large to preview";
    unavailableDescription = `This image is ${Math.round(metadata.size / 1048576)} MB. Open it in Quick Look or its default app.`;
  } else if (failed) {
    unavailableTitle = "Preview unavailable";
    if (kind === "image") unavailableDescription = "The image may be corrupt or in a format Perch cannot decode. Open it in Quick Look or its default app.";
  }
  const open = (how) => { try { perch.media[how](file); } catch (error) { console.error(`perch-media ${how}: ${error?.message ?? error}`); } };
  const card = kind === "pdf" || kind === "audio" || kind === "video";
  return h("section", { className: "flex min-h-0 min-w-0 flex-1 flex-col", "aria-label": `Previewing ${metadata.path}`, "data-testid": "workspace-file-asset" },
    h("header", { className: "flex shrink-0 flex-wrap items-center gap-2 px-3 py-2 text-[0.75rem]" },
      h("strong", { className: "min-w-0 flex-1 truncate", title: metadata.path }, metadata.path),
      archive && h("button", { type: "button", className: cn(GHOST_BUTTON, "min-h-8 px-2"), disabled: extraction?.state === "loading", onClick: () => perch.command("files.extract", { workspaceId, path: metadata.path }) },
        extraction?.state === "loading" ? "Extracting…" : "Extract"),
      !remote && h("button", { type: "button", className: cn(GHOST_BUTTON, "min-h-8 px-2"), onClick: () => open("quickLook") }, "Quick Look"),
      !remote && h("button", { type: "button", className: cn(GHOST_BUTTON, "min-h-8 px-2"), onClick: () => open("openDefault") }, "Open with Default App")),
    extraction?.state === "ready" && h("p", { role: "status", className: "m-0 px-3 py-2 text-[0.75rem] text-subtext-0" }, `Extracted to ${extraction.destination}. Find it in the file tree.`),
    extraction?.state === "error" && h("p", { role: "alert", className: "m-0 px-3 py-2 text-[0.75rem] text-red" }, extraction.error),
    !hasPreview || failed
      ? h("div", { className: "grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0" },
        h("strong", { className: "text-fg" }, unavailableTitle),
        h("span", null, unavailableDescription))
      : kind === "image"
        ? h(WorkspaceImage, { media: perch.media, workspaceId, metadata, onFail: () => setFailed(true) })
        : card && h("div", { className: "grid flex-1 content-center justify-items-center gap-2 p-5 text-center text-[0.8rem] text-subtext-0", "data-testid": "workspace-file-card" },
          h("strong", { className: "text-fg" }, metadata.name),
          h("span", null, `${KIND_LABEL[kind]} · ${sizeLabel(metadata.size)}`),
          h("span", null, "Perch does not play or render this file. Open it in Quick Look or its default app.")));
}
