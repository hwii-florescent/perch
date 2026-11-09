import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadDraftText, saveDraftText, withTerminalDraft } from "./composerDraft";


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
