// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { usePerchStore } from "./store";
import { socket } from "./ws";
import { inboundMenuItems } from "./inbound";

const send = vi.spyOn(socket, "send").mockImplementation(() => {});
beforeEach(() => {
  send.mockClear();
  usePerchStore.setState({ serverInfo: { capabilities: ["inbound.v1"] } as never });
});

it("offers the three choices for an agent session on this computer, the current one marked", () => {
  const items = inboundMenuItems({ id: "s1", hostId: "local", cliProviderId: "claude", inboundMode: "hold" });
  expect(items.map((item) => item.label)).toEqual([
    "Accept messages from other sessions",
    "✓ Hold messages for my approval",
    "Refuse messages from other sessions",
  ]);
  expect(items.map((item) => item.testId)).toEqual(["session-inbound-accept-s1", "session-inbound-hold-s1", "session-inbound-refuse-s1"]);
});

it("marks Accept when the session has no mode, and sets a mode without an input lease", () => {
  const items = inboundMenuItems({ id: "s1", cliProviderId: "codex" });
  expect(items[0].label.startsWith("✓ ")).toBe(true);
  items[2].onSelect();
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: "inbound.act", sessionId: "s1", action: "set_mode", mode: "refuse" }));
  expect(send.mock.calls[0][0]).not.toHaveProperty("generation");
  // Choosing what is already set sends nothing.
  send.mockClear();
  items[0].onSelect();
  expect(send).not.toHaveBeenCalled();
});

it("offers nothing for a terminal, a remote session or an older core", () => {
  expect(inboundMenuItems({ id: "s1", hostId: "local" })).toEqual([]);
  expect(inboundMenuItems({ id: "s1", hostId: "other", cliProviderId: "claude" })).toEqual([]);
  usePerchStore.setState({ serverInfo: { capabilities: [] } as never });
  expect(inboundMenuItems({ id: "s1", hostId: "local", cliProviderId: "claude" })).toEqual([]);
});
