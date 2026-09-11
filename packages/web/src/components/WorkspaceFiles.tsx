import { useEffect, useMemo, useRef, useState } from "react";
import type { DirectoryEntry, FileMetadata } from "@perch/shared";
import { usePerchStore, type WorkspaceRecord } from "../store";
import {
  normalizeWorkspacePath,
  useWorkspaceFilesStore,
  type WorkspaceDocumentState,
  type WorkspacePreviewState,
  type WorkspaceTreeState,
} from "../filesystemStore";

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

function entryGlyph(entry: DirectoryEntry): string {
  if (entry.kind === "directory") return "▸";
  if (entry.kind === "symlink") return "↗";
  if (entry.kind === "file") return "·";
  return "?";
}

function isEditableFile(entry: DirectoryEntry): boolean {
  return entry.kind === "file" && !entry.readonly;
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
    <div className="workspace-files__tree-level" data-testid={`workspace-file-tree-${path || "root"}`}>
      {tree.entries.map((entry) => {
        const isDirectory = entry.kind === "directory";
        const isOpen = expanded.has(entry.path);
        const childTree = trees[entry.path];
        const selected = selectedPath === entry.path;
        return (
          <div key={entry.path} className="workspace-files__tree-node">
            <button
              type="button"
              className={"workspace-files__tree-entry" + (selected ? " workspace-files__tree-entry--selected" : "")}
              style={{ paddingLeft: `${0.35 + level * 0.85}rem` }}
              data-testid={`workspace-file-entry-${entry.path}`}
              title={entry.path}
              onClick={() => (isDirectory ? onToggle(entry) : onOpenFile(entry))}
            >
              <span className={"workspace-files__tree-chevron" + (isOpen ? " workspace-files__tree-chevron--open" : "")} aria-hidden="true">
                {isDirectory ? (isOpen ? "▾" : "▸") : ""}
              </span>
              <span className={`workspace-files__tree-glyph workspace-files__tree-glyph--${entry.kind}`} aria-hidden="true">
                {entryGlyph(entry)}
              </span>
              <span className="workspace-files__tree-name">{entry.name}</span>
              {entry.readonly && <span className="workspace-files__tree-badge">RO</span>}
            </button>
            {isDirectory && isOpen && childTree?.state === "loading" && (
              <div className="workspace-files__tree-state" style={{ paddingLeft: `${1.7 + (level + 1) * 0.85}rem` }}>Loading…</div>
            )}
            {isDirectory && isOpen && childTree?.state === "error" && (
              <div className="workspace-files__tree-state workspace-files__tree-state--error" style={{ paddingLeft: `${1.7 + (level + 1) * 0.85}rem` }}>
                {childTree.error || "Could not load folder."}
                <button type="button" onClick={() => onToggle(entry)}>Retry</button>
              </div>
            )}
            {isDirectory && isOpen && childTree?.state === "ready" && (
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
        );
      })}
      {tree.truncated && <div className="workspace-files__tree-state">Large folder · narrow the view to load more</div>}
      {tree.state === "ready" && tree.entries.length === 0 && <div className="workspace-files__tree-state">Empty folder</div>}
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
  if (preview.state === "loading") return <div className="workspace-files__preview-state">Loading preview…</div>;
  if (preview.state === "error") return <div className="workspace-files__preview-state workspace-files__preview-state--error" role="alert">{preview.error || "Preview unavailable."}</div>;
  if (preview.state !== "ready") return null;
  if (preview.kind === "html" && preview.content) {
    return (
      <div className="workspace-files__preview-frame-wrap">
        <div className="workspace-files__preview-note">HTML is isolated in a sandboxed preview.</div>
        <iframe className="workspace-files__preview-frame" sandbox="" title="Sandboxed file preview" srcDoc={preview.content} />
      </div>
    );
  }
  if (preview.kind === "image" || preview.kind === "binary" || preview.kind === "tooLarge") {
    return <div className="workspace-files__preview-state">{preview.message || "This file is not rendered in the editor."}</div>;
  }
  return (
    <pre className="workspace-files__preview-content" data-testid="workspace-file-preview-content">
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
    <div className="workspace-files__conflict" role="alert" data-testid="workspace-file-conflict">
      <strong>File changed on disk.</strong>
      <span>Your draft is preserved. Choose how to reconcile it.</span>
      <div className="workspace-files__conflict-meta">
        {conflict?.expectedVersion && <code>opened {conflict.expectedVersion.slice(0, 10)}</code>}
        {conflict?.actualVersion && <code>disk {conflict.actualVersion.slice(0, 10)}</code>}
      </div>
      <div className="workspace-files__conflict-actions">
        <button type="button" onClick={() => { onCompare(); setCompareOpen(true); }}>Compare</button>
        <button type="button" onClick={onReload}>Reload disk</button>
        <button type="button" className="workspace-files__danger-button" onClick={onOverwrite}>Overwrite disk</button>
      </div>
      {compareOpen && preview?.state === "ready" && preview.content && (
        <div className="workspace-files__compare" data-testid="workspace-file-compare">
          <div><span>Draft</span><pre>{document.content}</pre></div>
          <div><span>Disk preview</span><pre>{preview.content}</pre></div>
        </div>
      )}
      {compareOpen && (!preview || preview.state === "loading") && <div className="workspace-files__tree-state">Loading the current disk content…</div>}
    </div>
  );
}

export interface WorkspaceFilesViewProps {
  workspaceId: string;
  /** Path carried by Dockview's persisted panel params. Keeping this outside
   * React-only state lets a saved mixed layout reopen the same file tab. */
  initialPath?: string;
  onPathChange?: (path: string) => void;
  onClose?: () => void;
}

/** Bounded workspace file surface. Directory levels are fetched on demand;
 * files are read only after an explicit click. Drafts stay in the scoped
 * client buffer until the server-side buffer persistence adapter lands. */
export function WorkspaceFilesView({ workspaceId, initialPath, onPathChange, onClose }: WorkspaceFilesViewProps) {
  const workspace = usePerchStore((state) => state.workspaces.find((candidate) => candidate.id === workspaceId));
  const trees = useWorkspaceFilesStore((state) => state.trees[workspaceId] ?? EMPTY_TREES);
  const documents = useWorkspaceFilesStore((state) => state.documents[workspaceId] ?? EMPTY_DOCUMENTS);
  const previews = useWorkspaceFilesStore((state) => state.previews[workspaceId] ?? EMPTY_PREVIEWS);
  const requestTree = useWorkspaceFilesStore((state) => state.requestTree);
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
    setNotice(null);
    setReloadConfirmOpen(false);
    setMobileExplorerOpen(!restoredPath);
    if (workspaceId) requestTree(workspaceId, "");
    if (workspaceId && restoredPath) openFile(workspaceId, restoredPath, true);
  }, [openFile, requestTree, restoredPath, workspaceId]);

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
    if (!isEditableFile(entry)) {
      setNotice(entry.kind === "symlink" ? "Symlinks are metadata-only and cannot be opened." : "This entry is not editable.");
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

  if (!workspace) {
    return (
      <section className="workspace-files" data-testid="workspace-files-view">
        <div className="workspace-files__empty">Workspace is no longer available.</div>
      </section>
    );
  }

  return (
    <section className="workspace-files" data-testid="workspace-files-view" aria-label={`Files for ${workspace.name}`}>
      <header className="workspace-files__header">
        <div className="workspace-files__title-block">
          <span className="workspace-files__eyebrow">Files</span>
          <strong title={workspace.path}>{workspace.name || basename(workspace.path)}</strong>
          <span title={workspace.path}>{workspace.path}</span>
        </div>
        <div className="workspace-files__header-actions">
          <button type="button" className="workspace-files__close" onClick={onClose} aria-label="Close files">×</button>
        </div>
      </header>

      <div className={"workspace-files__body" + (mobileExplorerOpen ? " workspace-files__body--explorer-open" : "")}>
        <aside className="workspace-files__explorer" aria-label="Workspace file tree">
          <div className="workspace-files__explorer-heading">
            <span>Explorer</span>
            <div className="workspace-files__explorer-actions">
              <button
                type="button"
                className="workspace-files__mobile-editor"
                onClick={() => setMobileExplorerOpen(false)}
                disabled={!selectedPath}
              >
                Editor
              </button>
              <button type="button" onClick={() => requestTree(workspaceId, "")} aria-label="Refresh file tree" title="Refresh file tree">↻</button>
            </div>
          </div>
          {rootTree?.state === "loading" && <div className="workspace-files__tree-state" role="status">Loading tree…</div>}
          {rootTree?.state === "error" && (
            <div className="workspace-files__tree-state workspace-files__tree-state--error" role="alert">
              {rootTree.error || "Could not load file tree."}
              <button type="button" onClick={() => requestTree(workspaceId, "")}>Retry</button>
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
        </aside>

        <div className="workspace-files__editor-column">
          <button
            type="button"
            className="workspace-files__mobile-explorer"
            onClick={() => setMobileExplorerOpen(true)}
          >
            ‹ Explorer
          </button>
          {!selectedPath || !document ? (
            <div className="workspace-files__empty workspace-files__empty--editor">
              <span className="workspace-files__empty-mark">⌘</span>
              <strong>Open a file to edit</strong>
              <span>Folders load one level at a time. Files stay inside this workspace.</span>
            </div>
          ) : (
            <>
              <div className="workspace-files__editor-header">
                <div className="workspace-files__file-title">
                  <strong title={selectedPath}>{basename(selectedPath)}</strong>
                  <span title={selectedPath}>{selectedPath}</span>
                  {dirty && <span className="workspace-files__dirty" title="Unsaved changes">●</span>}
                </div>
                <div className="workspace-files__editor-actions">
                  <button type="button" className={wrap ? "workspace-files__tool workspace-files__tool--active" : "workspace-files__tool"} onClick={() => setWrap((value) => !value)}>Wrap</button>
                  <button type="button" className={previewOpen ? "workspace-files__tool workspace-files__tool--active" : "workspace-files__tool"} onClick={() => { setPreviewOpen((value) => !value); if (!preview || preview.state === "error") requestPreview(workspaceId, selectedPath); }}>Preview</button>
                  <button type="button" className="workspace-files__tool" onClick={handleReload} disabled={document.state === "saving" || document.bufferState === "saving"}>Reload</button>
                  <button type="button" className="workspace-files__save" onClick={() => saveFile(workspaceId, selectedPath)} disabled={!dirty || document.state === "saving" || document.state === "loading"}>
                    {document.state === "saving" ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
              <div className="workspace-files__meta-line">
                <span>{metadataSummary(document.metadata)}</span>
                {document.version && <code>v {document.version.slice(0, 12)}</code>}
                {search && <span>{matches} match{matches === 1 ? "" : "es"}</span>}
                {document.bufferState === "saving" && <span role="status">Draft syncing…</span>}
                {document.bufferState === "error" && <span className="workspace-files__error" role="alert">Draft recovery unavailable</span>}
                {document.error && document.state !== "conflict" && <span className="workspace-files__error" role="alert">{document.error}</span>}
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
              {notice && <div className="workspace-files__notice" role="status">{notice}</div>}
              {reloadConfirmOpen && (
                <div className="workspace-files__reload-confirm" role="status" data-testid="workspace-file-reload-confirm">
                  <span>Discard this unsaved draft and reload from disk?</span>
                  <div className="workspace-files__conflict-actions">
                    <button type="button" onClick={() => setReloadConfirmOpen(false)}>Keep draft</button>
                    <button type="button" className="workspace-files__danger-button" onClick={confirmReload}>Discard and reload</button>
                  </div>
                </div>
              )}
              <label className="workspace-files__search">
                <span>Find</span>
                <input data-testid="workspace-file-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search in file" />
                {search && <span>{matches}</span>}
              </label>
              <div className={"workspace-files__editor" + (wrap ? " workspace-files__editor--wrap" : "")}>
                <div className="workspace-files__gutter" ref={gutterRef} aria-hidden="true">
                  {gutterLines.map((line, index) => <span key={index}>{line ?? ""}</span>)}
                </div>
                <textarea
                  data-testid="workspace-file-editor"
                  ref={editorRef}
                  value={document.content}
                  onChange={(event) => updateDraft(workspaceId, selectedPath, event.target.value)}
                  onScroll={(event) => { if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop; }}
                  wrap={wrap ? "soft" : "off"}
                  spellCheck={false}
                  aria-label={`Editing ${selectedPath}`}
                />
              </div>
              {previewOpen && <PreviewPanel preview={preview ?? { workspaceId, path: selectedPath, requiresSandbox: false, truncated: false, state: "loading" }} />}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
