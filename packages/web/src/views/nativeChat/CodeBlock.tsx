import { Fragment, useEffect, useState, type ReactNode } from "react";
import { highlightCode, tagHighlighter, tags as t } from "@lezer/highlight";
import { loadLanguageByName } from "../../editorSyntax";
import { CopyButton } from "./CopyButton";

/** Same palette as the file editor (`editorSyntax.ts`), as classes: `highlightCode` hands back class names,
 * and chat.css maps each to the theme's CSS variable. */
const highlighter = tagHighlighter([
  { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.moduleKeyword, t.definitionKeyword], class: "hl-keyword" },
  { tag: [t.string, t.special(t.string), t.character, t.attributeValue], class: "hl-string" },
  { tag: [t.number, t.bool, t.null, t.atom, t.constant(t.name), t.unit], class: "hl-number" },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.propertyName, t.attributeName], class: "hl-function" },
  { tag: [t.typeName, t.className, t.namespace, t.macroName], class: "hl-type" },
  { tag: [t.tagName, t.regexp, t.escape, t.link, t.url], class: "hl-tag" },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], class: "hl-comment" },
]);

/** Past this, a block stays plain: highlighting must not cost a frame on a pasted log. */
const MAX_HIGHLIGHT = 20_000;

/** The code as spans, or null when its language is unknown or still loading. */
function useHighlighted(lang: string, code: string): ReactNode[] | null {
  const [nodes, setNodes] = useState<ReactNode[] | null>(null);
  useEffect(() => {
    setNodes(null);
    if (!lang || code.length > MAX_HIGHLIGHT) return;
    let current = true;
    void loadLanguageByName(lang).then((support) => {
      if (!current || !support) return;
      const out: ReactNode[] = [];
      let key = 0;
      highlightCode(code, support.language.parser.parse(code), highlighter,
        (text, classes) => out.push(classes ? <span key={key++} className={classes}>{text}</span> : <Fragment key={key++}>{text}</Fragment>),
        () => out.push("\n"));
      setNodes(out);
    });
    return () => { current = false; };
  }, [lang, code]);
  return nodes;
}

/** A fenced code block: language label, copy button, theme-coloured syntax. */
export function CodeBlock({ lang, text }: { lang: string; text: string }) {
  const nodes = useHighlighted(lang, text);
  return <div className="md-code" data-testid="native-cli-code-block">
    <div className="md-code__bar"><span>{lang || "text"}</span><CopyButton text={text} label="Copy code" testId="copy-code" /></div>
    <pre tabIndex={0}><code>{nodes ?? text}</code></pre>
  </div>;
}
