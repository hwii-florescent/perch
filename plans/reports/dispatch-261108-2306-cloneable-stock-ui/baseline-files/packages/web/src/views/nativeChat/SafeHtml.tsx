import { useLayoutEffect, useRef } from "react";
import DOMPurify from "dompurify";

/** Markdown HTML, sanitized where it is inserted whatever produced it: DOMPurify hands back a DOM
 * fragment, which is attached as nodes, so no HTML string is ever injected. Idempotent over HTML
 * `splitMarkdown` already cleaned. A layout effect, so the parent's effects see the anchors. */
export function SafeHtml({ html }: { html: string }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    host.current?.replaceChildren(DOMPurify.sanitize(html, { RETURN_DOM_FRAGMENT: true }));
  }, [html]);
  return <div ref={host} />;
}
