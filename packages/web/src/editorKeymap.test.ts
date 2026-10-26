// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { editorKeymap, runEditorShortcut } from "./editorKeymap";
import { usePerchStore } from "./store";
const key = (init: KeyboardEventInit) => new KeyboardEvent("keydown", { key: "s", code: "KeyS", ctrlKey: true, ...init });
afterEach(() => usePerchStore.setState({ settings: undefined }));
it("keeps the standard editing keymap and native Escape, with the dynamic command handler first", () => {
  const bindings = editorKeymap(() => {});
  expect(bindings[0]!.any).toBeTypeOf("function");
  expect(bindings[1]!.key).toBe("Escape");
  for (const binding of [indentWithTab, ...historyKeymap, ...defaultKeymap]) expect(bindings).toContain(binding);
});
it("reads save overrides on every key without a keymap rebuild", () => {
  const save = vi.fn(), view = new EditorView({ state: EditorState.create() });
  try {
    usePerchStore.setState({ settings: { keybindings: { "editor.save": "ctrl+alt+s" } } as never });
    expect(runEditorShortcut(key({}), view, save)).toBe(false);
    expect(runEditorShortcut(key({ altKey: true }), view, save)).toBe(true);
    expect(save).toHaveBeenCalledOnce();
    usePerchStore.setState({ settings: { keybindings: { "editor.save": "" } } as never });
    expect(runEditorShortcut(key({ altKey: true }), view, save)).toBe(false);
  } finally { view.destroy(); }
});
it("does not execute globals or IME keys in the local handler", () => {
  const save = vi.fn(), view = new EditorView({ state: EditorState.create() });
  try {
    usePerchStore.setState({ settings: { keybindings: { "editor.save": "", "global.navigator": "ctrl+s" } } as never });
    expect(runEditorShortcut(key({}), view, save)).toBe(false);
    usePerchStore.setState({ settings: { keybindings: { "editor.save": "ctrl+s" } } as never });
    expect(runEditorShortcut(key({ isComposing: true }), view, save)).toBe(false);
    expect(runEditorShortcut(key({ keyCode: 229 }), view, save)).toBe(false);
    expect(save).not.toHaveBeenCalled();
  } finally { view.destroy(); }
});
