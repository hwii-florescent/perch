import { describe, expect, it } from "vitest";
import { sentPrompts, stepRecall } from "./recall";

const messages = [
  { id: "a", role: "user", text: "one" },
  { id: "b", role: "assistant", text: "reply" },
  { id: "c", role: "user", text: "two " },
  { id: "d", role: "user", text: "two" },
  { id: "e", role: "user", text: "  " },
];

describe("prompt recall", () => {
  const prompts = sentPrompts(messages);
  it("lists user prompts oldest first, trimmed, without blanks or back-to-back repeats", () => {
    expect(prompts).toEqual([{ id: "a", prompt: "one" }, { id: "d", prompt: "two" }]);
  });
  it("starts Back from an empty draft only, newest first, and stops at the oldest", () => {
    expect(stepRecall({ direction: "back", prompts, position: null, draft: "typed" })).toBeNull();
    const first = stepRecall({ direction: "back", prompts, position: null, draft: "" })!;
    expect(first.draft).toBe("two");
    const second = stepRecall({ direction: "back", prompts, position: first.position, draft: first.draft })!;
    expect(second.draft).toBe("one");
    expect(stepRecall({ direction: "back", prompts, position: second.position, draft: second.draft })).toBeNull();
  });
  it("walks Forward and clears past the newest; an edited draft ends recall", () => {
    const old = { id: "a", recalled: "one" };
    const forward = stepRecall({ direction: "forward", prompts, position: old, draft: "one" })!;
    expect(forward.draft).toBe("two");
    expect(stepRecall({ direction: "forward", prompts, position: forward.position, draft: "two" })).toEqual({ position: null, draft: "" });
    expect(stepRecall({ direction: "forward", prompts, position: old, draft: "one!" })).toBeNull();
  });
  it("finds its place by text when the echo's id was replaced", () => {
    const echoed = { id: "echo", recalled: "one" };
    expect(stepRecall({ direction: "forward", prompts, position: echoed, draft: "one" })!.draft).toBe("two");
  });
});

