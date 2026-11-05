import { describe, expect, it } from "vitest";
import { sendState, type SendStateInput } from "./sendState";

const ready: SendStateInput = { draft: "", attachments: 0, uploading: false, connected: true, ready: true, controlling: true, exited: false, working: false, sending: false, stopping: false };
const state = (patch: Partial<SendStateInput>) => sendState({ ...ready, ...patch });

describe("sendState", () => {
  it("sends a typed draft and disables an empty one", () => {
    expect(state({ draft: "hi" })).toMatchObject({ action: "send", label: "Send", disabled: false, reason: null });
    expect(state({ draft: "  \n" })).toMatchObject({ action: "send", disabled: true });
  });
  it("offers Stop in Send's place while working with an empty draft, and queues a typed one", () => {
    expect(state({ working: true })).toMatchObject({ action: "stop", label: "Cancel turn", disabled: false });
    expect(state({ working: true, draft: "next" })).toMatchObject({ action: "queue", label: "Queue message", disabled: false });
  });
  it("sends attachments without text, but not while one is uploading", () => {
    expect(state({ attachments: 1 })).toMatchObject({ action: "send", disabled: false });
    expect(state({ attachments: 1, working: true })).toMatchObject({ action: "queue", disabled: false });
    expect(state({ draft: "hi", attachments: 1, uploading: true })).toMatchObject({ disabled: true, reason: "Uploading attachment…" });
  });
  it("shows in-flight sends and stops as disabled", () => {
    expect(state({ draft: "hi", sending: true })).toMatchObject({ action: "sending", label: "Sending…", disabled: true, reason: null });
    expect(state({ working: true, stopping: true })).toMatchObject({ action: "stopping", label: "Stopping…", disabled: true });
  });
  it("names what the user can do when it cannot send", () => {
    expect(state({ draft: "hi", controlling: false })).toMatchObject({ disabled: true, reason: "Take control to send" });
    expect(state({ draft: "hi", connected: false }).reason).toBe("Reconnecting…");
    expect(state({ draft: "hi", exited: true }).reason).toBe("The CLI exited");
    expect(state({ draft: "hi", ready: false }).reason).toBe("Connecting to CLI…");
    expect(state({ working: true, controlling: false })).toMatchObject({ action: "stop", disabled: true });
  });
});
