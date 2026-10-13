/**
 * Keeping the editor's document and the store's draft in step without breaking undo.
 *
 * Line endings: CodeMirror's document is always LF-only (it splits on \r\n, \r and \n). The
 * editor therefore works on `toLf(value)` everywhere (creating, comparing, diffing, restoring)
 * and writes edits back with `fromLf(text, eol)`, where `eol` is `detectEol` of the latest
 * authoritative value. Policy: the file's first line ending wins; a file with mixed endings is
 * normalised to it on its first edit.
 *
 * Applying a store value: CodeMirror's undo history is mapped through every change, so a
 * delete-all/insert-all (or one change spanning unchanged text) sends old edit positions to the
 * end of the text. `externalChanges` finds the changed lines, then the changed characters within
 * them, so unchanged lines and unchanged characters keep their positions.
 */
import { diffChars, diffLines, type Change } from "diff";

export type Eol = "\n" | "\r\n" | "\r";

/** The text's first line ending, or undefined when it has none (then the caller keeps what it had). */
export function detectEol(text: string): Eol | undefined {
  return /\r\n|\r|\n/.exec(text)?.[0] as Eol | undefined;
}

export const toLf = (text: string): string => text.replace(/\r\n?/g, "\n");

export const fromLf = (text: string, eol: Eol): string => (eol === "\n" ? text : text.replace(/\n/g, eol));

export interface TextChange { from: number; to: number; insert: string }

/** The smallest single change turning `old` into `next` (common prefix and suffix kept). */
export function minimalChange(old: string, next: string): TextChange {
  const max = Math.min(old.length, next.length);
  let from = 0;
  while (from < max && old.charCodeAt(from) === next.charCodeAt(from)) from++;
  let oldEnd = old.length;
  let newEnd = next.length;
  while (oldEnd > from && newEnd > from && old.charCodeAt(oldEnd - 1) === next.charCodeAt(newEnd - 1)) { oldEnd--; newEnd--; }
  return { from, to: oldEnd, insert: next.slice(from, newEnd) };
}

/** Disjoint changes (positions in the old text) from a diff's parts. */
function changesFromParts(parts: Change[]): TextChange[] {
  const out: TextChange[] = [];
  let pos = 0;
  for (const part of parts) {
    const last = out.at(-1);
    const touching = last !== undefined && last.to === pos;
    if (part.added) {
      if (touching) last.insert += part.value;
      else out.push({ from: pos, to: pos, insert: part.value });
    } else if (part.removed) {
      if (touching) last.to += part.value.length;
      else out.push({ from: pos, to: pos + part.value.length, insert: "" });
      pos += part.value.length;
    } else {
      pos += part.value.length;
    }
  }
  return out;
}

/** Characters that really changed inside one replaced run of lines. */
function refine(old: string, change: TextChange): TextChange[] {
  if (change.from === change.to || change.insert === "") return [change];
  const before = old.slice(change.from, change.to);
  const parts = diffChars(before, change.insert, { maxEditLength: 2000, timeout: 100 });
  const inner = parts ? changesFromParts(parts) : [minimalChange(before, change.insert)];
  return inner.map((c) => ({ from: change.from + c.from, to: change.from + c.to, insert: c.insert }));
}

/** Changes (positions in `old`) turning `old` into `next`, one per disjoint run of changed characters.
 * ponytail: past the edit-length / time caps (a near-total rewrite of a big file or a huge line) this
 * falls back to one spanning change, which maps undo history coarsely; upgrade path is a cheaper
 * heuristic diff. */
export function externalChanges(old: string, next: string): TextChange[] {
  const parts = diffLines(old, next, { maxEditLength: 4000, timeout: 200 });
  if (!parts) return [minimalChange(old, next)];
  return changesFromParts(parts).flatMap((change) => refine(old, change));
}
