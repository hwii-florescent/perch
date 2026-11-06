// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { couldBeFile, linkTargets } from "./fileLinks";
import { renderMarkdown } from "../../markdown";

describe("linkTargets", () => {
  it("collects the targets that could name a file, once each, as written", () => {
    const html = renderMarkdown("[a](src/a.rs:3) [again](src/a.rs:3) [b](/abs/b.md#L9) [web](https://example.com) [mail](mailto:x@y.z) [top](#top) [c](../c.txt)", false);
    expect(linkTargets(html)).toEqual(["src/a.rs:3", "/abs/b.md#L9", "../c.txt"]);
  });

  it("finds nothing in text without links", () => {
    expect(linkTargets(renderMarkdown("plain `src/a.rs` text", false))).toEqual([]);
  });

  it("treats web, mail and in-page targets as not files", () => {
    for (const href of ["https://x.dev", "HTTP://x.dev", "mailto:a@b.c", "#section", ""]) expect(couldBeFile(href)).toBe(false);
    for (const href of ["a.rs", "./a.rs", "/a.rs", "a.rs:3:4", "file:///a.rs"]) expect(couldBeFile(href)).toBe(true);
  });
});
