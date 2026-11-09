// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CrewRow } from "@perch/shared";
import { FamilyStrip, actionReceipt, ago, headline, receiptNote, stateOf, type OnAct } from "./FamilyStrip";
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
  expect(receiptNote({ ...latest("delivered"), handoff: "queued_in_agent" })).toBe("queued in the agent, for after its running turn");
  expect(receiptNote({ ...latest("delivered"), handoff: "steered" })).toBe("steered into its running turn");
  expect(receiptNote(latest("queued", "another view holds input control"))).toBe("queued, waiting: another view holds input control");
  expect(receiptNote(latest("unconfirmed"))).toBe("handed over, not confirmed");
  expect(receiptNote(latest("held", "held: x"))).toBe("held: waiting for its person to approve it");
  expect(receiptNote(latest("undelivered", "refused: that session does not accept messages from other sessions"))).toBe("not delivered: refused: that session does not accept messages from other sessions");
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

it("names the model that wrote a summary and counts it with the reports", () => {
  const summary = row({ lifecycle: "idle", report: { text: "Fixed the parser; tests pass.", source: "summary", model: "claude-haiku-4-5", at: NOW } });
  act(() => root.render(<FamilyStrip now={NOW} onOpen={() => {}} rows={[summary]} />));
  expect(host.querySelector('[data-testid="native-cli-family-report"]')!.textContent).toBe("Summary by claude-haiku-4-5: Fixed the parser; tests pass.");
  expect(host.querySelector('[data-testid="native-cli-family-headline"]')!.textContent).toBe("1 reported");
  act(() => (host.querySelector("li button") as HTMLButtonElement).click());
  expect(host.querySelector('[data-testid="native-cli-family-details"]')!.textContent).toContain("written from what it did, not verified");
  const unnamed = row({ lifecycle: "idle", report: { text: "x", source: "summary", at: NOW } });
  act(() => root.render(<FamilyStrip now={NOW} onOpen={() => {}} rows={[unnamed]} />));
  expect(host.querySelector('[data-testid="native-cli-family-report"]')!.textContent).toBe("Summary by a model: x");
});

it("labels a fallback last message as not a report and draws nothing for an empty family", () => {
  act(() => root.render(<FamilyStrip now={NOW} onOpen={() => {}} rows={[row({ report: { text: "I changed x", source: "last-message", at: NOW } })]} />));
  expect(host.querySelector('[data-testid="native-cli-family-report"]')!.textContent).toBe("Last message, not a report: I changed x");
  act(() => root.render(<FamilyStrip rows={[]} onOpen={() => {}} />));
  expect(host.querySelector('[data-testid="native-cli-family"]')).toBeNull();
});

const offered = (extra: Record<string, { ok: boolean; reason?: string }> = {}) => ({
  message: { ok: true }, steer: { ok: true }, interrupt: { ok: true }, stop: { ok: true }, ...extra,
});
const click = (element: Element | null) => act(() => (element as HTMLElement).click());
const typeInto = (area: HTMLTextAreaElement, value: string) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(area, value);
  area.dispatchEvent(new Event("input", { bubbles: true }));
});

it("words a receipt as the core said it: an unconfirmed steer is never called done or failed", () => {
  expect(actionReceipt("steer", "confirmed")).toBe("Steer confirmed");
  expect(actionReceipt("interrupt", "sent")).toBe("Interrupt sent, waiting for its answer…");
  expect(actionReceipt("steer", "not_confirmed", "it did not answer in time")).toBe("Steer sent, not confirmed: it did not answer in time. It may have taken effect; Perch does not retry it");
  expect(actionReceipt("stop", "confirmed")).toBe("Stopped");
  expect(actionReceipt("stop", "not_confirmed", "Perch could not confirm")).toBe("Stop not confirmed: Perch could not confirm");
  expect(actionReceipt("message", "queued")).toBe("Message queued; it is delivered when the child is idle");
  expect(actionReceipt("interrupt", "refused", "no turn is running in it")).toBe("Interrupt refused: no turn is running in it");
});

