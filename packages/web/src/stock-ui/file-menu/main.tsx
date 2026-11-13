//! File menu, the stock screen `stock:file-menu`: the explorer's right-click menu (VS Code / Finder style: Open, Open
//! in Default App, Ask agent, New File, New Folder, Reveal in Finder, Cut / Copy / Paste / Duplicate, Rename, Delete,
//! Copy Path, Copy Relative Path, Refresh) and the prompt its action needs (a name, the delete question, an error).
//! It is also the new-file prompt (`initialStage: "newFile"`) of the tab strip, the launcher and a package's
//! `NewFilePrompt`/`FileEntryMenu` from `@perch/sdk`; or the person's package chosen for it
//! (`perch mod use stock:file-menu <id>`) with the same props.
//!
//! `target` is the entry clicked, or null for the workspace root. Changes go through Perch (`actions.mutate`:
//! `fs.mutate`, which never overwrites anything); the clipboard of cut/copied entries, the native app's
//! open/reveal and Ask agent are Perch's too. Names, wording and which rows show are this screen's. The prompts are
//! `Dialog` and `ConfirmDialog` from `@perch/sdk`, so copies chosen for those draw them here.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:file-menu` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside
//! it (docs/MOD-SDK.md).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buttonClass as button, ConfirmDialog, Dialog, menuDividerClass as menuDivider, menuItemClass as menuItem, menuPanel, type FileMenuScreenProps } from "@perch/sdk";

const parentPath = (path: string): string => path.split("/").slice(0, -1).join("/");
const joinPath = (dir: string, name: string): string => (dir ? `${dir}/${name}` : name);

