import { deleteBracketPair, insertBracket } from "@codemirror/autocomplete";
import { deleteCharBackward, insertNewlineAndIndent } from "@codemirror/commands";
import { indentOnInput, indentUnit } from "@codemirror/language";
import { EditorSelection, EditorState, type Transaction } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { loadLanguage } from "./editorSyntax";
import { languageTyping } from "./editorTyping";
import table from "./editorTyping.cases.json";

/** A state in `file`'s language holding `doc`, caret at `|` or selection between `[` and `]`. */
async function open(file: string, doc: string) {
  const support = (await loadLanguage(file, false))!;
  const caret = doc.indexOf("|");
  const selection = caret >= 0
    ? EditorSelection.cursor(caret)
    : EditorSelection.range(doc.indexOf("["), doc.indexOf("]") - 1);
  return EditorState.create({
    doc: doc.replace(/[|[\]]/g, ""),
    selection,
    extensions: [support, languageTyping, indentOnInput(), indentUnit.of("  ")],
  });
}
/** The text with the caret at `|`, or the selection between `[` and `]`. */
function text(state: EditorState) {
  const doc = state.doc.toString();
  const { from, to } = state.selection.main;
  return from === to ? doc.slice(0, from) + "|" + doc.slice(from) : doc.slice(0, from) + "[" + doc.slice(from, to) + "]" + doc.slice(to);
}
/** Runs a CodeMirror command on `state`; the next state, or null when it did nothing. */
function run(state: EditorState, command: (target: { state: EditorState; dispatch: (tr: Transaction) => void }) => boolean) {
  let next: EditorState | null = null;
  return command({ state, dispatch: (tr) => { next = tr.state; } }) ? next : null;
}
/** `key` as the editor takes it: a character is typed (pairing first), else Enter or Backspace. */
function press(state: EditorState, key: string): EditorState {
  if (key === "enter") return run(state, insertNewlineAndIndent)!;
  if (key === "backspace") return run(state, deleteBracketPair) ?? run(state, deleteCharBackward)!;
  const paired = insertBracket(state, key);
  if (paired) return paired.state;
  const { from, to } = state.selection.main;
  return state.update({ changes: { from, to, insert: key }, selection: EditorSelection.cursor(from + key.length), userEvent: "input.type" }).state;
}

describe("typing, as in VS Code", () => {
  for (const c of table.cases.filter((c) => (c as { web?: boolean }).web !== false)) {
    it(c.name, async () => {
      let state = await open(c.file, c.doc);
      for (const key of c.keys) state = press(state, key);
      expect(text(state)).toBe(c.expect);
    });
  }
});
