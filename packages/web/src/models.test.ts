import { describe, it, expect } from "vitest";
import { defaultModel } from "./models";
import type { ModelEntry } from "@perch/shared";

function model(id: string, isDefault = false): ModelEntry {
  return { id, label: id, isDefault } as ModelEntry;
}

describe("defaultModel", () => {
  it("returns the entry flagged isDefault even when it isn't first", () => {
    const list = [model("a"), model("b", true), model("c")];
    expect(defaultModel("claude", list)).toBe("b");
  });

  it("falls back to the first entry when nothing is flagged isDefault", () => {
    const list = [model("a"), model("b"), model("c")];
    expect(defaultModel("claude", list)).toBe("a");
  });

  it("returns an empty string for an empty list", () => {
    expect(defaultModel("claude", [])).toBe("");
  });

  it("returns the only entry's id for a single-item list with no isDefault flag", () => {
    expect(defaultModel("codex", [model("solo")])).toBe("solo");
  });
});
