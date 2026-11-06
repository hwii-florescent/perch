import { describe, expect, it } from "vitest";
import type { NativeUiSnapshot } from "@perch/shared";
import { blocksOf } from "./transcript";

const snapshot = (extra: Partial<NativeUiSnapshot>): NativeUiSnapshot => ({ version: 1, revision: 1, pid: 1, providerSessionId: "s", cwd: "/", model: null, running: false, messages: [], truncated: false, ...extra });

describe("blocksOf", () => {
  it("draws the core's projection as sent", () => {
    const blocks = [{ kind: "message" as const, id: "u", turn: "u" }];
    expect(blocksOf(snapshot({ transcript: { blocks } }))).toBe(blocks);
  });

  it("shows an older core's messages unfolded, without tool rows", () => {
    const message = (id: string, role: string, text = "") => ({ id, role, text, thinking: "", tools: [] });
    const blocks = blocksOf(snapshot({ messages: [message("u", "user", "hi"), message("a", "assistant"), message("r", "toolResult", "out"), message("b", "assistant", "done")] }));
    expect(blocks.map((block) => block.id)).toEqual(["u", "b"]);
    expect(blocksOf(null)).toEqual([]);
  });
});
