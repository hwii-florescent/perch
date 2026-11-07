// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CrewRow } from "@perch/shared";
import { FamilyStrip, ago, headline, receiptNote, stateOf } from "./FamilyStrip";
import { familySignature } from "../../crew";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const row = (extra: Partial<CrewRow>): CrewRow => ({ sessionId: "s", role: "worker", title: "child", provider: "codex", lifecycle: "idle", canMessage: true, ...extra });
const NOW = 10_000_000;

it("words a row from Perch's records: a stopped record outranks the lifecycle, a pending question outranks Working, unknown is never idle", () => {
  expect(stateOf(row({ lifecycle: "working" }))).toEqual({ word: "Working", tone: "working" });
  expect(stateOf(row({ lifecycle: "working", needsYou: { preview: "Run it?", at: 1 } }))).toEqual({ word: "Waiting on you", tone: "needs" });
  expect(stateOf(row({ lifecycle: "working", dispatch: "stopped" }))).toEqual({ word: "Stopped", tone: "quiet" });
  expect(stateOf(row({ lifecycle: "idle", dispatch: "stop_unknown" })).tone).toBe("alert");
  expect(stateOf(row({ lifecycle: "unknown" })).word).toBe("State unknown");
  expect(stateOf(row({ lifecycle: "done" })).word).toBe("Finished its turn");
});

it("counts working, waiting on you and reported, and counts a fallback last message as no report", () => {
  const rows = [
    row({ sessionId: "a", lifecycle: "working" }),
    row({ sessionId: "b", lifecycle: "blocked", needsYou: { preview: "ok?", at: 1 } }),
    row({ sessionId: "c", lifecycle: "idle", report: { text: "done", source: "report", at: 1 } }),
    row({ sessionId: "d", lifecycle: "idle", report: { text: "I did x", source: "last-message", at: 1 } }),
    row({ sessionId: "lead", role: "manager", lifecycle: "working" }),
  ];
  expect(headline(rows)).toBe("1 working · 1 waiting on you · 1 reported");
  expect(headline([row({ lifecycle: "idle" })])).toBe("1 in this run");
});

it("says what became of a message in words and nothing for a delivered one", () => {
  const latest = (receipt: string, reason = "") => ({ direction: "to", preview: "x", at: 1, receipt, reason });
  expect(receiptNote(latest("delivered"))).toBe("");
  expect(receiptNote(latest("queued", "another view holds input control"))).toBe("queued, waiting: another view holds input control");
  expect(receiptNote(latest("unconfirmed"))).toBe("handed over, not confirmed");
  expect(receiptNote(latest("undelivered", "cancelled by its sender"))).toBe("not delivered: cancelled by its sender");
  expect(ago(NOW - 30_000, NOW)).toBe("now");
  expect(ago(NOW - 5 * 60_000, NOW)).toBe("5m ago");
  expect(ago(NOW - 3 * 3_600_000, NOW)).toBe("3h ago");
});

it("shows a lead with a working child, one waiting on a person and one that reported, each as its own lines", () => {
  const open = vi.fn();
  act(() => root.render(<FamilyStrip now={NOW} onOpen={open} rows={[
    row({ sessionId: "w", task: "write the parser", lifecycle: "working", dispatch: "running" }),
    row({ sessionId: "n", task: "run the migration", lifecycle: "blocked", dispatch: "running", needsYou: { preview: "Run this command?", at: NOW } }),
    row({ sessionId: "r", task: "review the diff", lifecycle: "idle", dispatch: "running",
      report: { text: "two issues found", source: "report", at: NOW },
      latest: { direction: "to", preview: "check the tests", at: NOW - 120_000, receipt: "queued", reason: "the receiver is working" } }),
  ]} />));
  const strip = host.querySelector('[data-testid="native-cli-family"]')!;
  expect(strip.querySelector('[data-testid="native-cli-family-headline"]')!.textContent).toBe("1 working · 1 waiting on you · 1 reported");
  const rows = Array.from(strip.querySelectorAll('[data-testid="native-cli-family-row"]'));
  expect(rows.map((entry) => [entry.getAttribute("data-session"), entry.querySelector('[data-testid="native-cli-family-state"]')!.textContent])).toEqual([
    ["w", "Working"], ["n", "Waiting on you"], ["r", "Idle"],
  ]);
  expect(rows[1]!.querySelector('[data-testid="native-cli-family-asks"]')!.textContent).toBe("Waiting for you · Run this command?");
  const reported = rows[2]!;
  expect(reported.querySelector('[data-testid="native-cli-family-report"]')!.textContent).toBe("Reported: two issues found");
  expect(reported.querySelector('[data-testid="native-cli-family-latest"]')!.textContent).toBe("You wrote · check the tests (queued, waiting: the receiver is working) · 2m ago");
  // Opening a child goes to its own chat; the details name the report a claim.
  act(() => (reported.querySelector('[data-testid="native-cli-family-open"]') as HTMLButtonElement).click());
  expect(open).toHaveBeenCalledWith("r");
  act(() => (reported.querySelector("button") as HTMLButtonElement).click());
  expect(reported.querySelector('[data-testid="native-cli-family-details"]')!.textContent).toContain("its own claim, not verified");
});

it("labels a fallback last message as not a report and draws nothing for an empty family", () => {
  act(() => root.render(<FamilyStrip now={NOW} onOpen={() => {}} rows={[row({ report: { text: "I changed x", source: "last-message", at: NOW } })]} />));
  expect(host.querySelector('[data-testid="native-cli-family-report"]')!.textContent).toBe("Last message, not a report: I changed x");
  act(() => root.render(<FamilyStrip rows={[]} onOpen={() => {}} />));
  expect(host.querySelector('[data-testid="native-cli-family"]')).toBeNull();
});

it("watches only the sessions that can change a family: the lead and its children", () => {
  const session = (id: string, extra: Record<string, unknown> = {}) => ({ id, status: "idle", title: id, ...extra });
  const sessions = [session("lead"), session("c1", { parentSessionId: "lead" }), session("elsewhere")];
  const before = familySignature(sessions, "lead");
  expect(familySignature(sessions, "c1")).toBe(before);
  expect(familySignature([...sessions.slice(0, 2), session("elsewhere", { blocked: true })], "lead")).toBe(before);
  expect(familySignature([session("lead"), session("c1", { parentSessionId: "lead", blocked: true }), session("elsewhere")], "lead")).not.toBe(before);
});
