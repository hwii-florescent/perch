import { useEffect, useMemo, useRef, useState } from "react";
import type { DirectoryEntry, FileMetadata } from "@perch/shared";
import { usePerchStore, type WorkspaceRecord } from "../store";
import {
  normalizeWorkspacePath,
  useWorkspaceFilesStore,
  type WorkspaceDocumentState,
  type WorkspacePreviewState,
  type WorkspaceSearchState,
  type WorkspaceTreeState,
} from "../filesystemStore";
import { cn } from "../lib/cn";
import { Chevron } from "./ui/chevron";
import { GHOST_BUTTON } from "./ui/icon-button";
import { WorkspaceFileAsset } from "./WorkspaceFileAsset";
import { assetKind } from "./workspaceFileKind";

// The legacy rules set `font:` shorthands with an undefined variable and with `inherit`
// inside the shorthand (invalid), so text here inherits the page font and buttons keep the browser's default:
// `[font:inherit]` only where an element would otherwise fall back to its UA font.
// The pane's own width, not the viewport's, decides the narrow layout (`@container` below).
// Tokens kept for e2e/CSS: `workspace-files`, `__mobile-explorer`, `__file-title`, `__save`.
const SECTION = "workspace-files relative flex h-full min-h-0 w-full min-w-0 flex-col bg-panel-bg text-fg [box-shadow:none] [container-type:inline-size]";
const EMPTY = "grid min-h-full content-center justify-items-start gap-[0.35rem] p-5 text-[0.72rem] text-subtext-0";
const PREVIEW_STATE = "shrink-0 px-[0.7rem] py-[0.55rem] text-[0.68rem] text-subtext-0";
const COMPARE_LABEL = "mb-[0.2rem] block text-subtext-0 uppercase";
const BTN = "min-h-[1.8rem] cursor-pointer rounded-ui border border-overlay-0 bg-transparent px-[0.48rem] py-[0.28rem] text-subtext-0";
const BTN_HOVER = "hover:border-accent hover:text-fg focus-visible:border-accent focus-visible:text-fg";
const TOOL = `${BTN} ${BTN_HOVER} disabled:cursor-not-allowed disabled:opacity-[0.45] [@container(max-width:460px)]:min-h-[2.5rem] [@container(max-width:460px)]:px-[0.42rem]`;
const TOOL_ACTIVE = "min-h-[1.8rem] cursor-pointer rounded-ui border border-accent bg-transparent px-[0.48rem] py-[0.28rem] text-accent hover:text-fg focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-[0.45] [@container(max-width:460px)]:min-h-[2.5rem] [@container(max-width:460px)]:px-[0.42rem]";
const DANGER = "border-red! text-red!";
const ACTIONS = "flex shrink-0 items-center gap-[0.35rem]";
const TREE_STATE = "px-[0.65rem] py-[0.45rem] text-[0.68rem] text-subtext-0";
const TREE_BUTTON = "ml-[0.35rem] cursor-pointer rounded-ui border border-current bg-transparent px-[0.26rem] py-[0.12rem] text-inherit [font:inherit]";
const CODE = "text-overlay-1 [font:inherit]";
const PRE = "m-0 overflow-auto border border-overlay-0 bg-surface-0 p-[0.55rem] text-fg whitespace-pre-wrap [font:inherit] [overflow-wrap:anywhere]";
const BANNER = "shrink-0 border-b border-b-[color:color-mix(in_srgb,var(--yellow)_35%,transparent)] bg-[color-mix(in_srgb,var(--yellow)_8%,transparent)] text-[0.66rem] text-yellow";
const MOBILE_BTN = "hidden min-h-[2.5rem] cursor-pointer rounded-ui border border-overlay-0 bg-transparent px-[0.55rem] py-[0.35rem] text-accent hover:border-accent focus-visible:border-accent";

const EMPTY_TREES: Record<string, WorkspaceTreeState> = {};
const EMPTY_DOCUMENTS: Record<string, WorkspaceDocumentState> = {};
const EMPTY_PREVIEWS: Record<string, WorkspacePreviewState> = {};

