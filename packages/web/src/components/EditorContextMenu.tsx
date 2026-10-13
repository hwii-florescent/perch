/**
 * EditorContextMenu.tsx — right-click menu of the file editor: Undo / Redo, Cut / Copy / Paste,
 * Select All, Find, Replace, Go to Line. The same chrome as the explorer's menu (`ui/menu.ts`,
 * portal, closes on outside click / Escape / blur). Edits are plain CodeMirror transactions, so
 * they reach the draft through the editor's own update listener.
 */
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { redo, redoDepth, selectAll, undo, undoDepth } from "@codemirror/commands";
import { gotoLine, openSearchPanel } from "@codemirror/search";
import type { EditorView } from "@codemirror/view";
import { openReplace } from "../editorSearchPanel";
import { IS_MAC, formatCombo } from "../keyCombo";
import { cn } from "../lib/cn";
import { menuDivider, menuItem, menuPanel } from "./ui/menu";

const MENU_W = 230;
/** The key the editor answers to (`editorKeymap.ts`, CodeMirror's defaults), as the platform writes it. */
const hint = (mac: string, other: string) => formatCombo(IS_MAC ? mac : other);
const MENU_H = 320;

export function EditorContextMenu({ view, x, y, readOnly, onClose }: {
  view: EditorView;
  x: number;
  y: number;
  readOnly: boolean;
  onClose: () => void;
}) {
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

  const state = view.state;
  const hasSelection = state.selection.ranges.some((range) => !range.empty);
  const selectedText = () => state.selection.ranges.map((range) => state.sliceDoc(range.from, range.to)).join("\n");
  const swallow = (task: () => unknown) => { try { void Promise.resolve(task()).catch(() => undefined); } catch { /* clipboard unavailable */ } };

  /** Run, close, and hand focus back to the editor. */
  const act = (task: () => unknown) => () => { onClose(); swallow(task); view.focus(); };
  const copy = () => navigator.clipboard.writeText(selectedText());
  const cut = () => copy().then(() => view.dispatch({ ...view.state.replaceSelection(""), userEvent: "delete.cut", scrollIntoView: true }));
  const paste = () => navigator.clipboard.readText().then((text) => {
    if (text) view.dispatch({ ...view.state.replaceSelection(text), userEvent: "input.paste", scrollIntoView: true });
  });

  const item = (label: string, onSelect: () => void, testId: string, keys: string, disabled = false) => (
    <button type="button" className={cn(menuItem(), "flex items-center justify-between gap-6")} data-testid={testId} disabled={disabled} onClick={onSelect}>
      <span>{label}</span>
      <span className="text-[0.72rem] text-subtext-0">{keys}</span>
    </button>
  );

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
      {item("Undo", act(() => undo(view)), "editor-menu-undo", hint("cmd+z", "ctrl+z"), readOnly || undoDepth(state) === 0)}
      {item("Redo", act(() => redo(view)), "editor-menu-redo", hint("cmd+shift+z", "ctrl+y"), readOnly || redoDepth(state) === 0)}
      <div className={menuDivider} />
      {item("Cut", act(cut), "editor-menu-cut", hint("cmd+x", "ctrl+x"), readOnly || !hasSelection)}
      {item("Copy", act(copy), "editor-menu-copy", hint("cmd+c", "ctrl+c"), !hasSelection)}
      {item("Paste", act(paste), "editor-menu-paste", hint("cmd+v", "ctrl+v"), readOnly)}
      {item("Select All", act(() => selectAll(view)), "editor-menu-select-all", hint("cmd+a", "ctrl+a"))}
      <div className={menuDivider} />
      {item("Find…", act(() => openSearchPanel(view)), "editor-menu-find", hint("cmd+f", "ctrl+f"))}
      {!readOnly && item("Replace…", act(() => openReplace(view)), "editor-menu-replace", hint("cmd+alt+f", "ctrl+h"))}
      {item("Go to Line…", act(() => gotoLine(view)), "editor-menu-goto", formatCombo("ctrl+g"))}
    </div>,
    document.body,
  );
}
