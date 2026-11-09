import { expect, it } from "vitest";
import { contextLabel } from "./ContextRing";

it("reads tokens as a percentage, marks a guessed window, and does not clamp an over-full one", () => {
  expect(contextLabel({ usedTokens: 42_000, windowTokens: 272_000 })).toBe("42k of 272k tokens in context (15%)");
  expect(contextLabel({ usedTokens: 1_010, windowTokens: 200_000, estimated: true })).toBe("1k of about 200k tokens in context (1%)");
  expect(contextLabel({ usedTokens: 1_100_000, windowTokens: 1_000_000 })).toBe("1.1M of 1M tokens in context (110%)");
});
