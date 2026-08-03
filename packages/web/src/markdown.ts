/**
 * Markdown rendering for chat content, shared by the transcript bubbles
 * (`views/Chat.tsx`) and plan cards (`components/PlanCard.tsx`).
 *
 * It lives in its own module rather than in `Chat.tsx` because PlanCard is
 * imported *by* Chat.tsx — having it reach back for the renderer would make
 * the two files circular. Bundlers tolerate that (both bindings are hoisted
 * function declarations), but it's a trap for whoever next adds module-level
 * initialization to either file.
 */
import { marked } from "marked";
import DOMPurify from "dompurify";
import { repairMarkdown } from "./markdownRepair";

/** Render markdown text to sanitized HTML. Guard: only runs in browser.
 * While a message is still streaming, run it through `repairMarkdown` first
 * so a growing, incomplete string (open code fence, dangling `**`, etc.)
 * doesn't render visibly broken for a frame or two — see markdownRepair.ts. */
export function renderMarkdown(text: string, streaming: boolean): string {
  if (typeof window === "undefined") return text;
  const source = streaming ? repairMarkdown(text) : text;
  const html = marked.parse(source, { async: false }) as string;
  return DOMPurify.sanitize(html);
}
