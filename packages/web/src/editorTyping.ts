/**
 * Typing behaviour of the file editor, taken from VS Code's source (checked against it, not guessed):
 * `autoClosingBrackets`/`autoClosingQuotes` "languageDefined", `autoClosingOvertype` and `autoClosingDelete`
 * "auto" (only a closer the editor inserted is typed over or deleted with its opener), and `autoIndent`
 * "full" (Enter indents after an opener and splits `{|}` into three lines; typing `}` re-indents the line).
 * CodeMirror's `closeBrackets` supplies the pairing, and `indentOnInput` and Enter come from the language
 * (`insertNewlineAndIndent` in `editorKeymap.ts`). Pairs apply only once a language is loaded, as in VS Code,
 * where a file with no language configuration has none.
 */
import { closeBrackets, closeBracketsKeymap, type CloseBracketConfig } from "@codemirror/autocomplete";
import { EditorState, Prec, type Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";

/** VS Code's `DEFAULT_AUTOCLOSE_BEFORE_LANGUAGE_DEFINED_BRACKETS` (characterPair.ts): an opener is closed
 * before these (and before whitespace or the end of the line), CodeMirror's own default being `)]}:;>`. */
export const AUTO_CLOSE_BEFORE = "'\"`;:.,=}])> \n\t";

let merging = false;

/** The language's own `closeBrackets` data (its bracket list) with VS Code's `before` set. Languages that
 * define the data (JavaScript) would otherwise hide any `before` from `closeBrackets`, which reads only the
 * first entry; the flag keeps this provider from answering its own lookup. */
const withVsCodeBefore = EditorState.languageData.of((state, pos, side) => {
  if (merging) return [];
  merging = true;
  try {
    const own = state.languageDataAt<CloseBracketConfig>("closeBrackets", pos, side)[0];
    return [{ closeBrackets: { ...own, before: AUTO_CLOSE_BEFORE } }];
  } finally {
    merging = false;
  }
});

/** Auto-closing pairs, typing over a closer, and Backspace removing an empty pair; for the language compartment. */
export const languageTyping: Extension = [
  closeBrackets(),
  Prec.highest(keymap.of(closeBracketsKeymap)),
  Prec.high(withVsCodeBefore),
];
