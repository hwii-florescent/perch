import { describe, it, expect } from "vitest";
import { repairMarkdown } from "./markdownRepair";

// These cases mirror the ones documented by hand in markdownRepair.ts's
// module doc comment, written when this repo had no test runner at all
// ("test cases are documented here instead of in a `.test.ts` file"). Now
// that Vitest exists, they get to be real, executable assertions.
describe("repairMarkdown", () => {
  it("is a no-op when nothing is open", () => {
    expect(repairMarkdown("hello")).toBe("hello");
  });

  it("returns empty/falsy input unchanged", () => {
    expect(repairMarkdown("")).toBe("");
  });

  it("closes an open triple-backtick fence", () => {
    expect(repairMarkdown("```js\nconst x = 1;")).toBe("```js\nconst x = 1;\n```");
  });

  it("leaves an already-closed fence untouched", () => {
    const text = "```js\nconst x = 1;\n```\nmore text";
    expect(repairMarkdown(text)).toBe(text);
  });

  it("closes a dangling inline-code span", () => {
    expect(repairMarkdown("some `inline code")).toBe("some `inline code`");
  });

  it("closes dangling ** bold", () => {
    expect(repairMarkdown("**bold text")).toBe("**bold text**");
  });

  it("closes only the dangling __ pair, leaving a completed pair alone", () => {
    expect(repairMarkdown("__bold__ and __more")).toBe("__bold__ and __more__");
  });

  it("leaves backticks inside an open fence alone (they're literal code, not inline-code markers)", () => {
    const text = "```js\nlet x = `template ${1}`;";
    expect(repairMarkdown(text)).toBe("```js\nlet x = `template ${1}`;\n```");
  });

  it("closes only the trailing dangling ** pair, leaving a completed pair before it alone", () => {
    expect(repairMarkdown("a ** b ** c **d")).toBe("a ** b ** c **d**");
  });

  it("does not touch single * or _ (list bullets / identifiers, ambiguous as emphasis)", () => {
    expect(repairMarkdown("* item one\n* item two")).toBe("* item one\n* item two");
    expect(repairMarkdown("some_var and another_var")).toBe("some_var and another_var");
  });

  it("closes multiple independent constructs in the same string", () => {
    expect(repairMarkdown("**bold and `code")).toBe("**bold and `code`**");
  });
});
