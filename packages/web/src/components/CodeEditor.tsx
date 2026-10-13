/**
 * CodeEditor — the file editor (CodeMirror 6), a view over a draft owned by the store.
 *
 * `value` is the store's draft; edits leave through `onChange` and nothing else, so the
 * server-owned draft buffer, conflict handling and recovery in `filesystemStore.ts` are
 * untouched. Loaded lazily (`WorkspaceFiles.tsx`): CodeMirror stays out of the main chunk.
 * Remount per file (`key`): undo history is per open file, as with the textarea before it.
 *
 * Colours are the app's CSS variables (`themes.ts` `applyTheme`), never CodeMirror's own
 * light/dark palettes, so every theme applies. Keys: `editorKeymap.ts`.
 */
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { Annotation, Compartment, EditorState, Prec, Transaction } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";
import { history } from "@codemirror/commands";
import { bracketMatching, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { gotoLine, highlightSelectionMatches, search } from "@codemirror/search";
import { editorKeymap } from "../editorKeymap";
import { createSearchPanel } from "../editorSearchPanel";
import { MAX_HIGHLIGHT_CHARS, loadLanguage, syntaxStyle } from "../editorSyntax";

export interface CodeEditorHandle {
  openGoto: () => void;
  focus: () => void;
}

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCaret: (caret: { line: number; col: number }) => void;
  readOnly: boolean;
  wrap: boolean;
  label: string;
  /** The file's path: its extension picks the language (`editorSyntax.ts`). */
  path: string;
  ref?: Ref<CodeEditorHandle>;
}

/** Marks a transaction that applies the store's value (not a user edit): never echoed to `onChange`. */
const External = Annotation.define<boolean>();
const wrapping = new Compartment();
const access = new Compartment();
const language = new Compartment();

const MUTED = "var(--overlay-1)";
const theme = EditorView.theme({
  "&": { height: "100%", color: "var(--text)", backgroundColor: "transparent", fontSize: "inherit" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "1.55", overflow: "auto" },
  ".cm-content": { caretColor: "var(--text)", padding: "0.7rem 0 1rem" },
  ".cm-line": { padding: "0 0.75rem" },
  "&.cm-editor .cm-cursor": { borderLeftColor: "var(--text)" },
  "&.cm-editor .cm-gutters": { backgroundColor: "transparent", color: MUTED, border: "none" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 0.5rem 0 0.75rem", minWidth: "2.25rem" },
  "&.cm-editor .cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--surface-1) 50%, transparent)" },
  "&.cm-editor .cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--text)" },
  "&.cm-editor .cm-selectionBackground, &.cm-editor.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    background: "color-mix(in srgb, var(--accent) 28%, transparent)",
  },
  "&.cm-editor .cm-selectionMatch": { backgroundColor: "color-mix(in srgb, var(--yellow) 20%, transparent)" },
  "&.cm-editor .cm-searchMatch": { backgroundColor: "color-mix(in srgb, var(--yellow) 28%, transparent)", outline: "none" },
  "&.cm-editor .cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "color-mix(in srgb, var(--yellow) 55%, transparent)" },
  "&.cm-editor .cm-matchingBracket": { backgroundColor: "color-mix(in srgb, var(--overlay-1) 30%, transparent)", outline: "none" },
  "&.cm-editor .cm-nonmatchingBracket": { backgroundColor: "color-mix(in srgb, var(--red) 30%, transparent)" },
  // The find/replace and go-to-line panels float over the top-right corner like VS Code's widget, in the
  // look of the app's popup menus (`ui/menu.ts` `menuPanel`: surface-1, rounded, shadow). They leave the
  // layout flow; CodeMirror still adds their height to the scroll margin, so a match scrolled into view clears them.
  "&.cm-editor .cm-panels": { backgroundColor: "transparent", color: "var(--text)", border: "none", position: "absolute", top: "0.5rem", right: "1rem", left: "auto", pointerEvents: "none" },
  "&.cm-editor .cm-panel": {
    pointerEvents: "auto", boxSizing: "border-box", maxWidth: "calc(100vw - 3rem)", fontSize: "0.82rem",
    backgroundColor: "var(--surface-1)", borderRadius: "var(--radius)", boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
  },
  // The find panel (`editorSearchPanel.ts`) styles its controls with Tailwind classes; these unlayered
  // rules only undo CodeMirror's own spacing, which would otherwise beat the layered utilities.
  "&.cm-editor .cm-panel.cm-search": { width: "24rem", padding: "0.5rem" },
  "&.cm-editor .cm-panel.cm-search input, &.cm-editor .cm-panel.cm-search button, &.cm-editor .cm-panel.cm-search label": { margin: "0", fontSize: "0.82rem" },
  // The go-to-line dialog (CodeMirror's own DOM) on the same measures: 1.75rem controls, 0.82rem text.
  "&.cm-editor .cm-dialog": { display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.5rem" },
  "&.cm-editor .cm-dialog form": { display: "flex", alignItems: "center", gap: "0.25rem", margin: "0" },
  "&.cm-editor .cm-dialog label": { display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", color: "var(--subtext-0)" },
  "&.cm-editor .cm-dialog-close": { position: "static", width: "1.75rem", height: "1.75rem", fontSize: "0.82rem", color: "var(--subtext-0)", borderRadius: "var(--radius)", cursor: "pointer" },
  "&.cm-editor .cm-textfield": {
    boxSizing: "border-box", height: "1.75rem", minWidth: "0", backgroundColor: "var(--surface-0)", color: "var(--text)",
    border: "1px solid var(--overlay-0)", borderRadius: "var(--radius)", fontFamily: "inherit", fontSize: "0.82rem", padding: "0 0.55rem",
  },
  "&.cm-editor .cm-textfield:focus": { outline: "1px solid var(--accent)" },
  "&.cm-editor .cm-button": {
    boxSizing: "border-box", height: "1.75rem", backgroundImage: "none", backgroundColor: "transparent", color: "var(--subtext-0)",
    border: "0", borderRadius: "var(--radius)", fontFamily: "inherit", fontSize: "0.82rem", padding: "0 0.5rem", cursor: "pointer",
  },
  "&.cm-editor .cm-button:hover, &.cm-editor .cm-dialog-close:hover": { backgroundColor: "var(--surface-0)", color: "var(--text)" },
});