/** `/a/b/../c/` -> `/a/c`; "" (a path like `/name`) is the root. Relative paths stay as typed for the core to refuse. */
function normalizeDir(dir: string): string {
  const parts: string[] = [];
  for (const part of dir.split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return `/${parts.join("/")}`;
}

type Stage = "menu" | "newFile" | "newFolder" | "rename" | "delete" | "error";

const MENU_W = 210;
const basename = (path: string) => path.split("/").pop() ?? path;

export default function FileMenu({ workspacePath, target, x, y, onClose, onOpenFile, onExpand, onRefresh, initialStage, held, nativeAvailable, canAsk, actions }: FileMenuScreenProps) {
  const [stage, setStage] = useState<Stage>(initialStage ?? "menu");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const maxTop = window.innerHeight - menu.getBoundingClientRect().height - 8;
    menu.style.top = `${Math.max(8, Math.min(y, maxTop))}px`;
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
  const canPaste = held != null;
  const hold = (cut: boolean) => {
    if (target) actions.hold(target.path, cut);
    onClose();
  };
  const paste = () => {
    if (!held || !canPaste) return;
    const name = basename(held.path);
    if (held.cut) {
      // Moving into the folder it is already in changes nothing.
      if (parentPath(held.path) === createDir) return onClose();
      void run(() => actions.mutate("rename", held.path, joinPath(createDir, name)).then(() => { if (createDir) onExpand(createDir); }));
    } else {
      const to = joinPath(createDir, actions.freeName(name, createDir));
      void run(() => actions.mutate("copy", held.path, to).then(() => { if (createDir) onExpand(createDir); }));
    }
  };
  const duplicate = () => {
    if (!target) return;
    const dir = parentPath(target.path);
    void run(() => actions.mutate("copy", target.path, joinPath(dir, actions.freeName(target.name, dir))));
  };
  const openInDefaultApp = () => {
    if (!nativeAvailable || !target || busy) return;
    void run(async () => {
      await actions.openInDefaultApp(absolute(target.path));
    });
  };
  const reveal = () => {
    actions.reveal(absolute(target?.path ?? ""));
    onClose();
  };
  if (stage === "newFile") {
    const base = absolute(createDir).replace(/\/+$/, "");
    return (
      <NameDialog
        title="New file"
        initial={`${base}/`}
        label="File path"
        path
        confirmLabel="Create"
        busy={busy}
        error={error}
        onCancel={onClose}
        onSubmit={(value) => run(() => {
          // A bare name goes in the default folder; anything with a / is a full path.
          const at = value.lastIndexOf("/");
          return actions.createFileAt(at < 0 ? base : normalizeDir(value.slice(0, at)), value.slice(at + 1));
        })}
      />
    );
  }

  if (stage === "newFolder" || stage === "rename") {
    const renaming = stage === "rename" && target;
    return (
      <NameDialog
        title={renaming ? `Rename ${target.name}` : "New folder"}
        initial={renaming ? target.name : ""}
        confirmLabel={renaming ? "Rename" : "Create"}
        busy={busy}
        error={error}
        onCancel={onClose}
        onSubmit={(name) => run(async () => {
          if (renaming) {
            const to = joinPath(parentPath(target.path), name);
            if (to !== target.path) await actions.mutate("rename", target.path, to);
            return;
          }
          await actions.mutate("createDir", joinPath(createDir, name));
          if (createDir) onExpand(createDir);
        })}
      />
    );
  }

  if (stage === "error") {
    return (
      <Dialog title="That did not work" onClose={onClose} testId="file-error-dialog">
        <p role="alert" className="m-0 text-[0.82rem] text-red">{error}</p>
        <div className="flex justify-end">
          <button type="button" className={button({ variant: "primary" })} onClick={onClose}>OK</button>
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
          if (!busy) void run(() => actions.mutate("delete", target.path));
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
      {target && !isDirectory && canAsk && item("Ask agent about file…", () => { actions.askAgent(target.path); onClose(); }, "file-menu-ask-agent")}
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

function NameDialog({ title, initial, label = "Name", path = false, confirmLabel, busy, error, onCancel, onSubmit }: {
  title: string;
  initial: string;
  /** The input's label. */
  label?: string;
  /** The value is a full path (VS Code's new file): a `/` is fine, but the last part must be a name. */
  path?: boolean;
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
    // Like Finder/VS Code: select the stem, not the extension; a full path starts with the caret at its end.
    const dot = initial.lastIndexOf(".");
    if (path) input.setSelectionRange(initial.length, initial.length);
    else input.setSelectionRange(0, dot > 0 ? dot : initial.length);
  }, [initial, path]);
  const trimmed = name.trim();
  const leaf = path ? trimmed.slice(trimmed.lastIndexOf("/") + 1) : trimmed;
  const invalid = !leaf || leaf === "." || leaf === ".." || (!path && /[\\/]/.test(trimmed)) || (path && trimmed.includes("/") && !trimmed.startsWith("/"));
  const submit = () => { if (!invalid && !busy) onSubmit(trimmed); };
  return (
    <Dialog title={title} onClose={onCancel} testId="file-name-dialog">
      <input
        ref={inputRef}
        className="min-h-8 w-full rounded-ui bg-surface-0 px-2 text-[0.85rem] text-fg [font-family:inherit] focus-visible:outline focus-visible:outline-1 focus-visible:outline-fg"
        aria-label={label}
        data-testid="file-name-input"
        value={name}
        spellCheck={false}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submit(); } }}
      />
      {!path && trimmed && /[\\/]/.test(trimmed) && <p className="m-0 text-[0.75rem] text-red">A name cannot contain / or \.</p>}
      {path && trimmed.includes("/") && !trimmed.startsWith("/") && <p className="m-0 text-[0.75rem] text-red">Enter an absolute path, starting with /.</p>}
      {error && <p role="alert" className="m-0 text-[0.78rem] text-red">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className={button()} onClick={onCancel}>Cancel</button>
        <button type="button" className={button({ variant: "primary" })} disabled={invalid || busy} data-testid="file-name-confirm" onClick={submit}>{confirmLabel}</button>
      </div>
    </Dialog>
  );
}
