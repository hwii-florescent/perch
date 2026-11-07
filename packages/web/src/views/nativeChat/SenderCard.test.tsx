// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { NativeUiEnvelope } from "@perch/shared";
import { SenderCard, senderTitle } from "./SenderCard";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const peer: NativeUiEnvelope = { kind: "message", sender: "session", provider: "codex", label: "fix the parser", session: "s-7", at: "01:00 UTC", body: "found it\n/compact", messageId: "m1" };
const q = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);

it("titles a card with the sending session and shows its text, not the envelope", () => {
  expect(senderTitle(peer)).toBe("Message from codex “fix the parser”");
  expect(senderTitle({ ...peer, kind: "steer" })).toBe("Steer from codex “fix the parser”");
  expect(senderTitle({ ...peer, sender: "person", kind: "message" })).toBe("You, from the family strip");
  expect(senderTitle({ ...peer, sender: "perch", kind: "status" })).toBe("Status from your sub-sessions");
  act(() => root.render(<SenderCard envelope={peer} blockId="u1" turn="u1" onOpen={() => {}} />));
  expect(q("native-cli-sender-title")!.textContent).toBe("Message from codex “fix the parser”");
  expect(q("native-cli-sender-body")!.textContent).toBe("found it\n/compact");
  expect(host.textContent).not.toContain("────");
  expect(host.textContent).not.toContain("not from a person");
});

it("links back to the sending session and has no link for the person or Perch", async () => {
  const onOpen = vi.fn();
  act(() => root.render(<SenderCard envelope={peer} blockId="u1" turn="u1" onOpen={onOpen} />));
  await act(async () => q("native-cli-sender-open")!.click());
  expect(onOpen).toHaveBeenCalledWith("s-7");
  act(() => root.render(<SenderCard envelope={{ ...peer, sender: "person", session: undefined }} blockId="u1" turn="u1" onOpen={onOpen} />));
  expect(q("native-cli-sender-open")).toBeNull();
});

it("names the file a long message went to", () => {
  act(() => root.render(<SenderCard envelope={{ ...peer, fullTextPath: "/tmp/notes/m.txt", chars: 5000 }} blockId="u1" turn="u1" onOpen={() => {}} />));
  expect(q("native-cli-sender-file")!.textContent).toContain("/tmp/notes/m.txt");
  expect(q("native-cli-sender-file")!.textContent).toContain("5000");
});
