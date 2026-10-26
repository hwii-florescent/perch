import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { DirectoryEntry, FileMetadata } from "@perch/shared";
import { usePerchStore } from "../store";
import {
  normalizeWorkspacePath,
  useWorkspaceFilesStore,
  type WorkspaceDocumentState,
  type WorkspacePreviewState,
  type WorkspaceSearchState,
  type WorkspaceTreeState,
} from "../filesystemStore";
import { askAgent, contextBridgeAvailable } from "../contextBridge";
import { cn } from "../lib/cn";
import { Chevron } from "./ui/chevron";
import { GHOST_BUTTON } from "./ui/icon-button";
import { FileEntryMenu } from "./FileEntryMenu";
import { WorkspaceFileAsset } from "./WorkspaceFileAsset";
import { assetKind } from "./workspaceFileKind";
import { explorerKey, flattenTree } from "../explorerNav";
import { IS_MAC } from "../keyCombo";
import { useZoom } from "../zoom";
import type { CodeEditorHandle } from "./CodeEditor";
import { EMPTY_GIT_REVIEW_STATE, gitCapabilityForWorkspace, useWorkspaceGitReviewStore } from "../gitReviewStore";
import { FileIcon, GitMarker, indexGitDecorations, type GitDecoration } from "./fileDecorations";

// CodeMirror is its own chunk: it loads when the first file opens, not with the app.
const CodeEditor = lazy(() => import("./CodeEditor").then((module) => ({ default: module.CodeEditor })));

/** The row under the keyboard cursor, ringed while the tree has focus. */
const CURSOR_RING = "group-focus/tree:ring-1 group-focus/tree:ring-inset group-focus/tree:ring-overlay-1";

// The legacy rules set `font:` shorthands with an undefined variable and with `inherit`
// inside the shorthand (invalid), so text here inherits the page font and buttons keep the browser's default:
// `[font:inherit]` only where an element would otherwise fall back to its UA font.
// The pane's own width, not the viewport's, decides the narrow layout (`@container` below).
// Tokens kept for e2e/CSS: `workspace-files`, `__mobile-explorer`, `__file-title`, `__save`.
const SECTION = "workspace-files relative flex h-full min-h-0 w-full min-w-0 flex-col bg-[var(--workspace-tools-bg,var(--panel-bg))] text-fg [box-shadow:none] [container-type:inline-size]";
const EMPTY = "grid min-h-full content-center justify-items-start gap-[0.35rem] p-5 text-[0.72rem] text-subtext-0";
const PREVIEW_STATE = "shrink-0 px-[0.7rem] py-[0.55rem] text-[0.68rem] text-subtext-0";
const COMPARE_LABEL = "mb-[0.2rem] block text-subtext-0 uppercase";
const BTN = "min-h-[1.8rem] cursor-pointer rounded-ui border border-overlay-0 bg-transparent px-[0.48rem] py-[0.28rem] text-subtext-0";
const BTN_HOVER = "hover:border-accent hover:text-fg focus-visible:border-accent focus-visible:text-fg";
const DANGER = "border-red! text-red!";
const ACTIONS = "flex shrink-0 items-center gap-[0.35rem]";
const TREE_STATE = "px-[0.65rem] py-[0.45rem] text-[0.68rem] text-subtext-0";
const TREE_BUTTON = "ml-[0.35rem] cursor-pointer rounded-ui border border-current bg-transparent px-[0.26rem] py-[0.12rem] text-inherit [font:inherit]";
const CODE = "text-overlay-1 [font:inherit]";
const PRE = "m-0 overflow-auto border border-overlay-0 bg-surface-0 p-[0.55rem] text-fg whitespace-pre-wrap [font:inherit] [overflow-wrap:anywhere]";
const BANNER = "shrink-0 border-b border-b-[color:color-mix(in_srgb,var(--yellow)_35%,transparent)] bg-[color-mix(in_srgb,var(--yellow)_8%,transparent)] text-[0.66rem] text-yellow";

// VS Code's explorer metrics (explorerviewlet.css, tree.css), tighter: 18px rows (VS Code: 22), an 8px indent per level, a 16px twistie cell
// holding a 10px chevron. Text stays 12px like the project organizer (VS Code uses 13px); the narrow/phone tree keeps 44px touch targets.
const ROW_FONT = "text-[length:calc(12px*var(--zoom,1))]";
const ROW_MIN_H = "min-h-[calc(18px*var(--zoom,1))]";
const HEADER_ICON = cn(GHOST_BUTTON, "grid size-6 place-items-center p-0");

