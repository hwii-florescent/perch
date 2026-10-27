// @vitest-environment jsdom
import { expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

it.each([false, true])("sanitizes chat HTML, including streaming=%s", (streaming) => {
  const html = renderMarkdown('**Hello** <script>alert(1)</script><img src="x" onerror="alert(1)"> [click](javascript:alert(1))', streaming);
  const content = new DOMParser().parseFromString(html, "text/html");
  expect(content.querySelector("strong")?.textContent).toBe("Hello");
  expect(content.querySelector("script")).toBeNull();
  expect(content.querySelector("img")?.hasAttribute("onerror")).toBe(false);
  expect(content.querySelector("a")?.hasAttribute("href")).toBe(false);
});
