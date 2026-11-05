// @vitest-environment jsdom
import { expect, it } from "vitest";
import { getAttachmentUploadUrl } from "./base";

it("keeps SCP targets in encoded query fields on the current origin", () => {
  const url = new URL(getAttachmentUploadUrl("a&b", "file #1.pdf", "host&x"));
  expect(url.origin).toBe(window.location.origin);
  expect(url.pathname).toBe("/upload");
  expect(Object.fromEntries(url.searchParams)).toEqual({ sessionId: "a&b", name: "file #1.pdf", hostId: "host&x", scp: "1" });
  expect(new URL(getAttachmentUploadUrl("a", "b")).searchParams.has("scp")).toBe(false);
});
