/**
 * EditorContextMenu.tsx: the file editor's right-click menu. The screen is `stock:editor-menu`
 * (`stock-ui/editor-menu/main.tsx`) or the person's package chosen for it; what each row does is bound here, on the
 * editor's CodeMirror view: edits are plain transactions, so they reach the draft through the editor's own update
 * listener, and every action closes the menu and gives the editor its focus back. A phone keeps Perch's own.
 */
import { redo, redoDepth, selectAll, undo, undoDepth } from "@codemirror/commands";
import { gotoLine, openSearchPanel } from "@codemirror/search";
import type { EditorView } from "@codemirror/view";
import type { EditorMenuProps } from "@perch/sdk";
import { openReplace } from "../editorSearchPanel";
import { useIsMobileWidth } from "../responsive";
import EditorMenu from "../stock-ui/editor-menu/main";
import { StockRoute } from "./mod-root";

export function editorMenuProps({ view, x, y, readOnly, onAskAgent, onClose }: {
  view: EditorView;
  x: number;
  y: number;
  readOnly: boolean;
  onClose: () => void;
  onAskAgent?: () => void;
}): EditorMenuProps {
  const state = view.state;
  const hasSelection = state.selection.ranges.some((range) => !range.empty);
  const selectedText = () => view.state.selection.ranges.map((range) => view.state.sliceDoc(range.from, range.to)).join("\n");
  const swallow = (task: () => unknown) => { try { void Promise.resolve(task()).catch(() => undefined); } catch { /* clipboard unavailable */ } };
  /** Run, close, and hand focus back to the editor. */
  const act = (task: () => unknown) => () => { onClose(); swallow(task); view.focus(); };
  const copy = () => navigator.clipboard.writeText(selectedText());
  const cut = () => copy().then(() => view.dispatch({ ...view.state.replaceSelection(""), userEvent: "delete.cut", scrollIntoView: true }));
  const paste = () => navigator.clipboard.readText().then((text) => {
    if (text) view.dispatch({ ...view.state.replaceSelection(text), userEvent: "input.paste", scrollIntoView: true });
  });
  return {
    x, y, readOnly, hasSelection, onClose,
    canUndo: undoDepth(state) > 0,
    canRedo: redoDepth(state) > 0,
    actions: {
      undo: act(() => undo(view)),
      redo: act(() => redo(view)),
      cut: act(cut),
      copy: act(copy),
      paste: act(paste),
      selectAll: act(() => selectAll(view)),
      find: act(() => openSearchPanel(view)),
      replace: act(() => openReplace(view)),
      gotoLine: act(() => gotoLine(view)),
      ...(onAskAgent ? { askAgent: () => { onClose(); onAskAgent(); } } : {}),
    },
  };
}

export function EditorContextMenu(options: Parameters<typeof editorMenuProps>[0]) {
  return <StockRoute name="editor-menu" props={editorMenuProps(options)} stock={EditorMenu} exact={useIsMobileWidth()} />;
}
