// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Markdown, MarkdownPreview } from "@perch/sdk";

/**
 * Packages draw untrusted Markdown only through the fixed SDK components (`Markdown`, `MarkdownPreview`); the
 * sanitizers behind them are not package source and cannot be cloned. These are the attack inputs a package's
 * agent text or file draft could carry: none may leave a script, an event handler, a dangerous URL scheme or an
 * active embed in the document, and `perch-ui` data must stay text.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
const fired = vi.fn();
beforeEach(() => {
  (globalThis as { __pwned?: () => void }).__pwned = fired;
  fired.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

const ATTACKS: [string, string][] = [
  ["script tag", "hello <script>__pwned()</script> world"],
  ["img onerror handler", "<img src=x onerror=\"__pwned()\">"],
  ["inline handler on a block", "<div onclick=\"__pwned()\" onmouseover=\"__pwned()\">x</div>"],
  ["javascript: link", "[click](javascript:__pwned())"],
  ["javascript: html link", "<a href=\"javascript:__pwned()\">x</a>"],
  ["obfuscated javascript: link", "<a href=\"  JaVaScRiPt&colon;__pwned()\">x</a>"],
  ["vbscript: link", "<a href=\"vbscript:msgbox(1)\">x</a>"],
  ["data: html link", "[x](data:text/html;base64,PHNjcmlwdD5fX3B3bmVkKCk8L3NjcmlwdD4=)"],
  ["svg script", "<svg><script>__pwned()</script></svg>"],
  ["svg onload", "<svg onload=\"__pwned()\"><circle r=\"1\"/></svg>"],
  ["svg animate href", "<svg><a><animate attributeName=\"href\" values=\"javascript:__pwned()\"/><text>x</text></a></svg>"],
  ["iframe", "<iframe src=\"javascript:__pwned()\"></iframe>"],
  ["object/embed", "<object data=\"javascript:__pwned()\"></object><embed src=\"javascript:__pwned()\">"],
  ["form action", "<form action=\"javascript:__pwned()\"><button>go</button></form>"],
  ["form with a submit control", "<form><input name=q><button type=submit>go</button></form>"],
  ["meta refresh", "<meta http-equiv=\"refresh\" content=\"0;url=javascript:__pwned()\">"],
];

const DANGEROUS_URL = /^\s*(?:javascript|vbscript|data):/i;

function assertInert(root: Element) {
  // No embeds or active SVG, and no form or control whose submit could navigate the app away.
  expect(root.querySelector("script, iframe, object, embed, form, button, textarea, select, meta, animate, set, foreignObject")).toBeNull();
  for (const element of Array.from(root.querySelectorAll("*"))) {
    for (const attribute of Array.from(element.attributes)) {
      expect(attribute.name.startsWith("on"), `${element.tagName} ${attribute.name}`).toBe(false);
      if (["href", "src", "xlink:href", "action", "formaction", "data"].includes(attribute.name)) {
        expect(DANGEROUS_URL.test(attribute.value), `${element.tagName} ${attribute.name}=${attribute.value}`).toBe(false);
      }
    }
  }
  // Clicking whatever is left does not run anything either (handlers never navigate the app).
  for (const element of Array.from(root.querySelectorAll("a, button, svg, img, div, p"))) {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  }
  expect(fired).not.toHaveBeenCalled();
}

it.each(ATTACKS)("Markdown (agent text) leaves %s inert", async (_name, text) => {
  await act(async () => root.render(<Markdown text={text} />));
  const body = host.querySelector("[data-testid=chat-markdown]")!;
  expect(body).not.toBeNull();
  assertInert(body);
});

it.each(ATTACKS)("Markdown leaves %s inert while still streaming", async (_name, text) => {
  await act(async () => root.render(<Markdown text={text} streaming />));
  assertInert(host);
});

it.each(ATTACKS)("MarkdownPreview (file draft) leaves %s inert", async (_name, content) => {
  await act(async () => root.render(<MarkdownPreview workspaceId="w" path="docs/a.md" content={content} local />));
  const body = host.querySelector("[data-testid=workspace-markdown-preview]")!;
  expect(body).not.toBeNull();
  assertInert(body);
});

it("draws perch-ui block strings as text, never as HTML or links", async () => {
  const payload = "<img src=x onerror=__pwned()><a href=\"javascript:__pwned()\">x</a><svg onload=__pwned()>";
  const block = JSON.stringify([
    { type: "callout", tone: "error", title: payload, text: payload },
    { type: "table", columns: [payload], rows: [[payload]] },
    { type: "stats", items: [{ label: payload, value: payload, hint: payload }] },
  ]);
  await act(async () => root.render(<Markdown text={"```perch-ui\n" + block + "\n```"} />));
  const body = host.querySelector("[data-testid=chat-markdown]")!;
  expect(body.querySelector("img, a, svg")).toBeNull();
  expect(body.textContent).toContain(payload);
  assertInert(body);
});

it("keeps ordinary Markdown links and formatting", async () => {
  await act(async () => root.render(<Markdown text={"**bold** and [docs](https://example.com/docs)"} />));
  const body = host.querySelector("[data-testid=chat-markdown]")!;
  expect(body.querySelector("strong")?.textContent).toBe("bold");
  expect(body.querySelector("a")?.getAttribute("href")).toBe("https://example.com/docs");
});
