// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { modData } from "./modData";

/** What the page sent to `mods/data`, and a core stand-in answering by op (the core's own rules are Rust-tested). */
function core(answer: (body: Record<string, unknown>) => { status?: number; json: unknown }) {
  const sent: Record<string, unknown>[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    expect(url).toMatch(/\/mods\/data$/);
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    sent.push(body);
    const { status = 200, json } = answer(body);
    return new Response(JSON.stringify(json), { status });
  }));
  return sent;
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("modData", () => {
  it("binds every call to its mod id and passes expected only when given", async () => {
    const sent = core((body) => ({ json: body.op === "write" ? { revision: "r2" } : body.op === "read" ? { exists: false } : { deleted: true } }));
    const data = modData("notes");
    expect(await data.read("a")).toBeNull();
    expect(await data.write("a", { n: 1 })).toBe("r2");
    await data.write("a", 2, { expected: null });
    await data.remove("a", { expected: "r2" });
    expect(sent).toEqual([
      { id: "notes", op: "read", key: "a" },
      { id: "notes", op: "write", key: "a", value: { n: 1 } },
      { id: "notes", op: "write", key: "a", value: 2, expected: null },
      { id: "notes", op: "delete", key: "a", expected: "r2" },
    ]);
    await expect(data.write("a", undefined)).rejects.toThrow(/JSON value/);
  });

  it("turns a stale write into a conflict with the current revision, and a corrupt file into a corrupt error", async () => {
    core((body) => body.op === "write"
      ? { status: 409, json: { error: "the value changed since it was read", revision: "now" } }
      : { json: { exists: true, corrupt: true, revision: "bad", error: "a is not valid JSON" } });
    const data = modData("notes");
    await expect(data.write("a", 1, { expected: "old" })).rejects.toMatchObject({ code: "conflict", revision: "now" });
    await expect(data.read("a")).rejects.toMatchObject({ code: "corrupt", revision: "bad" });
  });

  it("a watcher hears this page's write at once and stops when asked", async () => {
    let revision = "r1";
    core((body) => body.op === "list" ? { json: { keys: [{ key: "a", revision, size: 1 }] } } : (revision = "r2", { json: { revision } }));
    const data = modData("notes");
    const heard: string[] = [];
    const stop = data.watch((entries) => heard.push(entries[0]!.revision), 60_000);
    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1));
    await data.write("a", 2);
    await vi.waitFor(() => expect(heard).toEqual(["r2"]));
    stop();
    revision = "r3";
    await modData("notes").write("a", 3);
    await new Promise((done) => setTimeout(done, 20));
    expect(heard).toEqual(["r2"]);
  });

  it("an unreachable core is an error that says nothing changed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(modData("notes").list()).rejects.toThrow(/unchanged/);
  });
});