export function CodeEditor({ value, onChange, onSave, onCaret, readOnly, wrap, label, path, ref }: CodeEditorProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const view = useRef<EditorView | null>(null);
  // Latest callbacks, so the editor is built once.
  const callbacks = useRef({ onChange, onSave, onCaret });
  callbacks.current = { onChange, onSave, onCaret };
  // Strings sent to `onChange` that the store has not echoed back yet. A render can lag a fast
  // typist by a keystroke; its older `value` is an echo, not an external change to apply.
  const pending = useRef(new Set<string>());
  const initial = useRef({ value, readOnly, wrap, label });

  useImperativeHandle(ref, () => ({
    openGoto: () => { if (view.current) { gotoLine(view.current); view.current.focus(); } },
    focus: () => view.current?.focus(),
  }), []);

  useEffect(() => {
    const { value: doc, readOnly: ro, wrap: wrapped, label: name } = initial.current;
    const editor = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc,
        extensions: [
          Prec.high(keymap.of([{ key: "Mod-s", run: () => { callbacks.current.onSave(); return true; }, preventDefault: true }])),
          keymap.of(editorKeymap),
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          bracketMatching(),
          highlightSelectionMatches(),
          search({ top: true, createPanel: createSearchPanel }),
          indentUnit.of("  "),
          EditorState.tabSize.of(2),
          wrapping.of(wrapped ? EditorView.lineWrapping : []),
          access.of([EditorState.readOnly.of(ro), EditorView.contentAttributes.of({ "data-readonly": String(ro) })]),
          // The testid sits on the editable area only: the find panel's inputs must stay "editable" for keybinds.ts.
          EditorView.contentAttributes.of({ "aria-label": name, "data-testid": "workspace-file-editor", spellcheck: "false", autocorrect: "off", autocapitalize: "off" }),
          theme,
          syntaxHighlighting(syntaxStyle),
          language.of([]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !update.transactions.some((tr) => tr.annotation(External))) {
              const text = update.state.doc.toString();
              pending.current.add(text);
              callbacks.current.onChange(text);
            }
            if (update.docChanged || update.selectionSet) {
              const head = update.state.selection.main.head;
              const line = update.state.doc.lineAt(head);
              callbacks.current.onCaret({ line: line.number, col: head - line.from + 1 });
            }
          }),
        ],
      }),
    });
    view.current = editor;
    // e2e reads the whole document: the DOM only holds the visible lines.
    if (typeof navigator !== "undefined" && navigator.webdriver) {
      (editor.contentDOM as HTMLElement & { __doc?: () => string }).__doc = () => editor.state.doc.toString();
    }
    return () => { editor.destroy(); view.current = null; };
  }, []);

  // The language follows the file's path and size. The editor can mount before the content arrives, so
  // size is read from `value`, not at mount; past the cap the file is plain (a late load is dropped).
  const large = value.length > MAX_HIGHLIGHT_CHARS;
  useEffect(() => {
    let alive = true;
    void loadLanguage(path, large).then((support) => {
      if (alive) view.current?.dispatch({ effects: language.reconfigure(support ?? []) });
    });
    return () => { alive = false; };
  }, [path, large]);

  // The store changed the draft (reload, conflict, recovery): apply it without losing the caret or the undo stack.
  useEffect(() => {
    const editor = view.current;
    if (!editor || editor.composing) return;
    const doc = editor.state.doc;
    if (doc.length === value.length && doc.toString() === value) { pending.current.clear(); return; }
    if (pending.current.has(value)) return;
    pending.current.clear();
    editor.dispatch({
      changes: { from: 0, to: doc.length, insert: value },
      selection: { anchor: Math.min(editor.state.selection.main.head, value.length) },
      annotations: [External.of(true), Transaction.addToHistory.of(false)],
    });
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: wrapping.reconfigure(wrap ? EditorView.lineWrapping : []) });
  }, [wrap]);

  useEffect(() => {
    view.current?.dispatch({ effects: access.reconfigure([EditorState.readOnly.of(readOnly), EditorView.contentAttributes.of({ "data-readonly": String(readOnly) })]) });
  }, [readOnly]);

  return <div ref={host} className="min-h-0 min-w-0 flex-1 overflow-hidden" />;
}
