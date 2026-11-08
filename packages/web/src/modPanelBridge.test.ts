import { describe, expect, it, vi } from "vitest";
import { answerPanel, MAX_PANEL_READ } from "./modPanelBridge";

const read = vi.fn(async (_ws: string, path: string) => `body of ${path}`);

describe("mod panel bridge", () => {
  it("ignores anything that is not a read-file request", async () => {
    for (const data of [null, "read-file", { perch: "write-file", id: 1 }, { id: 1, path: "a" }]) {
      expect(await answerPanel(data, true, "w1", read)).toBeNull();
    }
    expect(read).not.toHaveBeenCalled();
  });

  it("reads only for a mod approved for read-project, in an open project", async () => {
    expect(await answerPanel({ perch: "read-file", id: 7, path: "a.md" }, false, "w1", read)).toMatchObject({ id: 7, ok: false });
    expect(await answerPanel({ perch: "read-file", id: 7, path: "a.md" }, true, null, read)).toMatchObject({ ok: false });
    expect(read).not.toHaveBeenCalled();
    expect(await answerPanel({ perch: "read-file", id: 7, path: "a.md" }, true, "w1", read)).toEqual({ perch: "reply", id: 7, ok: true, text: "body of a.md" });
  });

  it("refuses a missing or oversized path and reports a failed read", async () => {
    for (const path of [undefined, "", 5, "x".repeat(1025)]) {
      expect(await answerPanel({ perch: "read-file", id: 1, path }, true, "w1", read)).toMatchObject({ ok: false });
    }
    const failing = vi.fn(async () => { throw new Error("Cannot read that file."); });
    expect(await answerPanel({ perch: "read-file", id: 2, path: "../x" }, true, "w1", failing)).toEqual({ perch: "reply", id: 2, ok: false, error: "Cannot read that file." });
    expect(MAX_PANEL_READ).toBeGreaterThan(0);
  });
});
