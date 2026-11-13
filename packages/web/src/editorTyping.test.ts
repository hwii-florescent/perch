import { insertBracket } from "@codemirror/autocomplete";
import { insertNewlineAndIndent } from "@codemirror/commands";
import { indentOnInput, indentUnit } from "@codemirror/language";
import { EditorSelection, EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { loadLanguage } from "./editorSyntax";
import { languageTyping } from "./editorTyping";

/** A state in `file`'s language holding `doc`, caret at `|`. */
async function open(file: string, doc: string) {
  const support = (await loadLanguage(file, false))!;
  const at = doc.indexOf("|");
  return EditorState.create({
    doc: doc.replace("|", ""),
    selection: EditorSelection.cursor(at),
    extensions: [support, languageTyping, indentOnInput(), indentUnit.of("  ")],
  });
}
const text = (state: EditorState) => state.doc.toString().slice(0, state.selection.main.head) + "|" + state.doc.toString().slice(state.selection.main.head);
const type = (state: EditorState, ch: string) => insertBracket(state, ch)?.state ?? null;
function enter(state: EditorState) {
  let next = state;
  insertNewlineAndIndent({ state, dispatch: (tr) => { next = tr.state; } });
  return next;
}

describe("typing, as in VS Code", () => {
  it("closes an opener at the end of a line, and a typed closer goes over it", async () => {
    const opened = type(await open("A.java", "if (x) |"), "{")!;
    expect(text(opened)).toBe("if (x) {|}");
    expect(text(type(opened, "}")!)).toBe("if (x) {}|");
  });

  it("types over only a closer it inserted, not one that was already there", async () => {
    expect(type(await open("A.java", "f(|)"), ")")).toBeNull();
  });

  it("closes only before whitespace, the end of a line or VS Code's `before` set, not before a word", async () => {
    expect(type(await open("A.java", "|x"), "(")).toBeNull();
    // `.` and `"` are in VS Code's set but not CodeMirror's: also in a language that defines its own closeBrackets.
    for (const file of ["A.java", "a.ts"]) {
      expect(text((type(await open(file, "|.x"), "(")!))).toBe("(|).x");
      expect(text((type(await open(file, '|"x"'), "(")!))).toBe('(|)"x"');
    }
  });

  it("closes a quote, but not after a word character", async () => {
    expect(text(type(await open("a.ts", "const s = |"), '"')!)).toBe('const s = "|"');
    expect(type(await open("a.ts", "don|"), "'")).toBeNull();
  });

  it("surrounds a selection with the pair", async () => {
    const state = (await open("A.java", "x|")).update({ selection: EditorSelection.range(0, 1) }).state;
    expect(type(state, "(")!.doc.toString()).toBe("(x)");
  });

  it("Enter after an opener indents, and between a pair opens an indented middle line", async () => {
    expect(text(enter(await open("A.java", "class A {|")))).toBe("class A {\n  |");
    expect(text(enter(await open("A.java", "class A {\n  void f() {|}\n}")))).toBe("class A {\n  void f() {\n    |\n  }\n}");
  });

  it("a typed } re-indents its line to the opener's", async () => {
    const state = await open("A.java", "class A {\n  void f() {\n    x();\n    |\n}");
    const typed = state.update({ changes: { from: state.selection.main.head, insert: "}" }, selection: EditorSelection.cursor(state.selection.main.head + 1), userEvent: "input.type" }).state;
    expect(typed.doc.toString()).toBe("class A {\n  void f() {\n    x();\n  }\n}");
  });
});