it("offers Message and a menu whose unavailable actions are disabled with the core's reason", () => {
  const onAct: OnAct = vi.fn();
  act(() => root.render(<FamilyStrip now={NOW} onOpen={() => {}} onAct={onAct} rows={[
    row({ task: "fix", lifecycle: "idle", dispatch: "running", actions: offered({ steer: { ok: false, reason: "no turn is running in it; use Message" }, interrupt: { ok: false, reason: "no turn is running in it" } }) }),
    row({ sessionId: "lead", role: "manager", lifecycle: "working" }),
  ]} />));
  // Only a worker row has actions; the lead row has none.
  expect(host.querySelectorAll('[data-testid="native-cli-family-actions"]')).toHaveLength(1);
  expect((host.querySelector('[data-testid="native-cli-family-message"]') as HTMLButtonElement).disabled).toBe(false);
  click(host.querySelector('[data-testid="native-cli-family-more"]'));
  const steer = host.querySelector('[data-testid="native-cli-family-steer"]') as HTMLButtonElement;
  expect(steer.disabled).toBe(true);
  expect(host.querySelector('[data-testid="native-cli-family-steer-reason"]')!.textContent).toBe("no turn is running in it; use Message");
  expect((host.querySelector('[data-testid="native-cli-family-interrupt"]') as HTMLButtonElement).disabled).toBe(true);
  expect((host.querySelector('[data-testid="native-cli-family-stop"]') as HTMLButtonElement).disabled).toBe(false);
  click(steer);
  expect(onAct).not.toHaveBeenCalled();
});

it("asks for fresh rows as the action menu opens and while it stays open, and not otherwise", () => {
  vi.useFakeTimers();
  try {
    const onRefresh = vi.fn();
    act(() => root.render(<FamilyStrip now={NOW} onOpen={() => {}} onAct={vi.fn()} onRefresh={onRefresh} rows={[row({ actions: offered() })]} />));
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(onRefresh).not.toHaveBeenCalled();
    click(host.querySelector('[data-testid="native-cli-family-more"]'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(4_000); });
    expect(onRefresh).toHaveBeenCalledTimes(3);
    click(host.querySelector('[data-testid="native-cli-family-more"]'));
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(onRefresh).toHaveBeenCalledTimes(3);
  } finally { vi.useRealTimers(); }
});

it("without the chat's input control every action is disabled with that reason, and a core that cannot act shows no actions", () => {
  const onAct: OnAct = vi.fn();
  act(() => root.render(<FamilyStrip now={NOW} onOpen={() => {}} onAct={onAct} unavailable="Take control of this chat to act on a sub-session" rows={[row({ actions: offered() })]} />));
  const message = host.querySelector('[data-testid="native-cli-family-message"]') as HTMLButtonElement;
  expect(message.disabled).toBe(true);
  expect(message.title).toBe("Take control of this chat to act on a sub-session");
  click(host.querySelector('[data-testid="native-cli-family-more"]'));
  expect((host.querySelector('[data-testid="native-cli-family-interrupt"]') as HTMLButtonElement).disabled).toBe(true);
  act(() => root.render(<FamilyStrip now={NOW} onOpen={() => {}} rows={[row({ actions: offered() })]} />));
  expect(host.querySelector('[data-testid="native-cli-family-actions"]')).toBeNull();
});

