// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => [] as unknown[]);
vi.mock("./ws", () => ({ socket: { send: (message: unknown) => sent.push(message), connected: true, onMessage: () => () => {}, onConnectionChange: () => () => {} } }));
vi.mock("./store", () => ({ usePerchStore: { getState: () => ({}), setState: () => {}, subscribe: () => () => {} } }));
// The navigation commands' module syncs with the real store when it loads; these tests never run them.
vi.mock("./workspaceNav", () => ({}));
import { setCommandBridge } from "./modApp";
import { answerCommand } from "./mods";
import { TYPED_COMMANDS } from "./modCommands";

beforeEach(() => { sent.length = 0; });

describe("perch mod do", () => {
  it("runs an app command with its arguments, lists the commands, and says why one did not run", () => {
    const run = vi.fn((command: string) => command !== "nope");
    setCommandBridge({ list: () => [{ id: "session.open", description: "Open a session", args: "{session}" }], run, register: () => () => {}, bind: () => {} });

    answerCommand("r1", "session.open", { session: "s1" });
    expect(run).toHaveBeenCalledWith("session.open", { session: "s1" });
    expect(sent[0]).toMatchObject({ type: "mods.snapshot", requestId: "r1", text: "true", error: null });

    answerCommand("r2", "list");
    expect(JSON.parse((sent[1] as { text: string }).text)).toEqual([{ id: "session.open", description: "Open a session", args: "{session}" }]);

    answerCommand("r3", "nope");
    expect((sent[2] as { error: string }).error).toContain('no command "nope"');

    run.mockImplementationOnce(() => { throw new Error("session s9 is gone"); });
    answerCommand("r4", "session.open", { session: "s9" });
    expect((sent[3] as { error: string }).error).toBe("session s9 is gone");
  });
});

describe("the window's own controls", () => {
  it("are listed for a layout that draws its title bar, and say so in a plain browser", () => {
    expect(Object.keys(TYPED_COMMANDS)).toEqual(expect.arrayContaining(["window.minimize", "window.maximize", "window.close"]));
    expect(() => TYPED_COMMANDS["window.close"]!.run({})).toThrow("desktop app");
  });
});
