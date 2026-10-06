import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { cn } from "../lib/cn";
import { GHOST_BUTTON } from "./ui/icon-button";

/** Native PDF plugins aren't reliable in WKWebView or headless browsers.
 * Load PDF.js only for PDF tabs; no PDF scripts, forms or links are executed. */
export function WorkspacePdf({ url }: { url: string }) {
  const [document, setDocument] = useState<PDFDocumentProxy>();
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState("fit");
  const [width, setWidth] = useState(0);
  const [text, setText] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let active = true;
    let task: PDFDocumentLoadingTask | undefined;
    void (async () => {
      try {
        const pdf = await import("pdfjs-dist");
        if (!active) return;
        pdf.GlobalWorkerOptions.workerSrc = workerUrl;
        // ponytail: embedded/system fonts and built-in decoders only. Bundle
        // PDF.js CMaps/font/wasm assets if specialized PDFs need those resources.
        task = pdf.getDocument({ url, withCredentials: true, disableAutoFetch: true, disableStream: true });
        const loaded = await task.promise;
        if (active) setDocument(loaded);
      } catch (error) {
        if (active) { setError(String(error)); setState("error"); }
      }
    })();
    return () => { active = false; void task?.destroy().catch(() => {}); };
  }, [url]);

  useEffect(() => {
    const element = container.current!;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!document || !width) return;
    let active = true;
    let render: RenderTask | undefined;
    setState("loading");
    void (async () => {
      try {
        const page = await document.getPage(pageNumber);
        if (!active) return;
        const base = page.getViewport({ scale: 1 });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const desired = zoom === "fit" ? Math.max(1, width - 24) / base.width : Number(zoom);
        // ponytail: one page/canvas, capped at 16M pixels / 8192 per axis.
        // A tiled renderer is the upgrade for poster-sized pages at high zoom.
        const scale = Math.min(desired, 8192 / base.width / ratio, 8192 / base.height / ratio,
          Math.sqrt(16_777_216 / (base.width * base.height)) / ratio);
        const viewport = page.getViewport({ scale });
        const target = canvas.current!;
        target.width = Math.ceil(viewport.width * ratio);
        target.height = Math.ceil(viewport.height * ratio);
        target.style.width = `${viewport.width}px`;
        target.style.height = `${viewport.height}px`;
        render = page.render({ canvas: target, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
        const [, content] = await Promise.all([render.promise, page.getTextContent()]);
        if (active) {
          setText(content.items.map((item) => "str" in item ? item.str : "").join(" "));
          setState("ready");
        }
      } catch (error) {
        if (active) { setError(String(error)); setState("error"); }
      }
    })();
    return () => { active = false; render?.cancel(); };
  }, [document, pageNumber, width, zoom]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 self-stretch flex-col" data-testid="workspace-file-pdf" data-ready={state === "ready"}>
      <nav className="flex shrink-0 flex-wrap items-center justify-center gap-2 px-3 py-2 text-[0.75rem]" aria-label="PDF navigation">
        <button type="button" className={cn(GHOST_BUTTON, "min-h-8 px-2")} disabled={!document || pageNumber <= 1} onClick={() => setPageNumber((page) => page - 1)}>Previous page</button>
        <span aria-live="polite">Page {pageNumber} of {document?.numPages ?? "…"}</span>
        <button type="button" className={cn(GHOST_BUTTON, "min-h-8 px-2")} disabled={!document || pageNumber >= document.numPages} onClick={() => setPageNumber((page) => page + 1)}>Next page</button>
        <select aria-label="PDF zoom" className="min-h-8 rounded-ui border border-overlay-0 bg-panel-bg px-1 text-fg" value={zoom} onChange={(event) => setZoom(event.target.value)}>
          <option value="fit">Fit width</option><option value="1">100%</option><option value="1.5">150%</option><option value="2">200%</option>
        </select>
      </nav>
      {state === "loading" && <p role="status" className="m-0 px-3 py-1 text-[0.75rem] text-subtext-0">Loading PDF…</p>}
      {state === "error" && <p role="alert" className="m-0 px-3 py-2 text-[0.75rem] text-red">Could not preview this PDF. {error} Use Download to open it in another app.</p>}
      <div ref={container} className="min-h-0 min-w-0 flex-1 overflow-auto p-3">
        <canvas ref={canvas} className={cn("mx-auto block", state !== "ready" && "invisible")} aria-hidden="true" data-testid="workspace-pdf-canvas" />
        <div role="document" aria-label={`PDF page ${pageNumber} text`} className="sr-only">{text}</div>
      </div>
    </div>
  );
}
