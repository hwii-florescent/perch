/**
 * CodeEditor — the file editor (CodeMirror 6), a view over a draft owned by the store.
 *
 * `value` is the store's draft; edits leave through `onChange` and nothing else, so the
 * server-owned draft buffer, conflict handling and recovery in `filesystemStore.ts` are
 * untouched. Loaded lazily (`WorkspaceFiles.tsx`): CodeMirror stays out of the main chunk.
 * Remount per file (`key`): undo history, selection and scroll are per open file, parked in
 * `parked` when the editor unmounts (a tab switch) and restored when its text is unchanged.
 *
 * Colours are the app's CSS variables (`themes.ts` `applyTheme`), never CodeMirror's own
 * light/dark palettes, so every theme applies. Keys: `editorKeymap.ts`.
 */
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { Annotation, Compartment, EditorState, Prec, Transaction, type StateEffect } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";
import { history, historyField } from "@codemirror/commands";
import { bracketMatching, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { gotoLine, highlightSelectionMatches, search } from "@codemirror/search";
import { editorKeymap } from "../editorKeymap";
import { detectEol, externalChanges, fromLf, toLf, type Eol } from "../editorDiff";
import { IS_MAC } from "../keyCombo";
import { createSearchPanel } from "../editorSearchPanel";
import { EditorContextMenu } from "./EditorContextMenu";
import { MAX_HIGHLIGHT_CHARS, loadLanguage, syntaxStyle } from "../editorSyntax";

export interface CodeEditorHandle {
  openGoto: () => void;
  focus: () => void;
  askAgent: () => void;
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
  /** Identifies the document (workspace + path) for parking its editor state across unmounts. */
  docKey: string;
  onAskAgent?: (text: string, startLine: number, endLine: number) => void;
  ref?: Ref<CodeEditorHandle>;
}

/** Marks a transaction that applies the store's value (not a user edit): never echoed to `onChange`. */
const External = Annotation.define<boolean>();
const wrapping = new Compartment();
const access = new Compartment();
const language = new Compartment();

/** Editor state of unmounted editors (undo history, selection, scroll), least recently used first. */
const parked = new Map<string, { json: unknown; doc: string; scroll: StateEffect<unknown> }>();
const MAX_PARKED = 32;

const MUTED = "var(--overlay-1)";
// VS Code's defaults (EDITOR_FONT_DEFAULTS, GOLDEN_LINE_HEIGHT_RATIO): 12px / 1.5 on a Mac, 14px / 1.35
// elsewhere, times the zoom (`zoom.ts`).
const FONT_PX = IS_MAC ? 12 : 14;
const LINE_HEIGHT = IS_MAC ? "1.5" : "1.35";
const theme = EditorView.theme({
  "&": { height: "100%", color: "var(--text)", backgroundColor: "transparent", fontSize: `calc(${FONT_PX}px * var(--zoom, 1))` },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: LINE_HEIGHT, overflow: "auto" },
  ".cm-content": { caretColor: "var(--text)", padding: "0.7rem 0 1rem" },
  ".cm-line": { padding: "0 0.75rem" },
  "&.cm-editor .cm-cursor": { borderLeftColor: "var(--text)" },
  // Opaque: the gutter is sticky, so a horizontally scrolled line passes under it instead of through the numbers.
  "&.cm-editor .cm-gutters": { backgroundColor: "var(--panel-bg)", color: MUTED, border: "none" },
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

export function CodeEditor({ value, onChange, onSave, onCaret, readOnly, wrap, label, path, docKey, onAskAgent, ref }: CodeEditorProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const view = useRef<EditorView | null>(null);
  // Latest callbacks, so the editor is built once.
  const callbacks = useRef({ onChange, onSave, onCaret, onAskAgent });
  callbacks.current = { onChange, onSave, onCaret, onAskAgent };
  // Strings sent to `onChange` that the store has not echoed back yet. A render can lag a fast
  // typist by a keystroke; its older `value` is an echo, not an external change to apply.
  const pending = useRef(new Set<string>());
  const initial = useRef({ value, readOnly, wrap, label, docKey });
  // The file's line ending: the editor's document is LF-only, edits leave through `fromLf` (`editorDiff.ts`).
  const eol = useRef<Eol>(detectEol(value) ?? "\n");
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  function askAgent() {
    const state = view.current?.state;
    if (!state) return;
    const selection = state.selection.main;
    const from = selection.empty ? 0 : selection.from;
    const to = selection.empty ? state.doc.length : selection.to;
    callbacks.current.onAskAgent?.(state.sliceDoc(from, to), state.doc.lineAt(from).number, state.doc.lineAt(Math.max(from, to - 1)).number);
  }

  useImperativeHandle(ref, () => ({
    openGoto: () => { if (view.current) { gotoLine(view.current); view.current.focus(); } },
    focus: () => view.current?.focus(),
    askAgent,
  }), []);

  // A layout effect: its cleanup must run before React detaches the DOM, because a detached scroller
  // reads scrollTop 0 and the scroll snapshot taken in the cleanup would always be the top.
  useLayoutEffect(() => {
    const { value: doc, readOnly: ro, wrap: wrapped, label: name, docKey: key } = initial.current;
    const config = {
        extensions: [
          Prec.high(keymap.of(editorKeymap(() => callbacks.current.onSave()))),
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
              const text = fromLf(update.state.doc.toString(), eol.current);
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
    };
    // Restore the parked state only if the text is what it was left as; otherwise its history
    // would describe a different document.
    const saved = parked.get(key);
    parked.delete(key);
    const lf = toLf(doc);
    const restored = saved && saved.doc === lf;
    const editor = new EditorView({
      parent: host.current!,
      state: restored
        ? EditorState.fromJSON(saved.json, config, { history: historyField })
        : EditorState.create({ doc: lf, ...config }),
    });
    view.current = editor;
    if (restored) {
      // CodeMirror's own scroll restoration (vertical and horizontal): it retries through layout.
      editor.dispatch({ effects: saved.scroll });
      const head = editor.state.selection.main.head;
      const line = editor.state.doc.lineAt(head);
      callbacks.current.onCaret({ line: line.number, col: head - line.from + 1 });
    }
    // e2e reads the whole document: the DOM only holds the visible lines.
    if (typeof navigator !== "undefined" && navigator.webdriver) {
      (editor.contentDOM as HTMLElement & { __doc?: () => string }).__doc = () => editor.state.doc.toString();
    }
    return () => {
      parked.set(key, { json: editor.state.toJSON({ history: historyField }), doc: editor.state.doc.toString(), scroll: editor.scrollSnapshot() });
      if (parked.size > MAX_PARKED) parked.delete(parked.keys().next().value!);
      editor.destroy();
      view.current = null;
    };
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
    // A value that is not our own echo is authoritative for the line ending, even when only the
    // endings changed (the editor can also mount before the content arrives).
    const echo = pending.current.has(value);
    if (!echo) eol.current = detectEol(value) ?? eol.current;
    const editor = view.current;
    if (!editor || editor.composing) return;
    const doc = editor.state.doc;
    const lf = toLf(value);
    if (doc.length === lf.length && doc.toString() === lf) { pending.current.clear(); return; }
    if (echo) return;
    pending.current.clear();
    editor.dispatch({
      changes: externalChanges(doc.toString(), lf),
      annotations: [External.of(true), Transaction.addToHistory.of(false)],
    });
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: wrapping.reconfigure(wrap ? EditorView.lineWrapping : []) });
  }, [wrap]);

  useEffect(() => {
    view.current?.dispatch({ effects: access.reconfigure([EditorState.readOnly.of(readOnly), EditorView.contentAttributes.of({ "data-readonly": String(readOnly) })]) });
  }, [readOnly]);

  // main.tsx cancels every right-click without a menu of its own; the find panel's inputs keep the OS one.
  function handleContextMenu(event: React.MouseEvent) {
    const editor = view.current;
    if (!editor || (event.target as Element).closest(".cm-panels")) return;
    event.preventDefault();
    // Like VS Code: a right-click outside the selection moves the caret there first.
    const pos = editor.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos !== null && !editor.state.selection.ranges.some((range) => !range.empty && pos >= range.from && pos <= range.to)) {
      editor.dispatch({ selection: { anchor: pos } });
    }
    setMenu({ x: event.clientX, y: event.clientY });
  }

  return (
    <>
      <div ref={host} className="min-h-0 min-w-0 flex-1 overflow-hidden" onContextMenu={handleContextMenu} />
      {menu && view.current && <EditorContextMenu view={view.current} x={menu.x} y={menu.y} readOnly={readOnly} onAskAgent={onAskAgent ? askAgent : undefined} onClose={() => setMenu(null)} />}
    </>
  );
}
