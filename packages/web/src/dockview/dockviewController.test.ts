import { describe, it, expect } from "vitest";
import { panelKind, sessionChatPanelSessionId } from "./dockviewController";

/** Minimal fake satisfying the `Pick<IDockviewPanel, "view" | "params">`
 * shape these pure helpers actually read — no live dockview instance
 * required. */
function fakePanel(contentComponent: string, params?: Record<string, unknown>) {
  return { view: { contentComponent }, params } as unknown as Parameters<typeof panelKind>[0] &
    Parameters<typeof sessionChatPanelSessionId>[0];
}

describe("panelKind", () => {
  it("classifies the primary chat panel by its component, not its id", () => {
    expect(panelKind(fakePanel("chat"))).toBe("chat");
  });

  it("classifies terminal panels", () => {
    expect(panelKind(fakePanel("terminal"))).toBe("terminal");
  });

  it("classifies session-bound chat panels distinctly from the primary chat and from terminals", () => {
    expect(panelKind(fakePanel("sessionChat", { sessionId: "abc" }))).toBe("sessionChat");
  });

  it("falls back to 'other' for an unrecognized component (forward-compat, never silently 'terminal')", () => {
    expect(panelKind(fakePanel("something-new"))).toBe("other");
  });

  // The specific regression this exists to catch: before the fix, terminal
  // detection was "any panel whose id isn't the literal string 'chat'" — a
  // session-chat panel (id "session-chat-<sessionId>", definitely not
  // "chat") would have been misclassified as a terminal and swept up by
  // "close all terminals" / counted by the terminal toggle.
  it("never classifies a sessionChat panel as a terminal, regardless of its id", () => {
    const panel = fakePanel("sessionChat", { sessionId: "xyz" });
    expect(panelKind(panel)).not.toBe("terminal");
  });
});

describe("sessionChatPanelSessionId", () => {
  it("reads the bound session id off a sessionChat panel's params", () => {
    expect(sessionChatPanelSessionId(fakePanel("sessionChat", { sessionId: "abc-123" }))).toBe("abc-123");
  });

  it("returns undefined for a non-sessionChat panel even if it happens to carry a sessionId param", () => {
    expect(sessionChatPanelSessionId(fakePanel("terminal", { sessionId: "abc-123" }))).toBeUndefined();
    expect(sessionChatPanelSessionId(fakePanel("chat", { sessionId: "abc-123" }))).toBeUndefined();
  });

  it("returns undefined for malformed/missing params (e.g. hand-edited persisted layout JSON)", () => {
    expect(sessionChatPanelSessionId(fakePanel("sessionChat"))).toBeUndefined();
    expect(sessionChatPanelSessionId(fakePanel("sessionChat", { sessionId: 42 }))).toBeUndefined();
    expect(sessionChatPanelSessionId(fakePanel("sessionChat", { sessionId: "" }))).toBeUndefined();
  });
});
