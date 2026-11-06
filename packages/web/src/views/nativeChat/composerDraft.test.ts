import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadDraftText, saveDraftText, sentPrompts, stepRecall, withTerminalDraft } from "./composerDraft";

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

describe("terminal draft pickup", () => {
  it("seeds an empty composer, appends to a typed one, and never adds the same line twice", () => {
    expect(withTerminalDraft("", "fix the bug")).toBe("fix the bug");
    expect(withTerminalDraft("also", "fix the bug")).toBe("also\nfix the bug");
    expect(withTerminalDraft("also\nfix the bug", "fix the bug")).toBe("also\nfix the bug");
    expect(withTerminalDraft("fix the bug now", "fix the bug")).toBe("fix the bug now\nfix the bug");
  });
});

describe("draft persistence", () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) });
  });
  it("restores a saved draft and forgets it once emptied", () => {
    saveDraftText("k", "half a thought", 1000);
    expect(loadDraftText("k", 2000)).toBe("half a thought");
    saveDraftText("k", "  ", 3000);
    expect(loadDraftText("k", 4000)).toBe("");
  });
  it("drops a draft after a week and keeps only the newest fifty", () => {
    saveDraftText("old", "x", 0);
    expect(loadDraftText("old", 8 * 24 * 3_600_000)).toBe("");
    for (let i = 0; i < 52; i++) saveDraftText(`k${i}`, "x", 10 + i);
    expect(loadDraftText("k0", 100)).toBe("");
    expect(loadDraftText("k51", 100)).toBe("x");
  });
});
