//! markdown.mjs: a Markdown file's rendered preview, drawn from `marked`'s tokens into a fixed set of elements, the
//! ones the web's sanitised preview keeps (`renderFilePreview` in `packages/web/src/markdown.ts`), so the web's
//! `.file-markdown` rules style both. Nothing is parsed as HTML: an HTML token is drawn as its text. Nothing loads on
//! its own: an image is the web's text placeholder (`[image: alt] url`). A link is drawn only for an absolute
//! http(s) address and opens on an explicit click through the window (`link.open`); any other keeps its address as
//! its title, as the web's does.
import { createElement as h, Fragment } from "react";
import { Lexer } from "marked";

/** The web renders this much of a document; the rest is left to Source. */
export const FILE_PREVIEW_MAX_CHARS = 200_000;

/** `text` cut where the web cuts it, and whether it was cut. */
export function previewSource(text) {
  if (text.length <= FILE_PREVIEW_MAX_CHARS) return { source: text, truncated: false };
  const cut = text.lastIndexOf("\n", FILE_PREVIEW_MAX_CHARS);
  return { source: text.slice(0, cut > 0 ? cut : FILE_PREVIEW_MAX_CHARS), truncated: true };
}

const placeholder = (tag, alt, url) => {
  const shown = url.startsWith("data:") ? "data URL" : url.length > 200 ? `${url.slice(0, 200)}…` : url;
  return `[${tag}${alt ? `: ${alt}` : ""}]${shown ? ` ${shown}` : ""}`;
};

/** The elements for `tokens`; `open(url)` opens a link. */
function render(tokens, open) {
  return (tokens ?? []).map((token, key) => one(token, key, open));
}

function inline(token, open) {
  return token.tokens ? render(token.tokens, open) : token.text;
}

function one(token, key, open) {
  switch (token.type) {
    case "space": return null;
    case "heading": return h(`h${token.depth}`, { key }, inline(token, open));
    case "paragraph": return h("p", { key }, inline(token, open));
    case "text": return token.tokens ? h(Fragment, { key }, render(token.tokens, open)) : token.text;
    case "escape": return token.text;
    case "strong": return h("strong", { key }, inline(token, open));
    case "em": return h("em", { key }, inline(token, open));
    case "del": return h("del", { key }, inline(token, open));
    case "codespan": return h("code", { key }, token.text);
    case "br": return h("br", { key });
    case "hr": return h("hr", { key });
    case "code": {
      const language = /^[\w#+.-]+$/.test(token.lang ?? "") ? `language-${token.lang}` : undefined;
      return h("pre", { key }, h("code", language ? { className: language } : null, token.text));
    }
    case "blockquote": return h("blockquote", { key }, render(token.tokens, open));
    case "list": {
      const items = token.items.map((item, i) => h("li", { key: i },
        item.task ? h("input", { type: "checkbox", checked: !!item.checked, disabled: true, readOnly: true }) : null,
        item.task ? " " : null,
        render(item.tokens, open)));
      return token.ordered ? h("ol", { key, start: token.start === "" || token.start === 1 ? undefined : token.start }, items) : h("ul", { key }, items);
    }
    case "table": {
      const align = (i) => (token.align[i] ? { textAlign: token.align[i] } : undefined);
      return h("table", { key },
        h("thead", null, h("tr", null, token.header.map((cell, i) => h("th", { key: i, style: align(i) }, render(cell.tokens, open))))),
        h("tbody", null, token.rows.map((row, r) => h("tr", { key: r }, row.map((cell, i) => h("td", { key: i, style: align(i) }, render(cell.tokens, open)))))));
    }
    case "link": {
      const href = token.href ?? "";
      if (!/^https?:\/\//i.test(href)) return h("a", { key, title: href || undefined }, inline(token, open));
      const onClick = (event) => { event.preventDefault?.(); open(href); };
      return h("a", { key, href, rel: "noopener noreferrer", onClick }, inline(token, open));
    }
    case "image": return h("span", { key, className: "md-placeholder" }, placeholder("image", token.text, token.href ?? ""));
    // Raw HTML is never parsed: it is drawn as written.
    case "html": return token.block ? h("p", { key }, token.text) : token.text;
    default: return token.raw ?? null;
  }
}

/** The preview's elements for Markdown `text`. */
export function markdownElements(text, open) {
  return render(Lexer.lex(text, { gfm: true }), open);
}
