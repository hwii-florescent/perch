/**
 * Settings-resolved editor commands before CodeMirror's standard text-editing keymap.
 * The first catch-all is copied into later bindings by CodeMirror, so an override
 * wins even on a standard editing key. Global app commands are claimed in document
 * capture by keybinds.ts; this handler executes only editor-scoped winners.
 */
import { defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands";
import { closeSearchPanel, findNext, findPrevious, gotoLine, openSearchPanel } from "@codemirror/search";
import type { EditorView, KeyBinding } from "@codemirror/view";
import { shortcutFor } from "./keybinds";
import { openReplace, whenOpen } from "./editorSearchPanel";

const commands: Record<string, (view: EditorView) => boolean> = {
  "editor.find": openSearchPanel,
  "editor.replace": openReplace,
  "editor.replaceAlt": openReplace,
  "editor.findNext": whenOpen(findNext),
  "editor.findPrevious": whenOpen(findPrevious),
  "editor.findNextAlt": whenOpen(findNext),
  "editor.findPreviousAlt": whenOpen(findPrevious),
  "editor.gotoLine": gotoLine,
};
export function runEditorShortcut(event: KeyboardEvent, view: EditorView, onSave: () => void): boolean {
  const selected = shortcutFor(event, "editor");
  if (selected?.scope !== "editor") return false;
  if (selected.id === "editor.save") onSave();
  else commands[selected.id]?.(view);
  return true; // A closed Find panel must not fall through to browser Find Next.
}
export function editorKeymap(onSave: () => void): KeyBinding[] {
  return [
    { any: (view, event) => runEditorShortcut(event, view, onSave), scope: "editor search-panel" },
    { key: "Escape", run: closeSearchPanel, scope: "editor search-panel" },
    indentWithTab, ...historyKeymap, ...defaultKeymap,
  ];
}
