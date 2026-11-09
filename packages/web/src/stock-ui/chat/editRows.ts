import { type NativeUiEditFile, type NativeUiEditLine } from "@perch/sdk";

/** Orca `nativeChatEditFilePatchText`: a card's rows as patch text, for its copy button. Gaps carry no text. */
export function editFilePatchText(lines: readonly NativeUiEditLine[]): string {
  return lines.filter((line) => line.kind !== "gap").map((line) => `${line.kind === "add" ? "+" : line.kind === "del" ? "-" : " "}${line.text}`).join("\n");
}

/** One column: a removed row is located on the old side, everything else on the new side. */
export const unifiedLineNumber = (line: NativeUiEditLine): number | undefined => line.kind === "del" ? line.oldLineNumber : line.newLineNumber ?? line.oldLineNumber;

/** Characters the gutter needs; none when the positions only locate a snippet. */
export function gutterChars(file: NativeUiEditFile): number {
  if (!file.lineNumbersKnown) return 0;
  const widest = file.lines.reduce((max, line) => Math.max(max, unifiedLineNumber(line) ?? 0), 0);
  return Math.max(3, String(widest).length + 1);
}

export const CHANGE_VERB: Record<NativeUiEditFile["changeKind"], string> = { added: "Added", deleted: "Deleted", edited: "Edited", renamed: "Renamed" };

export const baseName = (path: string): string => path.split(/[\\/]/).filter(Boolean).pop() ?? path;
