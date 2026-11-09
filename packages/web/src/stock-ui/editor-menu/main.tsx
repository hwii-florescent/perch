//! Editor menu, the stock screen `stock:editor-menu`: the file editor's right-click menu (Ask agent, Undo / Redo,
//! Cut / Copy / Paste, Select All, Find, Replace, Go to Line). Perch opens it at the pointer, or the person's package
//! chosen for it (`perch mod use stock:editor-menu <id>`) with the same props.
//!
//! Every action is Perch's: it runs on the editor (a CodeMirror transaction, so the draft follows through the editor's
//! own update listener), closes the menu and gives the editor its focus back. This screen draws the rows, says which
//! are possible, and closes on an outside press, Escape, a window blur or resize.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:editor-menu` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside
//! it (docs/MOD-SDK.md).
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn, isMac, keyLabel, menuDividerClass, menuItemClass, menuPanel, type EditorMenuProps } from "@perch/sdk";

const MENU_W = 230;
const MENU_H = 370;

export default function EditorMenu({ x, y, readOnly, canUndo, canRedo, hasSelection, onClose, actions }: EditorMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outside = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) onClose(); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
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
  }, [onClose]);

  /** The key the editor answers to, as this platform writes it. */
  const hint = (mac: string, other: string) => keyLabel(isMac ? mac : other);
  const item = (label: string, onSelect: () => void, testId: string, keys: string, disabled = false) => (
    <button type="button" className={cn(menuItemClass(), "flex items-center justify-between gap-6")} data-testid={testId} disabled={disabled} onClick={onSelect}>
      <span>{label}</span>
      <span className="text-[0.72rem] text-subtext-0">{keys}</span>
    </button>
  );
  const askAgent = actions.askAgent;

  return createPortal(
    <div
      ref={menuRef}
      className={menuPanel}
      data-testid="editor-context-menu"
      style={{
        position: "fixed",
        top: Math.max(8, Math.min(y, window.innerHeight - MENU_H - 8)),
        left: Math.max(8, Math.min(x, window.innerWidth - MENU_W - 8)),
        zIndex: 9999,
        minWidth: MENU_W,
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {askAgent && <>
        {item(hasSelection ? "Ask agent about selection…" : "Ask agent about file…", askAgent, "editor-menu-ask-agent", "")}
        <div className={menuDividerClass} />
      </>}
      {item("Undo", actions.undo, "editor-menu-undo", hint("cmd+z", "ctrl+z"), readOnly || !canUndo)}
      {item("Redo", actions.redo, "editor-menu-redo", hint("cmd+shift+z", "ctrl+y"), readOnly || !canRedo)}
      <div className={menuDividerClass} />
      {item("Cut", actions.cut, "editor-menu-cut", hint("cmd+x", "ctrl+x"), readOnly || !hasSelection)}
      {item("Copy", actions.copy, "editor-menu-copy", hint("cmd+c", "ctrl+c"), !hasSelection)}
      {item("Paste", actions.paste, "editor-menu-paste", hint("cmd+v", "ctrl+v"), readOnly)}
      {item("Select All", actions.selectAll, "editor-menu-select-all", hint("cmd+a", "ctrl+a"))}
      <div className={menuDividerClass} />
      {item("Find…", actions.find, "editor-menu-find", hint("cmd+f", "ctrl+f"))}
      {!readOnly && item("Replace…", actions.replace, "editor-menu-replace", hint("cmd+alt+f", "ctrl+h"))}
      {item("Go to Line…", actions.gotoLine, "editor-menu-goto", keyLabel("ctrl+g"))}
    </div>,
    document.body,
  );
}
