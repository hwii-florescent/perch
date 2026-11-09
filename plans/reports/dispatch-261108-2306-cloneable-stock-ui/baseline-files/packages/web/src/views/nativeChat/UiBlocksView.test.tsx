// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { CodeBlock } from "./CodeBlock";
import { PerchUi } from "./UiBlocksView";
import { parseUi } from "./uiBlocks";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(node: React.ReactNode): HTMLDivElement {
  const host = document.createElement("div");
  document.body.append(host);
  act(() => createRoot(host).render(node));
  return host;
}

it("draws every string as text: markup and links in a block stay inert", () => {
  const blocks = parseUi(JSON.stringify([
    { type: "callout", tone: "warning", title: "<img src=x onerror=alert(1)>", text: "[a](javascript:alert(1)) <b>bold</b>" },
    { type: "table", columns: ["<i>c</i>"], rows: [["<script>x</script>"]] },
    { type: "stats", items: [{ label: "L", value: "1" }] },
    { type: "steps", items: [{ text: "t", state: "done" }] },
    { type: "bars", items: [{ label: "a", value: 2 }, { label: "b", value: -1 }] },
  ]))!;
  const host = render(<PerchUi blocks={blocks} />);
  expect(host.querySelector("img, script, a, b, i")).toBeNull();
  expect(host.textContent).toContain("<img src=x onerror=alert(1)>");
  expect(host.querySelectorAll("tbody td")).toHaveLength(1);
});

it("shows a fenced block's code with its language and a copy button", () => {
  const host = render(<CodeBlock lang="ts" text={"const a = 1;\nconst b = 2;"} />);
  expect(host.querySelector("pre")?.textContent).toBe("const a = 1;\nconst b = 2;");
  expect(host.textContent).toContain("ts");
  expect(host.querySelector("[data-testid=copy-code]")).not.toBeNull();
});
