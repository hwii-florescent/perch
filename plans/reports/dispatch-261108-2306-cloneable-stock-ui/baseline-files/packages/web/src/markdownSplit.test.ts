// @vitest-environment jsdom
import { expect, it } from "vitest";
import { splitMarkdown } from "./markdown";

it("lifts fenced code out and keeps tables and reference links in the html runs", () => {
  const text = "Intro [a][1]\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```ts\nconst x = 1;\n```\n\nAfter <script>x</script>\n\n[1]: https://example.test/";
  const segments = splitMarkdown(text, false);
  expect(segments.map((s) => s.kind)).toEqual(["html", "code", "html"]);
  const [first, code, last] = segments;
  expect(first.kind === "html" && first.html).toContain("<table>");
  expect(first.kind === "html" && first.html).toContain('href="https://example.test/"');
  expect(code).toEqual({ kind: "code", lang: "ts", text: "const x = 1;" });
  expect(last.kind === "html" && last.html).not.toContain("<script>");
});

it("closes an open fence while streaming", () => {
  expect(splitMarkdown("```perch-ui\n{\"type\"", true).at(-1)).toMatchObject({ kind: "code", lang: "perch-ui" });
});