it("sends a steer from the row's composer, shows the core's progress and final receipt, and sends it once", async () => {
  let finish: (value: { outcome: string; reason?: string }) => void = () => {};
  const onAct = vi.fn<OnAct>((_child, _action, _text, progress) => { progress({ outcome: "sent" }); return new Promise((resolve) => { finish = resolve; }); });
  act(() => root.render(<FamilyStrip now={NOW} onOpen={() => {}} onAct={onAct} rows={[row({ sessionId: "c1", lifecycle: "working", dispatch: "running", actions: offered() })]} />));
  click(host.querySelector('[data-testid="native-cli-family-more"]'));
  click(host.querySelector('[data-testid="native-cli-family-steer"]'));
  const area = host.querySelector('[data-testid="native-cli-family-compose"] textarea') as HTMLTextAreaElement;
  typeInto(area, "use the other file");
  click(host.querySelector('[data-testid="native-cli-family-send"]'));
  expect(onAct).toHaveBeenCalledTimes(1);
  expect(onAct.mock.calls[0]!.slice(0, 3)).toEqual(["c1", "steer", "use the other file"]);
  expect(host.querySelector('[data-testid="native-cli-family-receipt"]')!.textContent).toBe("Steer sent, waiting for its answer…");
  // While it is awaited a second press does nothing.
  click(host.querySelector('[data-testid="native-cli-family-send"]'));
  expect(onAct).toHaveBeenCalledTimes(1);
  await act(async () => { finish({ outcome: "not_confirmed", reason: "it did not answer in time" }); });
  expect(host.querySelector('[data-testid="native-cli-family-receipt"]')!.textContent).toContain("Steer sent, not confirmed: it did not answer in time");
  expect(host.querySelector('[data-testid="native-cli-family-compose"]')).toBeNull();
});

it("keeps the words when an action is refused, interrupts at once, and stops only after a confirm step", async () => {
  const onAct = vi.fn<OnAct>(async (_child, action) => action === "message" ? { outcome: "refused", reason: "it is not running" } : action === "stop" ? { outcome: "not_confirmed", reason: "Perch could not confirm" } : { outcome: "confirmed" });
  act(() => root.render(<FamilyStrip now={NOW} onOpen={() => {}} onAct={onAct} rows={[row({ sessionId: "c1", lifecycle: "working", dispatch: "running", actions: offered() })]} />));
  click(host.querySelector('[data-testid="native-cli-family-message"]'));
  typeInto(host.querySelector('[data-testid="native-cli-family-compose"] textarea') as HTMLTextAreaElement, "hello");
  await act(async () => click(host.querySelector('[data-testid="native-cli-family-send"]')));
  expect((host.querySelector('[data-testid="native-cli-family-compose"] textarea') as HTMLTextAreaElement).value).toBe("hello");
  expect(host.querySelector('[data-testid="native-cli-family-receipt"]')!.textContent).toBe("Message refused: it is not running");
  click(host.querySelector('[data-testid="native-cli-family-more"]'));
  await act(async () => click(host.querySelector('[data-testid="native-cli-family-interrupt"]')));
  expect(onAct).toHaveBeenLastCalledWith("c1", "interrupt", undefined, expect.any(Function));
  expect(host.querySelector('[data-testid="native-cli-family-receipt"]')!.textContent).toBe("Interrupt confirmed");
  click(host.querySelector('[data-testid="native-cli-family-more"]'));
  click(host.querySelector('[data-testid="native-cli-family-stop"]'));
  expect(onAct).toHaveBeenCalledTimes(2);
  await act(async () => click(host.querySelector('[data-testid="native-cli-family-confirm"]')));
  expect(onAct).toHaveBeenLastCalledWith("c1", "stop", undefined, expect.any(Function));
  expect(host.querySelector('[data-testid="native-cli-family-receipt"]')!.textContent).toBe("Stop not confirmed: Perch could not confirm");
});

it("watches only the sessions that can change a family: the lead and its children", () => {
  const session = (id: string, extra: Record<string, unknown> = {}) => ({ id, status: "idle", title: id, ...extra });
  const sessions = [session("lead"), session("c1", { parentSessionId: "lead" }), session("elsewhere")];
  const before = familySignature(sessions, "lead");
  expect(familySignature(sessions, "c1")).toBe(before);
  expect(familySignature([...sessions.slice(0, 2), session("elsewhere", { blocked: true })], "lead")).toBe(before);
  expect(familySignature([session("lead"), session("c1", { parentSessionId: "lead", blocked: true }), session("elsewhere")], "lead")).not.toBe(before);
});