function HeaderIcon({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" className={cn(HEADER_ICON, active && "text-fg")} aria-label={label} title={label} onClick={onClick}>
      <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
    </button>
  );
}

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
  cursor: string | null;
  trees: Record<string, WorkspaceTreeState>;
  decorations: Map<string, GitDecoration>;
  onToggle: (entry: DirectoryEntry) => void;
  onOpenFile: (entry: DirectoryEntry, pinned?: boolean) => void;
  onMenu: (entry: DirectoryEntry, x: number, y: number) => void;
}

function FileTree({
  workspaceId,
  path,
  level,
  expanded,
  selectedPath,
  cursor,
  trees,
  decorations,
  onToggle,
  onOpenFile,
  onMenu,
}: FileTreeProps) {
  const zoom = useZoom();
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
                cn(ROW_MIN_H, ROW_FONT), "flex w-full cursor-pointer items-center gap-1 rounded-ui pr-3 text-left [border:0] [font-family:inherit] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg [@container(max-width:460px)]:min-h-11",
                selected || cursor === entry.path ? "bg-surface-1 text-fg" : "bg-transparent text-subtext-0",
                cursor === entry.path && CURSOR_RING,
              )}
              style={{ paddingLeft: "0.75rem" }}
              role="treeitem"
              aria-selected={selected}
              aria-expanded={isDirectory ? isOpen : undefined}
              tabIndex={-1}
              data-path={entry.path}
              data-testid={`workspace-file-entry-${entry.path}`}
              title={entry.path}
              onClick={() => (isDirectory ? onToggle(entry) : onOpenFile(entry))}
              onDoubleClick={() => { if (!isDirectory) onOpenFile(entry, true); }}
              // VS Code pins on a middle click too.
              onAuxClick={(event) => { if (event.button === 1 && !isDirectory) { event.preventDefault(); onOpenFile(entry, true); } }}
              onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onMenu(entry, event.clientX, event.clientY); }}
            >
              <Chevron open={isOpen} size={Math.round(10 * zoom)} className={cn("mx-[3px] shrink-0 text-overlay-1", !isDirectory && "invisible")} />
              <FileIcon name={entry.name} directory={isDirectory} open={isOpen} />
              <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{entry.name}</span>
              {entry.kind === "symlink" && <svg className="size-3 shrink-0 text-subtext-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" role="img" aria-label="symlink"><path d="M6 10 10 6M6 5l2-2a3 3 0 0 1 4 4l-2 2M10 11l-2 2a3 3 0 0 1-4-4l2-2" /></svg>}
              {entry.readonly && <span className="shrink-0 text-[0.54rem] text-yellow">RO</span>}
              <GitMarker decoration={decorations.get(entry.path)} directory={isDirectory} />
            </button>
            {isDirectory && isOpen && childTree && (
              <div className="ml-2">
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
                    cursor={cursor}
                    trees={trees}
                    decorations={decorations}
                    onToggle={onToggle}
                    onOpenFile={onOpenFile}
                    onMenu={onMenu}
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

function SearchResults({ result, query, selectedPath, cursor, decorations, onOpenFile, onMenu, onRetry }: {
  result?: WorkspaceSearchState;
  query: string;
  selectedPath: string | null;
  cursor: string | null;
  decorations: Map<string, GitDecoration>;
  onOpenFile: (entry: DirectoryEntry) => void;
  onMenu: (entry: DirectoryEntry, x: number, y: number) => void;
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
      {result.entries.map((entry) => <button type="button" key={entry.path} className={cn(GHOST_BUTTON, "flex min-h-10 w-full flex-col justify-center gap-0.5 px-3 py-1.5 text-left", ROW_FONT, (selectedPath === entry.path || cursor === entry.path) && "bg-surface-1 text-fg", cursor === entry.path && CURSOR_RING)} role="treeitem" aria-selected={selectedPath === entry.path} tabIndex={-1} data-path={entry.path} title={entry.path} onClick={() => onOpenFile(entry)} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onMenu(entry, event.clientX, event.clientY); }} data-testid={`workspace-file-entry-${entry.path}`}>
        <span className="flex w-full min-w-0 items-center gap-1.5 text-fg"><FileIcon name={entry.name} /><span className="min-w-0 flex-1 truncate">{entry.name}</span><GitMarker decoration={decorations.get(entry.path)} /></span>
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
  /** The surface is split in two, on the phone as on the desktop: `"explorer"` is just
   * the tree (the right drawer; on the phone the Files pane), which hands a clicked file
   * to `onOpenFile`; `"editor"` is just `initialPath`'s editor (a pane tab in the main
   * area; on the phone the screen a tapped file opens). */
  layout: "explorer" | "editor";
  /** `pinned`: a double click or an explicit action, so the tab is a regular one, not a preview. */
  onOpenFile?: (path: string, pinned?: boolean) => void;
}

/** Bounded workspace file surface. Directory levels are fetched on demand;
 * files are read only after an explicit click. Text drafts are persisted in
 * server-owned buffers; media uses a descriptor-confined HTTP stream. */
let wrapPreference = false;

export function WorkspaceFilesView({ workspaceId, initialPath, onPathChange, layout, onOpenFile }: WorkspaceFilesViewProps) {
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
  const [fileQuery, setFileQuery] = useState("");
  // The header's search icon reveals the search box; closing it clears the query.
  const [searchOpen, setSearchOpen] = useState(false);
  const query = fileQuery.trim();
  // Word wrap is a preference of the editor, not of one mount: it survives tab switches.
  const [wrap, setWrapState] = useState(wrapPreference);
  const setWrap = (update: (value: boolean) => boolean) => setWrapState((value) => (wrapPreference = update(value)));
  // The caret for the status bar; find/replace/go-to-line live inside the editor (CodeEditor.tsx).
  const [caret, setCaret] = useState({ line: 1, col: 1 });
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadConfirmOpen, setReloadConfirmOpen] = useState(false);
  // The explorer's right-click menu: the entry (null = the empty space, i.e. the root) and where.
  const [menu, setMenu] = useState<{ entry: DirectoryEntry | null; x: number; y: number; stage?: "newFile" | "newFolder" } | null>(null);
  // The keyboard cursor over the explorer's rows (`explorerNav.ts`); `treeRef` is the focusable list.
  const [cursor, setCursor] = useState<string | null>(null);
  const treeRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<CodeEditorHandle | null>(null);
  const restoredPath = normalizeWorkspacePath(initialPath);

  useEffect(() => {
    setExpanded(new Set());
    setSelectedPath(restoredPath || null);
    setPreviewOpen(false);
    setFileQuery("");
    setSearchOpen(false);
    setNotice(null);
    setReloadConfirmOpen(false);
    if (workspaceId && layout !== "editor") requestTree(workspaceId, "");
    if (workspaceId && restoredPath && layout !== "explorer") openFile(workspaceId, restoredPath, true);
  }, [layout, openFile, requestTree, restoredPath, workspaceId]);

  useEffect(() => {
    if (layout === "editor" || !query) return;
    const timer = setTimeout(() => searchFiles(workspaceId, query), 200);
    return () => clearTimeout(timer);
  }, [connected, layout, query, searchFiles, workspaceId]);

  const rootTree = trees[""];
  const project = usePerchStore((state) => state.workspaceProjects.find((candidate) => candidate.id === workspace?.projectId));
  const isGit = Boolean(workspace?.branch || project?.repoPath);
  const gitReady = usePerchStore((state) => gitCapabilityForWorkspace(workspaceId, state));
  const git = useWorkspaceGitReviewStore((state) => layout === "explorer" ? state.workspaces[workspaceId] ?? EMPTY_GIT_REVIEW_STATE : EMPTY_GIT_REVIEW_STATE);
  const decorations = useMemo(() => indexGitDecorations(gitReady && isGit && git.statusState !== "error" ? git.status?.entries ?? [] : []), [git, gitReady, isGit]);
  useEffect(() => {
    if (layout !== "explorer" || !isGit || !gitReady || rootTree?.state !== "ready") return;
    // ponytail: snapshots refresh on mount/reconnect/tree refresh and Git actions, not a new polling service.
    // If live badges are needed, invalidate the shared store from a core-owned Git watcher.
    const store = useWorkspaceGitReviewStore.getState();
    if (store.workspaces[workspaceId]?.statusState !== "loading") store.refreshStatus(workspaceId);
  }, [gitReady, isGit, layout, rootTree, workspaceId]);
  const document = selectedPath ? documents[selectedPath] : undefined;
  const preview = selectedPath ? previews[selectedPath] : undefined;
  const dirty = document != null && document.content !== document.savedContent;
  const canEdit = document != null && !document.metadata?.readonly && document.state !== "loading" && document.state !== "error";
  const canSave = document != null && !document.metadata?.readonly && dirty && document.state !== "saving" && document.state !== "loading" && document.state !== "error";

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
    setCursor(entry.path);
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

  function handleOpenFile(entry: DirectoryEntry, pinned = false) {
    setCursor(entry.path);
    if (entry.kind !== "file") {
      setNotice(entry.kind === "symlink" ? "Symlinks are metadata-only and cannot be opened." : "This entry cannot be opened.");
      return;
    }
    if (layout === "explorer") {
      setNotice(null);
      setSelectedPath(entry.path);
      onOpenFile?.(entry.path, pinned);
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
    if (!existing || existing.state === "error") openFile(workspaceId, entry.path);
  }

  // What the cursor can reach: the search results while searching, else the expanded tree.
  const searchRows = searchResult?.query === query && searchResult.state === "ready" ? searchResult.entries : [];
  const rows = query ? searchRows : flattenTree(trees, expanded);

  // Keep the cursor row on screen.
  useEffect(() => {
    if (!cursor) return;
    [...(treeRef.current?.querySelectorAll<HTMLElement>("[data-path]") ?? [])].find((row) => row.dataset.path === cursor)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  /** Arrows move, Left/Right fold, Space previews (focus stays here), Enter opens a regular tab
   * (focus goes to the editor). Chords with Ctrl/Option/Cmd belong to the app. */
  function handleTreeKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.ctrlKey || event.altKey || event.metaKey || menu) return;
    const result = explorerKey(rows, cursor, event.key, expanded);
    if (!result) return;
    event.preventDefault();
    const byPath = (path: string) => rows.find((row) => row.path === path);
    if (result.cursor) setCursor(result.cursor);
    const folder = result.toggle ? byPath(result.toggle) : undefined;
    if (folder) handleToggle(folder);
    const file = result.open ? byPath(result.open.path) : undefined;
    if (file && result.open) {
      // A preview keeps focus in the list (the editor must not grab it); a regular open hands it over.
      if (treeRef.current) treeRef.current.dataset.keynav = result.open.pin ? "false" : "true";
      handleOpenFile(file, result.open.pin);
    }
  }

  function saveCurrent() {
    if (selectedPath && canSave) saveFile(workspaceId, selectedPath);
  }

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
      className={cn(SECTION, layout === "editor" ? "z-auto bg-panel-bg" : "z-[3]")}
      data-testid={layout === "editor" ? "workspace-file-pane" : "workspace-files-view"}
      aria-label={`Files for ${workspace.name}`}
    >
      {layout === "explorer" && notice && <div className={cn(BANNER, "px-[0.65rem] py-[0.3rem]")} role="status">{notice}</div>}

      <div className="flex min-h-0 min-w-0 flex-1">
        {layout !== "editor" && <aside
          className={cn(
            "flex min-h-0 flex-col overflow-hidden [@container(max-width:460px)]:flex-[1_1_100%] [@container(max-width:460px)]:[border-right:none]",
            "flex-[1_1_100%]",
          )}
          aria-label="Workspace file tree"
        >
          <div className="flex shrink-0 items-center gap-1 px-3 py-[3px]">
            {!searchOpen && <>
              <HeaderIcon label="Search files" onClick={() => setSearchOpen(true)}>
                <circle cx="6.5" cy="6.5" r="4" /><path d="m9.5 9.5 4 4" />
              </HeaderIcon>
              <HeaderIcon label="New file" onClick={() => setMenu({ entry: null, x: 0, y: 0, stage: "newFile" })}>
                <path d="M9 2H4.5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5.5zM9 2v3.5h3.5M8 7.5v4M6 9.5h4" />
              </HeaderIcon>
              <HeaderIcon label="New folder" onClick={() => setMenu({ entry: null, x: 0, y: 0, stage: "newFolder" })}>
                <path d="M2 4.5a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1zM8 7v3.5M6.25 8.75h3.5" />
              </HeaderIcon>
            </>}
            {searchOpen && <input autoFocus type="search" className={cn(ROW_FONT, "min-h-8 min-w-0 flex-1 rounded-ui border border-overlay-0 bg-panel-bg px-2 text-fg placeholder:text-subtext-0 focus-visible:outline focus-visible:outline-1 focus-visible:outline-fg")} aria-label="Search workspace files" placeholder="Search files in workspace…" maxLength={256} value={fileQuery} onChange={(event) => setFileQuery(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Escape") { setFileQuery(""); setSearchOpen(false); }
              // Down from the search box walks its results (or the tree) with the keyboard.
              if (event.key === "ArrowDown" && rows.length > 0) { event.preventDefault(); setCursor(rows[0]!.path); treeRef.current?.focus(); }
            }} data-testid="workspace-files-search" />}
            {searchOpen && <button type="button" className={cn(GHOST_BUTTON, "min-h-8 px-2 text-[0.75rem]")} onClick={() => { setFileQuery(""); setSearchOpen(false); }}>Close</button>}
          </div>
          <div className="flex shrink-0 items-center justify-between py-[3px] pr-3 pl-3 text-[length:calc(11px*var(--zoom,1))] font-semibold tracking-[0.06em] text-subtext-0 uppercase">
            <span>Explorer</span>
            <div className="flex items-center gap-2">
              {isGit && <span className="text-[10px] font-normal tracking-normal normal-case" data-testid="explorer-git-state" title={git.statusError} role="status">{!gitReady || git.statusState === "error" ? "Git unavailable" : git.statusState === "ready" ? "Git snapshot" : "Updating Git…"}</span>}
              <HeaderIcon label="Refresh file tree" onClick={refreshTree}><path d="M13 5a5.5 5.5 0 1 0 0 6M13 2v3H10" /></HeaderIcon>
            </div>
          </div>
          <div
            ref={treeRef}
            role="tree"
            tabIndex={0}
            aria-label="Files"
            data-explorer-keynav="false"
            className="group/tree min-h-0 flex-1 overflow-y-auto px-1 outline-none"
            data-testid="workspace-file-tree-scroll"
            onKeyDown={handleTreeKey}
            onMouseDown={(event) => {
              // WebKit does not focus a clicked button: take focus here so the arrows work after a click.
              if (treeRef.current) treeRef.current.dataset.keynav = "false";
              if (event.target === event.currentTarget || (event.target as Element).closest("[data-path]")) treeRef.current?.focus({ preventScroll: true });
            }}
            onContextMenu={(event) => { event.preventDefault(); if (!query) setMenu({ entry: null, x: event.clientX, y: event.clientY }); }}
          >
          {query ? <div aria-live="polite">
            <SearchResults result={searchResult} query={query} selectedPath={selectedPath} cursor={cursor} decorations={decorations} onOpenFile={handleOpenFile} onMenu={(entry, x, y) => setMenu({ entry, x, y })} onRetry={() => searchFiles(workspaceId, query)} />
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
              cursor={cursor}
              trees={trees}
              decorations={decorations}
              onToggle={handleToggle}
              onOpenFile={handleOpenFile}
              onMenu={(entry, x, y) => setMenu({ entry, x, y })}
            />
          )}
          </>}
          </div>
        </aside>}

        {layout !== "explorer" && <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-panel-bg">
          {(!selectedPath || !document) && (
            <div className={EMPTY}>
              <span className="text-accent">⌘</span>
              <strong className="text-[0.9rem] text-fg">Open a file to edit</strong>
              <span>Folders load one level at a time. Files stay inside this workspace.</span>
            </div>
          )}
          {selectedPath && document && showAsset && (
            <WorkspaceFileAsset key={selectedPath} workspaceId={workspaceId} metadata={document.metadata!} />
          )}
          {selectedPath && document && !showAsset && (
            <>
              <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-[0.2rem] text-[0.72rem] [@container(max-width:460px)]:flex-wrap">
                <div className="workspace-files__file-title flex min-w-0 items-center gap-[0.4rem] text-subtext-0 [@container(max-width:460px)]:flex-[1_1_9rem]" title={`${selectedPath}\n${metadataSummary(document.metadata)}${document.version ? ` · v ${document.version.slice(0, 12)}` : ""}`}>
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">{selectedPath}</span>
                  {dirty && <span className="text-[0.65rem] text-fg" title="Unsaved changes">●</span>}
                </div>
                <div className={cn(ACTIONS, "gap-[0.1rem] [@container(max-width:460px)]:max-w-full [@container(max-width:460px)]:min-w-0 [@container(max-width:460px)]:flex-[1_1_100%] [@container(max-width:460px)]:flex-wrap")}>
                  {contextBridgeAvailable(workspaceId) && <button type="button" className={cn(GHOST_BUTTON, "min-h-7 px-2 max-[700px]:min-h-11")} disabled={document.state !== "ready" && document.state !== "conflict"} onClick={() => editorRef.current?.askAgent()}>Ask agent…</button>}
                  <button type="button" className={cn(GHOST_BUTTON, "px-[0.4rem] py-[0.15rem] [@container(max-width:460px)]:min-h-[2.5rem]", wrap && "text-fg")} onClick={() => setWrap((value) => !value)} title="Toggle word wrap">Wrap</button>
                  <button type="button" className={cn(GHOST_BUTTON, "px-[0.4rem] py-[0.15rem] [@container(max-width:460px)]:min-h-[2.5rem]", previewOpen && "text-fg")} onClick={() => { setPreviewOpen((value) => !value); if (!preview || preview.state === "error") requestPreview(workspaceId, selectedPath); }}>Preview</button>
                  <button type="button" className={cn(GHOST_BUTTON, "px-[0.4rem] py-[0.15rem] [@container(max-width:460px)]:min-h-[2.5rem]")} onClick={handleReload} disabled={document.state === "saving" || document.bufferState === "saving"} title="Reload from disk">Reload</button>
                  <button type="button" className={cn(GHOST_BUTTON, "workspace-files__save px-[0.4rem] py-[0.15rem] [@container(max-width:460px)]:min-h-[2.5rem]", canSave && "text-fg")} onClick={() => saveFile(workspaceId, selectedPath)} disabled={!canSave} title={`Save (${IS_MAC ? "⌘S" : "Ctrl+S"})`}>
                    {document.state === "saving" ? "Saving…" : "Save"}
                  </button>
                </div>
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
              <div className="relative flex min-h-[12rem] min-w-0 flex-1 flex-col overflow-hidden">
                <Suspense fallback={<div className={PREVIEW_STATE} role="status">Loading editor…</div>}>
                  <CodeEditor
                    key={`${selectedPath}\0${document.reloadEpoch ?? 0}`}
                    path={selectedPath}
                    docKey={`${workspaceId}\0${selectedPath}\0${document.reloadEpoch ?? 0}`}
                    ref={editorRef}
                    value={document.content}
                    onChange={(content) => updateDraft(workspaceId, selectedPath, content)}
                    onSave={saveCurrent}
                    onCaret={setCaret}
                    onAskAgent={contextBridgeAvailable(workspaceId) ? (text, startLine, endLine) => askAgent(workspaceId, { kind: "editor", path: selectedPath, text, startLine, endLine, dirty: useWorkspaceFilesStore.getState().documents[workspaceId]?.[selectedPath]?.content !== useWorkspaceFilesStore.getState().documents[workspaceId]?.[selectedPath]?.savedContent }) : undefined}
                    readOnly={!canEdit}
                    wrap={wrap}
                    label={`${document.metadata?.readonly ? "Viewing" : "Editing"} ${selectedPath}`}
                  />
                </Suspense>
              </div>
              {previewOpen && <PreviewPanel preview={preview ?? { workspaceId, path: selectedPath, requiresSandbox: false, truncated: false, state: "loading" }} />}
              <div className="flex shrink-0 items-center justify-between gap-3 px-3 py-[0.15rem] text-[0.68rem] whitespace-nowrap text-subtext-0">
                <span className="flex min-w-0 gap-[0.65rem] overflow-hidden">
                  {document.bufferState === "saving" && <span role="status">Draft syncing…</span>}
                  {document.bufferState === "error" && <span className="text-red" role="alert">Draft recovery unavailable</span>}
                  {document.error && document.state !== "conflict" && <span className="overflow-hidden text-ellipsis text-red" role="alert">{document.error}</span>}
                  {document.metadata?.readonly && <span>Read-only</span>}
                </span>
                <button type="button" className={cn(GHOST_BUTTON, "shrink-0 px-[0.3rem]")} onClick={() => editorRef.current?.openGoto()} title="Go to line (Ctrl+G)">Ln {caret.line}, Col {caret.col}</button>
              </div>
            </>
          )}
        </div>}
      </div>
      {menu && (
        <FileEntryMenu
          workspaceId={workspaceId}
          workspacePath={workspace.path}
          target={menu.entry}
          x={menu.x}
          y={menu.y}
          initialStage={menu.stage}
          onClose={() => setMenu(null)}
          onOpenFile={(path) => handleOpenFile({ name: basename(path), path, kind: "file" } as DirectoryEntry, true)}
          onExpand={(path) => {
            setExpanded((current) => new Set(current).add(path));
            if (!trees[path]) requestTree(workspaceId, path);
          }}
          onRefresh={refreshTree}
        />
      )}
    </section>
  );
}
