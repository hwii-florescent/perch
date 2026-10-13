import { describe, expect, it } from "vitest";
import { EditorState, Transaction } from "@codemirror/state";
import { history, historyField, undo } from "@codemirror/commands";
import { detectEol, externalChanges, fromLf, minimalChange, toLf } from "./editorDiff";

/** What CodeEditor does for a store value it did not type itself. */
function applyExternal(state: EditorState, value: string, whole = false): EditorState {
  const old = state.doc.toString();
  const changes = whole ? { from: 0, to: old.length, insert: toLf(value) } : externalChanges(old, toLf(value));
  return state.update({ changes, annotations: Transaction.addToHistory.of(false) }).state;
}

function undone(state: EditorState): string {
  let next = state;
  undo({ state, dispatch: (tr) => { next = tr.state; } });
  return next.doc.toString();
}

/** Delete "beta\n" through the history, so there is an undo entry to map. */
function deleteBeta(): EditorState {
  const start = EditorState.create({ doc: "alpha\nbeta\ngamma\n", extensions: [history()] });
  return start.update({ changes: { from: 6, to: 11 }, userEvent: "delete" }).state;
}

describe("editor external replacement", () => {
  it("minimalChange is the smallest middle change", () => {
    expect(minimalChange("a\nb\nc", "a\nX\nc")).toEqual({ from: 2, to: 3, insert: "X" });
    expect(minimalChange("same", "same")).toEqual({ from: 4, to: 4, insert: "" });
  });

  it("externalChanges always turns old into next", () => {
    const cases: Array<[string, string]> = [
      ["", ""], ["", "a\n"], ["a\nb\n", ""], ["a\nb\nc", "a\nb\nc\n"], ["a\nb\nc\n", "A\nc\nd\n"],
      ["x\ny\nz\n", "z\ny\nx\n"], ["one", "two"], ["a\n\n\nb\n", "a\nb\n\n"],
    ];
    for (const [old, next] of cases) {
      const state = EditorState.create({ doc: old }).update({ changes: externalChanges(old, next) }).state;
      expect(state.doc.toString()).toBe(next);
    }
  });

  it("keeps undo in place for an append (the whole-document form does not)", () => {
    const after = deleteBeta();
    expect(after.doc.toString()).toBe("alpha\ngamma\n");
    expect(undone(applyExternal(after, "alpha\ngamma\nmore\n"))).toBe("alpha\nbeta\ngamma\nmore\n");
    // Illustrative: the replaced behaviour.
    expect(undone(applyExternal(after, "alpha\ngamma\nmore\n", true))).not.toBe("alpha\nbeta\ngamma\nmore\n");
  });

  it("keeps undo in place when the external update has two separate edits", () => {
    const after = deleteBeta();
    expect(undone(applyExternal(after, "ALPHA\ngamma\nmore\n"))).toBe("ALPHA\nbeta\ngamma\nmore\n");
  });
});

describe("undo within a modified line", () => {
  it("keeps undo in place when the external edit is on the same line", () => {
    const start = EditorState.create({ doc: "alpha beta gamma\n", extensions: [history()] });
    const after = start.update({ changes: { from: 6, to: 11 }, userEvent: "delete" }).state;
    expect(after.doc.toString()).toBe("alpha gamma\n");
    expect(undone(applyExternal(after, "ALPHA gamma\n"))).toBe("ALPHA beta gamma\n");
    // Two separate edits in the one line.
    expect(undone(applyExternal(after, "ALPHA GAMMA\n"))).toBe("ALPHA beta GAMMA\n");
  });
});

describe("line endings", () => {
  it("a CRLF file round-trips without an extra blank line", () => {
    const raw = "alpha\r\nbeta\r\ngamma\r\n";
    const eol = detectEol(raw) ?? "\n";
    expect(eol).toBe("\r\n");
    const state = EditorState.create({ doc: toLf(raw) });
    expect(state.doc.toString()).toBe("alpha\nbeta\ngamma\n");
    // The store echoing the same text is not a change.
    expect(externalChanges(state.doc.toString(), toLf(raw))).toEqual([]);
    // A reload with one changed line stays one-for-one.
    expect(applyExternal(state, "alpha\r\nBETA\r\ngamma\r\n").doc.toString()).toBe("alpha\nBETA\ngamma\n");
    // An edit leaves in the file's own ending.
    expect(fromLf("alpha\nbeta!\ngamma\n", eol)).toBe("alpha\r\nbeta!\r\ngamma\r\n");
    expect(detectEol("a\rb")).toBe("\r");
    expect(detectEol("no breaks")).toBeUndefined();
  });
});

describe("editor state parked across a tab switch", () => {
  it("restores undo history and selection through JSON", () => {
    const after = deleteBeta().update({ selection: { anchor: 3 } }).state;
    const json = after.toJSON({ history: historyField });
    const restored = EditorState.fromJSON(json, { extensions: [history()] }, { history: historyField });
    expect(restored.doc.toString()).toBe("alpha\ngamma\n");
    expect(restored.selection.main.head).toBe(3);
    expect(undone(restored)).toBe("alpha\nbeta\ngamma\n");
  });
});
