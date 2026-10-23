/**
 * FileEntryMenu.tsx — right-click menu of the file explorer (right drawer), VS
 * Code / Finder style: Open in Default App, Reveal in Finder (local desktop), New File, New Folder,
 * Cut / Copy / Paste / Duplicate, Rename, Delete, Copy Path, Copy Relative
 * Path, Refresh. `target` is the entry clicked, or null for the
 * explorer's empty space (the workspace root). The menu, then the dialog its
 * action needs (name prompt / delete confirm), are one component so the
 * explorer only tracks "which entry, where". Mutations go through
 * `fileOps.ts` (`fs.mutate`); nothing is ever overwritten.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DirectoryEntry } from "@perch/shared";
import { askAgentAboutFile, contextBridgeAvailable } from "../contextBridge";
import { freeName, joinPath, mutateEntry, namesIn, parentPath, useEntryClipboard } from "../fileOps";
import { tauriInvoke } from "../links";
import { usePerchStore } from "../store";
import { menuDivider, menuItem, menuPanel } from "./ui/menu";
import { Dialog } from "./ui/dialog";
import { ConfirmDialog } from "./ConfirmDialog";

export interface FileEntryMenuProps {
  workspaceId: string;
  /** Absolute workspace root, for Copy Path. */
  workspacePath: string;
  target: DirectoryEntry | null;
  x: number;
  y: number;
  onClose: () => void;
  onOpenFile: (path: string) => void;
  /** Show this folder's children (a create just put something there). */
  onExpand: (path: string) => void;
  onRefresh: () => void;
  /** Skip the menu and open this name prompt (the explorer header's new file / new folder icons). */
  initialStage?: "newFile" | "newFolder";
}

type Stage = "menu" | "newFile" | "newFolder" | "rename" | "delete" | "error";

const MENU_W = 210;
const basename = (path: string) => path.split("/").pop() ?? path;

