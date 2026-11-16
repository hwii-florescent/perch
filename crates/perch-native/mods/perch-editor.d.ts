// The `perch-editor` module a native mod imports: the editor Perch draws, by document key
// (`crates/perch-native/src/editor/host.rs`). Events are read with `events(docKey)`; the module re-renders the mod
// that opened a document when it has new ones.
declare module "perch-editor" {
  export interface EditorOpen { path: string; value: string; readonly?: boolean; wrap?: boolean; label?: string; autoClose?: boolean }
  export type EditorEvent =
    | { type: "change" } | { type: "caret"; line: number; col: number } | { type: "focus" } | { type: "blur" }
    | { type: "contextmenu"; x: number; y: number } | { type: "save" } | { type: "goto" };
  export const Editor: { new(docKey: string, props?: {}): any };
  export function open(docKey: string, options: EditorOpen): { restored: boolean };
  export function park(docKey: string): void;
  export function release(docKey: string): void;
  export function events(docKey: string): EditorEvent[];
  export function value(docKey: string): string;
  export function setValue(docKey: string, text: string, options?: { external?: boolean }): void;
  export function setReadonly(docKey: string, on: boolean): void;
  export function setWrap(docKey: string, on: boolean): void;
  export function setAutoClose(docKey: string, on: boolean): void;
  export function focus(docKey: string): void;
  export function openSearch(docKey: string, replace?: boolean): void;
  export function closeSearch(docKey: string): void;
  export function isSearchOpen(docKey: string): boolean;
  export function openGoto(docKey: string): void;
  export function goTo(docKey: string, line: number, col?: number): void;
  export function caret(docKey: string): { line: number; col: number };
  export function selection(docKey: string): { text: string; startLine: number; endLine: number } | null;
  export function undo(docKey: string): void;
  export function redo(docKey: string): void;
  export function canUndo(docKey: string): boolean;
  export function canRedo(docKey: string): boolean;
  export function cut(docKey: string): void;
  export function copy(docKey: string): void;
  export function paste(docKey: string): void;
  export function selectAll(docKey: string): void;
}
