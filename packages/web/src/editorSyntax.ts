/**
 * Syntax colours for the file editor: lezer tags mapped to the app's CSS variables
 * (`themes.ts` `applyTheme`), never hex, so every theme recolours an open editor. `resolveTheme`
 * already guarantees 4.5:1 contrast for each variable used here (`editorSyntax.test.ts`).
 */
import { HighlightStyle, LanguageDescription, type LanguageSupport } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { tags as t } from "@lezer/highlight";

const v = (name: string) => `var(--${name})`;

/** CSS variables the mapping uses; the test checks each is a real theme token. */
export const SYNTAX_VARS = ["mauve", "green", "peach", "blue", "yellow", "teal", "overlay-1", "red", "text"] as const;

export const syntaxStyle = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.moduleKeyword, t.definitionKeyword], color: v("mauve") },
  { tag: [t.string, t.special(t.string), t.character, t.attributeValue], color: v("green") },
  { tag: [t.number, t.bool, t.null, t.atom, t.constant(t.name), t.unit], color: v("peach") },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.propertyName, t.attributeName], color: v("blue") },
  { tag: [t.typeName, t.className, t.namespace, t.macroName], color: v("yellow") },
  { tag: [t.tagName, t.regexp, t.escape, t.link, t.url], color: v("teal") },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: v("overlay-1"), fontStyle: "italic" },
  { tag: t.invalid, color: v("red") },
  { tag: [t.heading, t.strong], fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
]);

/** Above this the language is skipped: parsing a huge file must not cost typing latency. */
export const MAX_HIGHLIGHT_CHARS = 300_000;

// The starter set; any other extension stays plain text.
const STARTER = new Set([
  "TypeScript", "TSX", "JavaScript", "JSX", "JSON", "Rust", "Python", "Markdown", "CSS", "HTML",
  "YAML", "TOML", "Shell", "Go", "Dockerfile",
]);
const starter = languages.filter((lang) => STARTER.has(lang.name));

/** The language for `path`, loaded, or null (unknown extension, or `large`: over `MAX_HIGHLIGHT_CHARS`). */
export async function loadLanguage(path: string, large: boolean): Promise<LanguageSupport | null> {
  if (large) return null;
  const description = LanguageDescription.matchFilename(starter, path.split("/").pop() ?? path);
  return description ? description.load().catch(() => null) : null;
}
