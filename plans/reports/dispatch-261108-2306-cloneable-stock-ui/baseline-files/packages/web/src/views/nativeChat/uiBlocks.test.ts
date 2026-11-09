import { expect, it } from "vitest";
import { parseUi } from "./uiBlocks";

it("reads one block or an array, with defaults", () => {
  expect(parseUi('{"type":"callout","text":"hi"}')).toEqual([{ type: "callout", tone: "info", text: "hi" }]);
  const blocks = parseUi('[{"type":"table","columns":["a"],"rows":[[1],["x"]]},{"type":"steps","items":[{"text":"t","state":"bogus"}]}]');
  expect(blocks).toEqual([
    { type: "table", columns: ["a"], rows: [["1"], ["x"]] },
    { type: "steps", items: [{ text: "t", state: "todo" }] },
  ]);
});

it("refuses what it cannot draw, so the message shows the code", () => {
  expect(parseUi('{"type":"callout"')).toBeNull(); // still streaming
  expect(parseUi('{"type":"iframe","src":"x"}')).toBeNull();
  expect(parseUi('{"type":"table","columns":["a"],"rows":["x"]}')).toBeNull();
  expect(parseUi("[]")).toBeNull();
});