function basename(path: string): string {
  const parts = path.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || path;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatModifiedAt(metadata?: FileMetadata): string {
  if (!metadata?.modifiedAtMs) return "";
  const date = new Date(metadata.modifiedAtMs);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

interface FileTreeProps {
  workspaceId: string;
  path: string;
  level: number;
  expanded: Set<string>;
  selectedPath: string | null;
  trees: Record<string, WorkspaceTreeState>;
  onToggle: (entry: DirectoryEntry) => void;
  onOpenFile: (entry: DirectoryEntry) => void;
}

function FileTree({
  workspaceId,
  path,
  level,
  expanded,
  selectedPath,
  trees,
  onToggle,
  onOpenFile,
}: FileTreeProps) {
  const tree = trees[path];
  if (!tree) return null;
  return (
    <div className="min-w-0" data-testid={`workspace-file-tree-${path || "root"}`}>
      {tree.entries.map((entry) => {
        const isDirectory = entry.kind === "directory";
        const isOpen = expanded.has(entry.path);
        const childTree = trees[entry.path];
        const selected = selectedPath === entry.path;
        return (
          <div key={entry.path} className="min-w-0">
            <button
              type="button"
              className={cn(
                "flex min-h-[1.4rem] w-full cursor-pointer items-center gap-[0.15rem] pr-2 text-left text-[0.8rem] [border:0] [font:inherit] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg [@container(max-width:460px)]:min-h-[2.35rem]",
                selected ? "bg-surface-1 text-fg" : "bg-transparent text-subtext-0",
              )}
              style={{ paddingLeft: "0.25rem" }}
              data-testid={`workspace-file-entry-${entry.path}`}
              title={entry.path}
              onClick={() => (isDirectory ? onToggle(entry) : onOpenFile(entry))}
            >
              <Chevron open={isOpen} size={16} className={cn("shrink-0 text-overlay-1", !isDirectory && "invisible")} />
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{entry.name}</span>
              {entry.kind === "symlink" && <span className="shrink-0 text-overlay-1" aria-label="symlink">↗</span>}
              {entry.readonly && <span className="ml-auto pr-[0.35rem] text-[0.54rem] text-yellow">RO</span>}
            </button>
            {isDirectory && isOpen && childTree && (
              <div className="ml-[0.75rem] border-l border-l-overlay-0">
                {childTree.state === "loading" && <div className={TREE_STATE}>Loading…</div>}
                {childTree.state === "error" && (
                  <div className={cn(TREE_STATE, "text-red")}>
                    {childTree.error || "Could not load folder."}
                    <button type="button" className={TREE_BUTTON} onClick={() => onToggle(entry)}>Retry</button>
                  </div>
                )}
                {childTree.state === "ready" && (
                  <FileTree
                    workspaceId={workspaceId}
                    path={entry.path}
                    level={level + 1}
                    expanded={expanded}
                    selectedPath={selectedPath}
                    trees={trees}
                    onToggle={onToggle}
                    onOpenFile={onOpenFile}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
      {tree.truncated && <div className={TREE_STATE}>Large folder · narrow the view to load more</div>}
      {tree.state === "ready" && tree.entries.length === 0 && <div className={TREE_STATE}>Empty folder</div>}
    </div>
  );
}

function lineCount(content: string): number {
  return Math.max(1, content.split("\n").length);
}

/** Return one gutter row for every visual row in a wrapped textarea. The
 * editor uses a monospace face, so measuring its available character columns
 * keeps the gutter in lockstep with soft wrapping while retaining stable
 * logical line numbers on the first row of each wrapped line. */
function visualLineNumbers(content: string, editorWidth: number): Array<number | null> {
  const glyphWidth = 7.2;
  const padding = 24;
  const columns = Math.max(1, Math.floor((editorWidth - padding) / glyphWidth) || 80);
  const rows: Array<number | null> = [];
  for (const [index, line] of content.split("\n").entries()) {
    let expandedLength = 0;
    for (const character of line) {
      expandedLength += character === "\t" ? 2 : 1;
    }
    const visualRows = Math.max(1, Math.ceil(Math.max(1, expandedLength) / columns));
    rows.push(index + 1);
    for (let row = 1; row < visualRows; row += 1) rows.push(null);
  }
  return rows.length > 0 ? rows : [1];
}

function matchCount(content: string, query: string): number {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return 0;
  let count = 0;
  let offset = 0;
  const haystack = content.toLowerCase();
  while (true) {
    const index = haystack.indexOf(normalized, offset);
    if (index < 0) return count;
    count += 1;
    offset = index + normalized.length;
  }
}

function metadataSummary(metadata?: FileMetadata): string {
  if (!metadata) return "";
  const parts = [formatBytes(metadata.size)];
  const modified = formatModifiedAt(metadata);
  if (modified) parts.push(modified);
  if (metadata.executable) parts.push("executable");
  return parts.join(" · ");
}

function PreviewPanel({ preview }: { preview: WorkspacePreviewState }) {
  if (preview.state === "loading") return <div className={PREVIEW_STATE}>Loading preview…</div>;
  if (preview.state === "error") return <div className={cn(PREVIEW_STATE, "text-red")} role="alert">{preview.error || "Preview unavailable."}</div>;
  if (preview.state !== "ready") return null;
  if (preview.kind === "html" && preview.content) {
    return (
      <div className="flex min-h-[8rem] flex-[0_1_40%] flex-col border-t border-t-overlay-0">
        <div className={cn(PREVIEW_STATE, "py-[0.3rem] text-yellow")}>HTML is isolated in a sandboxed preview.</div>
        <iframe className="min-h-[8rem] w-full flex-1 bg-[#fff] [border:0]" sandbox="" title="Sandboxed file preview" srcDoc={preview.content} />
      </div>
    );
  }
  if (preview.kind === "image" || preview.kind === "binary" || preview.kind === "tooLarge") {
    return <div className={PREVIEW_STATE}>{preview.message || "This file is not rendered in the editor."}</div>;
  }
  return (
    <pre className={cn(PRE, "max-h-[30%] border-t border-t-overlay-0")} data-testid="workspace-file-preview-content">
      {preview.content || preview.message || "No preview content."}
    </pre>
  );
}

function ConflictPanel({
  document,
  preview,
  onCompare,
  onReload,
  onOverwrite,
}: {
  document: WorkspaceDocumentState;
  preview?: WorkspacePreviewState;
  onCompare: () => void;
  onReload: () => void;
  onOverwrite: () => void;
}) {
  const [compareOpen, setCompareOpen] = useState(false);
  const conflict = document.conflict;
  return (
    <div className="grid shrink-0 gap-[0.3rem] border-b border-b-[color:color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_7%,transparent)] px-[0.65rem] py-[0.55rem] text-[0.68rem] text-subtext-0" role="alert" data-testid="workspace-file-conflict">
      <strong className="text-red">File changed on disk.</strong>
      <span>Your draft is preserved. Choose how to reconcile it.</span>
      <div className="flex gap-[0.65rem]">
        {conflict?.expectedVersion && <code className={CODE}>opened {conflict.expectedVersion.slice(0, 10)}</code>}
        {conflict?.actualVersion && <code className={CODE}>disk {conflict.actualVersion.slice(0, 10)}</code>}
      </div>
      <div className={cn(ACTIONS, "justify-end")}>
        <button type="button" className={cn(BTN, BTN_HOVER)} onClick={() => { onCompare(); setCompareOpen(true); }}>Compare</button>
        <button type="button" className={cn(BTN, BTN_HOVER)} onClick={onReload}>Reload disk</button>
        <button type="button" className={cn(BTN, BTN_HOVER, DANGER)} onClick={onOverwrite}>Overwrite disk</button>
      </div>
      {compareOpen && preview?.state === "ready" && preview.content && (
        <div className="grid max-h-[13rem] min-h-[6rem] grid-cols-[repeat(2,minmax(0,1fr))] gap-[0.45rem] overflow-auto [@container(max-width:460px)]:grid-cols-[1fr]" data-testid="workspace-file-compare">
          <div className="min-w-0"><span className={COMPARE_LABEL}>Draft</span><pre className={PRE}>{document.content}</pre></div>
          <div className="min-w-0"><span className={COMPARE_LABEL}>Disk preview</span><pre className={PRE}>{preview.content}</pre></div>
        </div>
      )}
      {compareOpen && (!preview || preview.state === "loading") && <div className={TREE_STATE}>Loading the current disk content…</div>}
    </div>
  );
}

function SearchResults({ result, query, selectedPath, onOpenFile, onRetry }: {
  result?: WorkspaceSearchState;
  query: string;
  selectedPath: string | null;
  onOpenFile: (entry: DirectoryEntry) => void;
  onRetry: () => void;
}) {
  if (result?.query !== query || result.state === "loading") {
    return <div className={TREE_STATE} role="status">Searching…</div>;
  }
  if (result.state === "error") {
    return (
      <div className={cn(TREE_STATE, "text-red")} role="alert">
        {result.error}
        <button type="button" className={TREE_BUTTON} onClick={onRetry}>Retry</button>
      </div>
    );
  }
  const count = result.entries.length;
  return (
    <>
      <div className={TREE_STATE}>{count ? `${count} file${count === 1 ? "" : "s"}` : "No matching files"}</div>
      {result.entries.map((entry) => <button type="button" key={entry.path} className={cn(GHOST_BUTTON, "flex min-h-10 w-full flex-col justify-center gap-0.5 px-3 py-1.5 text-left text-[0.8rem]", selectedPath === entry.path && "bg-surface-1 text-fg")} title={entry.path} onClick={() => onOpenFile(entry)} data-testid={`workspace-file-entry-${entry.path}`}>
        <span className="w-full truncate text-fg">{entry.name}</span>
        <span className="w-full truncate text-[0.7rem] text-subtext-0">{entry.path}</span>
      </button>)}
      {result.truncated && <div className={TREE_STATE}>Search limited for this workspace. Narrow the filename or path to see more.</div>}
    </>
  );
}

export interface WorkspaceFilesViewProps {
  workspaceId: string;
  /** Path carried by Dockview's persisted panel params. Keeping this outside
   * React-only state lets a saved mixed layout reopen the same file tab. */
  initialPath?: string;
  onPathChange?: (path: string) => void;
  onClose?: () => void;
  /** Desktop splits the surface: `"explorer"` is just the tree (the right
   * drawer), which hands a clicked file to `onOpenFile`; `"editor"` is just
   * `initialPath`'s editor (a pane tab in the main area). Unset = both, with
   * the narrow-width toggle between them (the phone). */
  layout?: "explorer" | "editor";
  onOpenFile?: (path: string) => void;
}

/** Bounded workspace file surface. Directory levels are fetched on demand;
 * files are read only after an explicit click. Text drafts are persisted in
 * server-owned buffers; media uses a descriptor-confined HTTP stream. */
export function WorkspaceFilesView({ workspaceId, initialPath, onPathChange, onClose, layout, onOpenFile }: WorkspaceFilesViewProps) {
  const workspace = usePerchStore((state) => state.workspaces.find((candidate) => candidate.id === workspaceId));
  const trees = useWorkspaceFilesStore((state) => state.trees[workspaceId] ?? EMPTY_TREES);
  const documents = useWorkspaceFilesStore((state) => state.documents[workspaceId] ?? EMPTY_DOCUMENTS);
  const previews = useWorkspaceFilesStore((state) => state.previews[workspaceId] ?? EMPTY_PREVIEWS);
  const requestTree = useWorkspaceFilesStore((state) => state.requestTree);
  const connected = usePerchStore((state) => state.connected);
  const searchResult = useWorkspaceFilesStore((state) => state.searches[workspaceId]);
  const searchFiles = useWorkspaceFilesStore((state) => state.searchFiles);
  const openFile = useWorkspaceFilesStore((state) => state.openFile);
  const reloadFile = useWorkspaceFilesStore((state) => state.reloadFile);
  const requestPreview = useWorkspaceFilesStore((state) => state.requestPreview);
  const updateDraft = useWorkspaceFilesStore((state) => state.updateDraft);
  const saveFile = useWorkspaceFilesStore((state) => state.saveFile);
  const overwriteFile = useWorkspaceFilesStore((state) => state.overwriteFile);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [fileQuery, setFileQuery] = useState("");
  const query = fileQuery.trim();
  const [wrap, setWrap] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadConfirmOpen, setReloadConfirmOpen] = useState(false);
  const [mobileExplorerOpen, setMobileExplorerOpen] = useState(true);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [editorWidth, setEditorWidth] = useState(0);
  const restoredPath = normalizeWorkspacePath(initialPath);

  useEffect(() => {
    setExpanded(new Set());
    setSelectedPath(restoredPath || null);
    setPreviewOpen(false);
    setSearch("");
    setFileQuery("");
    setNotice(null);
    setReloadConfirmOpen(false);
    setMobileExplorerOpen(!restoredPath);
    if (workspaceId && layout !== "editor") requestTree(workspaceId, "");
    if (workspaceId && restoredPath && layout !== "explorer") openFile(workspaceId, restoredPath, true);
  }, [layout, openFile, requestTree, restoredPath, workspaceId]);

  useEffect(() => {
    if (layout === "editor" || !query) return;
    const timer = setTimeout(() => searchFiles(workspaceId, query), 200);
    return () => clearTimeout(timer);
  }, [connected, layout, query, searchFiles, workspaceId]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const updateWidth = () => setEditorWidth(editor.clientWidth);
    updateWidth();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateWidth);
    observer.observe(editor);
    return () => observer.disconnect();
  }, [selectedPath]);

  const rootTree = trees[""];
  const document = selectedPath ? documents[selectedPath] : undefined;
  const preview = selectedPath ? previews[selectedPath] : undefined;
  const dirty = document != null && document.content !== document.savedContent;
  const matches = document ? matchCount(document.content, search) : 0;
  const lines = useMemo(() => lineCount(document?.content ?? ""), [document?.content]);
  const gutterLines = useMemo(
    () => wrap
      ? visualLineNumbers(document?.content ?? "", editorWidth)
      : Array.from({ length: lines }, (_, index) => index + 1),
    [document?.content, editorWidth, lines, wrap],
  );

  function handleReload() {
    if (!selectedPath || !document || document.state === "saving" || document.bufferState === "saving") return;
    if (dirty) {
      setReloadConfirmOpen(true);
      setNotice(null);
      return;
    }
    reloadFile(workspaceId, selectedPath);
  }

  function confirmReload() {
    if (!selectedPath) return;
    setReloadConfirmOpen(false);
    setNotice(null);
    reloadFile(workspaceId, selectedPath);
  }

  function handleToggle(entry: DirectoryEntry) {
    if (entry.kind !== "directory") return;
    const next = new Set(expanded);
    if (next.has(entry.path)) {
      next.delete(entry.path);
      setExpanded(next);
      return;
    }
    next.add(entry.path);
    setExpanded(next);
    if (!trees[entry.path] || trees[entry.path]?.state === "error") requestTree(workspaceId, entry.path);
  }

  function handleOpenFile(entry: DirectoryEntry) {
    if (entry.kind !== "file") {
      setNotice(entry.kind === "symlink" ? "Symlinks are metadata-only and cannot be opened." : "This entry cannot be opened.");
      return;
    }
    if (layout === "explorer") {
      setNotice(null);
      setSelectedPath(entry.path);
      onOpenFile?.(entry.path);
      return;
    }
    const existing = documents[entry.path];
    if (existing && existing.content !== existing.savedContent) {
      setNotice(`Unsaved draft kept for ${basename(entry.path)}.`);
      setSelectedPath(entry.path);
      onPathChange?.(entry.path);
      return;
    }
    setNotice(null);
    setSelectedPath(entry.path);
    onPathChange?.(entry.path);
    setMobileExplorerOpen(false);
    if (!existing || existing.state === "error") openFile(workspaceId, entry.path);
  }

  const explorerOpen = layout === "explorer" || (!layout && mobileExplorerOpen);
  // Media, archives and binary files (a failed text read) open in the asset viewer.
  const showAsset = !dirty && document?.metadata != null
    && (document.state === "error" || assetKind(document.metadata.mediaType) !== undefined);

  function refreshTree() {
    requestTree(workspaceId, "");
    for (const path of expanded) requestTree(workspaceId, path);
    if (query) searchFiles(workspaceId, query);
  }

  if (!workspace) {
    return (
      <section className={SECTION} data-testid="workspace-files-view">
        <div className={EMPTY}>Workspace is no longer available.</div>
      </section>
    );
  }

  return (
    <section
      className={cn(SECTION, layout === "editor" ? "z-auto" : "z-[3]")}
      data-testid={layout === "editor" ? "workspace-file-pane" : "workspace-files-view"}
      aria-label={`Files for ${workspace.name}`}
    >
      {!layout && <header className="flex min-h-[3.1rem] items-center justify-between gap-3 border-b border-b-overlay-0 bg-surface-0 px-[0.7rem] py-2 [@container(max-width:460px)]:min-h-[3.4rem]">
        <div className="grid min-w-0 gap-[0.12rem]">
          <span className="tracking-[0.1em] text-accent uppercase">Files</span>
          <strong className="overflow-hidden text-[0.86rem] text-ellipsis whitespace-nowrap" title={workspace.path}>{workspace.name || basename(workspace.path)}</strong>
          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-subtext-0" title={workspace.path}>{workspace.path}</span>
        </div>
        <div className={ACTIONS}>
          <button type="button" className={cn(BTN, BTN_HOVER, "w-[1.8rem] p-0 text-[1rem] [@container(max-width:460px)]:h-[2.5rem] [@container(max-width:460px)]:w-[2.5rem]")} onClick={onClose} aria-label="Close files">×</button>
        </div>
      </header>}
      {layout === "explorer" && notice && <div className={cn(BANNER, "px-[0.65rem] py-[0.3rem]")} role="status">{notice}</div>}

      <div className="flex min-h-0 min-w-0 flex-1">
        {layout !== "editor" && <aside
          className={cn(
            "flex min-h-0 flex-col overflow-hidden bg-surface-0 [@container(max-width:460px)]:flex-[1_1_100%] [@container(max-width:460px)]:[border-right:none]",
            layout === "explorer" ? "flex-[1_1_100%]" : "flex-[0_0_230px] border-r border-r-overlay-0",
            !explorerOpen && "[@container(max-width:460px)]:hidden",
          )}
          aria-label="Workspace file tree"
        >
          <div className="flex shrink-0 items-center gap-1 px-2 py-2">
            <input type="search" className="min-h-8 min-w-0 flex-1 rounded-ui border border-overlay-0 bg-panel-bg px-2 text-[0.8rem] text-fg placeholder:text-subtext-0 focus-visible:outline focus-visible:outline-1 focus-visible:outline-fg" aria-label="Search workspace files" placeholder="Search files in workspace…" maxLength={256} value={fileQuery} onChange={(event) => setFileQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setFileQuery(""); }} data-testid="workspace-files-search" />
            {fileQuery && <button type="button" className={cn(GHOST_BUTTON, "min-h-8 px-2 text-[0.75rem]")} onClick={() => setFileQuery("")}>Clear</button>}
          </div>
          <div className="flex shrink-0 items-center justify-between py-[0.3rem] pr-[0.55rem] pl-[0.65rem] text-[0.68rem] font-semibold tracking-[0.06em] text-subtext-0 uppercase">
            <span>Explorer</span>
            <div className="[@container(max-width:460px)]:flex [@container(max-width:460px)]:items-center [@container(max-width:460px)]:gap-1">
              {!layout && (
                <button
                  type="button"
                  className={cn(BTN, BTN_HOVER, "hidden min-h-[1.45rem] border-transparent px-[0.32rem] py-[0.15rem] text-[0.85rem] [@container(max-width:460px)]:inline-block")}
                  onClick={() => setMobileExplorerOpen(false)}
                  disabled={!selectedPath}
                >
                  Editor
                </button>
              )}
              <button type="button" className={cn(BTN, BTN_HOVER, "min-h-[1.45rem] border-transparent px-[0.32rem] py-[0.15rem] text-[0.85rem]")} onClick={refreshTree} aria-label="Refresh file tree" title="Refresh file tree">↻</button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto" data-testid="workspace-file-tree-scroll">
          {query ? <div aria-live="polite">
            <SearchResults result={searchResult} query={query} selectedPath={selectedPath} onOpenFile={handleOpenFile} onRetry={() => searchFiles(workspaceId, query)} />
          </div> : <>
          {rootTree?.state === "loading" && <div className={TREE_STATE} role="status">Loading tree…</div>}
          {rootTree?.state === "error" && (
            <div className={cn(TREE_STATE, "text-red")} role="alert">
              {rootTree.error || "Could not load file tree."}
              <button type="button" className={TREE_BUTTON} onClick={() => requestTree(workspaceId, "")}>Retry</button>
            </div>
          )}
          {rootTree?.state === "ready" && (
            <FileTree
              workspaceId={workspaceId}
              path=""
              level={0}
              expanded={expanded}
              selectedPath={selectedPath}
              trees={trees}
              onToggle={handleToggle}
              onOpenFile={handleOpenFile}
            />
          )}
          </>}
          </div>
        </aside>}

        {layout !== "explorer" && <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col bg-panel-bg", explorerOpen && "[@container(max-width:460px)]:hidden", !explorerOpen && "[@container(max-width:460px)]:flex-[1_1_100%]")}>
          {!layout && (
            <button
              type="button"
              className={cn("workspace-files__mobile-explorer", MOBILE_BTN, "[@container(max-width:460px)]:mt-[0.4rem] [@container(max-width:460px)]:mr-[0.65rem] [@container(max-width:460px)]:ml-[0.65rem] [@container(max-width:460px)]:block [@container(max-width:460px)]:self-start")}
              onClick={() => setMobileExplorerOpen(true)}
            >
              ‹ Explorer
            </button>
          )}
          {!selectedPath || !document ? (
            <div className={EMPTY}>
              <span className="text-accent">⌘</span>
              <strong className="text-[0.9rem] text-fg">Open a file to edit</strong>
              <span>Folders load one level at a time. Files stay inside this workspace.</span>
            </div>
          ) : showAsset ? (
            <WorkspaceFileAsset key={selectedPath} workspaceId={workspaceId} metadata={document.metadata!} />
          ) : (
            <>
              <div className="flex shrink-0 items-center justify-between gap-[0.65rem] border-b border-b-overlay-0 px-[0.65rem] py-[0.42rem] [@container(max-width:460px)]:flex-wrap">
                <div className="workspace-files__file-title flex min-w-0 items-baseline gap-[0.45rem] [@container(max-width:460px)]:flex-[1_1_9rem]">
                  <strong className="overflow-hidden text-[0.78rem] text-ellipsis whitespace-nowrap text-fg" title={selectedPath}>{basename(selectedPath)}</strong>
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-subtext-0" title={selectedPath}>{selectedPath}</span>
                  {dirty && <span className="text-[0.65rem] text-yellow" title="Unsaved changes">●</span>}
                </div>
                <div className={cn(ACTIONS, "[@container(max-width:460px)]:max-w-full [@container(max-width:460px)]:min-w-0 [@container(max-width:460px)]:flex-[1_1_100%] [@container(max-width:460px)]:flex-wrap [@container(max-width:460px)]:gap-[0.2rem]")}>
                  <button type="button" className={wrap ? TOOL_ACTIVE : TOOL} onClick={() => setWrap((value) => !value)}>Wrap</button>
                  <button type="button" className={previewOpen ? TOOL_ACTIVE : TOOL} onClick={() => { setPreviewOpen((value) => !value); if (!preview || preview.state === "error") requestPreview(workspaceId, selectedPath); }}>Preview</button>
                  <button type="button" className={TOOL} onClick={handleReload} disabled={document.state === "saving" || document.bufferState === "saving"}>Reload</button>
                  <button type="button" className="workspace-files__save min-h-[1.8rem] cursor-pointer rounded-ui border border-accent bg-accent px-[0.48rem] py-[0.28rem] font-bold text-panel-bg disabled:cursor-not-allowed disabled:opacity-[0.45] [@container(max-width:460px)]:min-h-[2.5rem] [@container(max-width:460px)]:px-[0.42rem]" onClick={() => saveFile(workspaceId, selectedPath)} disabled={document.metadata?.readonly || !dirty || document.state === "saving" || document.state === "loading" || document.state === "error"}>
                    {document.state === "saving" ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
              <div className="flex min-h-[1.55rem] items-center gap-[0.65rem] overflow-hidden px-[0.65rem] whitespace-nowrap text-subtext-0">
                <span className="overflow-hidden text-ellipsis">{metadataSummary(document.metadata)}</span>
                {document.version && <code className={CODE}>v {document.version.slice(0, 12)}</code>}
                {search && <span>{matches} match{matches === 1 ? "" : "es"}</span>}
                {document.bufferState === "saving" && <span role="status">Draft syncing…</span>}
                {document.bufferState === "error" && <span className="text-red" role="alert">Draft recovery unavailable</span>}
                {document.error && document.state !== "conflict" && <span className="text-red" role="alert">{document.error}</span>}
              </div>
              {document.state === "conflict" && (
                <ConflictPanel
                  document={document}
                  preview={preview}
                  onCompare={() => { if (!preview || preview.state === "error") requestPreview(workspaceId, selectedPath); }}
                  onReload={handleReload}
                  onOverwrite={() => overwriteFile(workspaceId, selectedPath)}
                />
              )}
              {notice && <div className={cn(BANNER, "px-[0.65rem] py-[0.3rem]")} role="status">{notice}</div>}
              {reloadConfirmOpen && (
                <div className={cn(BANNER, "flex items-center justify-between gap-[0.6rem] px-[0.65rem] py-[0.42rem] [@container(max-width:460px)]:flex-col [@container(max-width:460px)]:items-start")} role="status" data-testid="workspace-file-reload-confirm">
                  <span className="min-w-0">Discard this unsaved draft and reload from disk?</span>
                  <div className={cn(ACTIONS, "justify-end")}>
                    <button type="button" className={cn(BTN, BTN_HOVER)} onClick={() => setReloadConfirmOpen(false)}>Keep draft</button>
                    <button type="button" className={cn(BTN, BTN_HOVER, DANGER)} onClick={confirmReload}>Discard and reload</button>
                  </div>
                </div>
              )}
              <label className="flex shrink-0 items-center gap-[0.4rem] border-y border-y-[color:color-mix(in_srgb,var(--overlay-0)_65%,transparent)] px-[0.65rem] py-1 text-subtext-0">
                <span>Find</span>
                <input className="min-w-0 flex-1 rounded-ui border border-overlay-0 bg-surface-0 px-[0.3rem] py-1 text-fg [font:inherit] focus:border-accent focus:[outline:2px_solid_color-mix(in_srgb,var(--accent)_25%,transparent)] focus:[outline-offset:1px]" data-testid="workspace-file-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search in file" />
                {search && <span>{matches}</span>}
              </label>
              <div className="flex min-h-[12rem] min-w-0 flex-1 overflow-hidden bg-surface-dim">
                <div className="flex-[0_0_3.2rem] overflow-hidden border-r border-r-overlay-0 bg-surface-0 pt-[0.7rem] pr-[0.7rem] pb-4 pl-[0.3rem] text-right text-overlay-1 select-none" ref={gutterRef} aria-hidden="true">
                  {gutterLines.map((line, index) => <span className="block h-[1.55em]" key={index}>{line ?? ""}</span>)}
                </div>
                <textarea
                  className={cn("min-h-0 min-w-0 flex-1 resize-none overflow-auto bg-transparent pt-[0.7rem] pr-3 pb-4 pl-3 text-fg [border:0] [font:inherit] [outline:0] [tab-size:2]", wrap ? "whitespace-pre-wrap [overflow-wrap:anywhere]" : "whitespace-pre")}
                  data-testid="workspace-file-editor"
                  ref={editorRef}
                  value={document.content}
                  onChange={(event) => updateDraft(workspaceId, selectedPath, event.target.value)}
                  onScroll={(event) => { if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop; }}
                  wrap={wrap ? "soft" : "off"}
                  spellCheck={false}
                  readOnly={document.metadata?.readonly || document.state === "loading" || document.state === "error"}
                  aria-label={`${document.metadata?.readonly ? "Viewing" : "Editing"} ${selectedPath}`}
                />
              </div>
              {previewOpen && <PreviewPanel preview={preview ?? { workspaceId, path: selectedPath, requiresSandbox: false, truncated: false, state: "loading" }} />}
            </>
          )}
        </div>}
      </div>
    </section>
  );
}