export function FileEntryMenu({ workspaceId, workspacePath, target, x, y, onClose, onOpenFile, onExpand, onRefresh, initialStage }: FileEntryMenuProps) {
  const [stage, setStage] = useState<Stage>(initialStage ?? "menu");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const held = useEntryClipboard((state) => state.entry);
  const localWorkspace = usePerchStore((state) => state.workspaces.some((workspace) => workspace.id === workspaceId && workspace.hostId === "local"));
  const nativeAvailable = !!tauriInvoke && localWorkspace;

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (menu) menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - menu.getBoundingClientRect().height - 8))}px`;
  }, [stage, x, y, nativeAvailable, target]);

  useEffect(() => {
    if (stage !== "menu") return;
    const outside = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) onClose(); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("blur", onClose);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", key);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("resize", onClose);
    };
  }, [stage, onClose]);

  const isDirectory = target?.kind === "directory";
  // New items land in the clicked folder, beside a clicked file, or at the root.
  const createDir = !target ? "" : isDirectory ? target.path : parentPath(target.path);
  const copy = (text: string) => { void navigator.clipboard?.writeText(text).catch(() => undefined); onClose(); };

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setBusy(false);
      // The name prompt and the delete confirm show their own error; a direct action has no dialog yet.
      if (stage === "menu") setStage("error");
    }
  }

  const absolute = (path: string) => (path ? joinPath(workspacePath.replace(/\/+$/, ""), path) : workspacePath);
  const canPaste = held != null && held.workspaceId === workspaceId;
  const hold = (cut: boolean) => {
    if (target) useEntryClipboard.setState({ entry: { workspaceId, path: target.path, cut } });
    onClose();
  };
  const paste = () => {
    if (!held || !canPaste) return;
    const name = basename(held.path);
    if (held.cut) {
      // Moving into the folder it is already in changes nothing.
      if (parentPath(held.path) === createDir) return onClose();
      void run(() => mutateEntry(workspaceId, "rename", held.path, joinPath(createDir, name)).then(() => { if (createDir) onExpand(createDir); }));
    } else {
      const to = joinPath(createDir, freeName(name, namesIn(workspaceId, createDir)));
      void run(() => mutateEntry(workspaceId, "copy", held.path, to).then(() => { if (createDir) onExpand(createDir); }));
    }
  };
  const duplicate = () => {
    if (!target) return;
    const dir = parentPath(target.path);
    void run(() => mutateEntry(workspaceId, "copy", target.path, joinPath(dir, freeName(target.name, namesIn(workspaceId, dir)))));
  };
  const openInDefaultApp = () => {
    if (!nativeAvailable || !target || busy) return;
    void run(async () => {
      await tauriInvoke!("open_in_default_app", { path: absolute(target.path) });
    });
  };
  const reveal = () => {
    void tauriInvoke?.("reveal_in_finder", { path: absolute(target?.path ?? "") }).catch(() => undefined);
    onClose();
  };
  if (stage === "newFile" || stage === "newFolder" || stage === "rename") {
    const renaming = stage === "rename" && target;
    return (
      <NameDialog
        title={renaming ? `Rename ${target.name}` : stage === "newFile" ? "New file" : "New folder"}
        initial={renaming ? target.name : ""}
        confirmLabel={renaming ? "Rename" : "Create"}
        busy={busy}
        error={error}
        onCancel={onClose}
        onSubmit={(name) => run(async () => {
          if (renaming) {
            const to = joinPath(parentPath(target.path), name);
            if (to !== target.path) await mutateEntry(workspaceId, "rename", target.path, to);
            return;
          }
          const path = joinPath(createDir, name);
          await mutateEntry(workspaceId, stage === "newFile" ? "createFile" : "createDir", path);
          if (createDir) onExpand(createDir);
          if (stage === "newFile") onOpenFile(path);
        })}
      />
    );
  }

  if (stage === "error") {
    return (
      <Dialog title="That did not work" onClose={onClose} testId="file-error-dialog">
        <p role="alert" className="m-0 text-[0.82rem] text-red">{error}</p>
        <div className="flex justify-end">
          <button type="button" className="cursor-pointer rounded-ui border border-overlay-0 bg-transparent px-[0.85rem] py-[0.35rem] text-[0.82rem] text-fg [font-family:inherit] hover:border-accent" onClick={onClose}>OK</button>
        </div>
      </Dialog>
    );
  }

  if (stage === "delete" && target) {
    return (
      <ConfirmDialog
        message={`Delete ${target.name}${isDirectory ? " and everything in it" : ""}?\nThis cannot be undone.`}
        onCancel={onClose}
        onConfirm={() => {
          if (!busy) void run(() => mutateEntry(workspaceId, "delete", target.path));
        }}
      >
        {error && <p role="alert" className="m-0 mb-3 text-[0.78rem] text-red">{error}</p>}
      </ConfirmDialog>
    );
  }

  const left = Math.max(8, Math.min(x, window.innerWidth - MENU_W - 8));
  const top = Math.max(8, y);
  const item = (label: string, onSelect: () => void, testId: string, danger = false) => (
    <button type="button" className={menuItem({ danger })} data-testid={testId} disabled={busy} onClick={onSelect}>{label}</button>
  );
  return createPortal(
    <div
      ref={menuRef}
      className={menuPanel}
      data-testid="file-entry-menu"
      style={{ position: "fixed", top, left, zIndex: 9999, minWidth: MENU_W, maxHeight: "calc(100vh - 16px)", overflowY: "auto" }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {target && !isDirectory && item("Open", () => { onOpenFile(target.path); onClose(); }, "file-menu-open")}
      {target && nativeAvailable && item("Open in Default App", openInDefaultApp, "file-menu-open-default")}
      {target && !isDirectory && contextBridgeAvailable(workspaceId) && item("Ask agent about file…", () => { askAgentAboutFile(workspaceId, target.path); onClose(); }, "file-menu-ask-agent")}
      {target && !isDirectory && <div className={menuDivider} />}
      {item("New File…", () => setStage("newFile"), "file-menu-new-file")}
      {item("New Folder…", () => setStage("newFolder"), "file-menu-new-folder")}
      {nativeAvailable && item("Reveal in Finder", reveal, "file-menu-reveal")}
      <div className={menuDivider} />
      {target && item("Cut", () => hold(true), "file-menu-cut")}
      {target && item("Copy", () => hold(false), "file-menu-copy")}
      <button type="button" className={menuItem()} data-testid="file-menu-paste" disabled={!canPaste || busy} onClick={paste}>Paste</button>
      {target && item("Duplicate", duplicate, "file-menu-duplicate")}
      {target && <div className={menuDivider} />}
      {target && item("Rename…", () => setStage("rename"), "file-menu-rename")}
      {target && item("Delete", () => setStage("delete"), "file-menu-delete", true)}
      {target && <div className={menuDivider} />}
      {target && item("Copy Path", () => copy(absolute(target.path)), "file-menu-copy-path")}
      {target && item("Copy Relative Path", () => copy(target.path), "file-menu-copy-relative")}
      <div className={menuDivider} />
      {item("Refresh", () => { onRefresh(); onClose(); }, "file-menu-refresh")}
    </div>,
    document.body,
  );
}

function NameDialog({ title, initial, confirmLabel, busy, error, onCancel, onSubmit }: {
  title: string;
  initial: string;
  confirmLabel: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    // Like Finder/VS Code: select the stem, not the extension.
    const dot = initial.lastIndexOf(".");
    input.setSelectionRange(0, dot > 0 ? dot : initial.length);
  }, [initial]);
  const trimmed = name.trim();
  const invalid = !trimmed || trimmed === "." || trimmed === ".." || /[\\/]/.test(trimmed);
  const submit = () => { if (!invalid && !busy) onSubmit(trimmed); };
  return (
    <Dialog title={title} onClose={onCancel} testId="file-name-dialog">
      <input
        ref={inputRef}
        className="min-h-8 w-full rounded-ui border border-overlay-0 bg-surface-0 px-2 text-[0.85rem] text-fg [font-family:inherit] focus-visible:outline focus-visible:outline-1 focus-visible:outline-fg"
        aria-label="Name"
        data-testid="file-name-input"
        value={name}
        spellCheck={false}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submit(); } }}
      />
      {trimmed && /[\\/]/.test(trimmed) && <p className="m-0 text-[0.75rem] text-red">A name cannot contain / or \.</p>}
      {error && <p role="alert" className="m-0 text-[0.78rem] text-red">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="cursor-pointer rounded-ui border border-overlay-0 bg-transparent px-[0.85rem] py-[0.35rem] text-[0.82rem] text-fg [font-family:inherit] hover:border-accent" onClick={onCancel}>Cancel</button>
        <button type="button" className="cursor-pointer rounded-ui border border-accent bg-accent px-[0.85rem] py-[0.35rem] text-[0.82rem] text-panel-bg [font-family:inherit] disabled:cursor-not-allowed disabled:opacity-40" disabled={invalid || busy} data-testid="file-name-confirm" onClick={submit}>{confirmLabel}</button>
      </div>
    </Dialog>
  );
}
