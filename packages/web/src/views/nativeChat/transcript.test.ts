import { describe, expect, it } from "vitest";
import type { NativeUiMessage } from "@perch/shared";
import { findBlocks, summarizeRun, toBlocks } from "./transcript";

const message = (id: string, role: string, extra: Partial<NativeUiMessage> = {}): NativeUiMessage => ({ id, role, text: "", thinking: "", tools: [], ...extra });

describe("findBlocks", () => {
  it("matches messages and the contents of collapsed runs, ignoring case", () => {
    const blocks = toBlocks([
      message("u", "user", { text: "Fix the Parser" }),
      message("a1", "assistant", { tools: [{ name: "bash", input: "grep parser src" }] }),
      message("a2", "assistant", { text: "done" }),
    ]);
    expect(findBlocks(blocks, "PARSER")).toEqual(["u", "a1:tool:0"]);
    expect(findBlocks(blocks, "  ")).toEqual([]);
    expect(findBlocks(blocks, "nothing")).toEqual([]);
  });
});

describe("toBlocks", () => {
  it("folds a turn's tool calls and results into one run between the prompt and the answer", () => {
    const blocks = toBlocks([
      message("u", "user", { text: "fix it" }),
      message("a1", "assistant", { thinking: "hm", tools: [{ name: "read", input: "{}" }] }),
      message("r1", "toolResult", { toolName: "read", text: "file" }),
      message("a2", "assistant", { tools: [{ name: "bash", input: "ls" }, { name: "read", input: "{}" }] }),
      message("r2", "toolResult", { toolName: "bash", text: "out" }),
      message("a3", "assistant", { text: "done" }),
    ]);
    expect(blocks.map((block) => block.kind)).toEqual(["message", "run", "message"]);
    const run = blocks[1]!;
    expect(run.kind === "run" && run.steps.map((step) => step.kind)).toEqual(["thinking", "tool", "result", "tool", "tool", "result"]);
    expect(blocks[2]!.kind === "message" && blocks[2]!.message.text).toBe("done");
  });

  it("keeps text the agent wrote mid-turn visible and starts a new run after it", () => {
    const blocks = toBlocks([
      message("a1", "assistant", { text: "Checking.", tools: [{ name: "read", input: "{}" }] }),
      message("a2", "assistant", { text: "Now editing.", tools: [{ name: "edit", input: "{}" }] }),
    ]);
    expect(blocks.map((block) => block.kind)).toEqual(["message", "run", "message", "run"]);
    // The visible text carries no tool or thinking payload of its own.
    const first = blocks[0]!;
    expect(first.kind === "message" && first.message.tools).toEqual([]);
  });

  it("never drops an assistant error", () => {
    const blocks = toBlocks([message("a", "assistant", { error: "boom" })]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.kind === "message" && blocks[0]!.message.error).toBe("boom");
  });
});

describe("summarizeRun", () => {
  it("names distinct tools, capped at three", () => {
    const step = (label: string) => ({ id: label, kind: "tool" as const, label, body: "" });
    expect(summarizeRun([step("read"), step("read"), step("bash")])).toBe("3 tool calls: read, bash");
    expect(summarizeRun([step("a"), step("b"), step("c"), step("d")])).toBe("4 tool calls: a, b, c +1");
    expect(summarizeRun([step("read")])).toBe("1 tool call: read");
    expect(summarizeRun([{ id: "t", kind: "thinking", label: "Thinking", body: "" }])).toBe("Thinking");
  });
});
