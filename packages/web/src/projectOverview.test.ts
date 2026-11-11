// @vitest-environment jsdom
import { expect, it } from "vitest";
import { overviewSignature } from "./projectOverview";

const session = (extra: Record<string, unknown>) => ({ id: "s", projectId: "p", status: "idle", title: "t", ...extra });

it("changes when a thread of the Project changes state and ignores other Projects", () => {
  const base = overviewSignature([session({ id: "a" }), session({ id: "x", projectId: "other" })], "p");
  expect(overviewSignature([session({ id: "a" }), session({ id: "x", projectId: "other", status: "working" })], "p")).toBe(base);
  expect(overviewSignature([session({ id: "a", status: "working" })], "p")).not.toBe(base);
  expect(overviewSignature([session({ id: "a", blocked: true })], "p")).not.toBe(base);
});
