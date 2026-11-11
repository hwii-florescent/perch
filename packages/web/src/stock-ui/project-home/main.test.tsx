// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { OverviewGroup } from "@perch/shared";
import ProjectHome, { stateWord } from "./main";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const row = (extra: Record<string, unknown>) => ({ sessionId: "s", role: "worker", title: "child", provider: "claude", lifecycle: "idle", canMessage: true, ...extra });
const handlers = () => ({ onOpen: vi.fn(), onInstructions: vi.fn(), onMemory: vi.fn() });

it("draws the core's groups in order with each thread's PR, question and open button", () => {
  const groups = [
    { key: "needs_you", label: "Needs you", threads: [{ leadSessionId: "l", row: row({ sessionId: "a", task: "run the migration", lifecycle: "blocked", needsYou: { preview: "Run it?", at: 1 } }) }] },
    { key: "landing", label: "Landing", threads: [{ leadSessionId: "l", row: row({ sessionId: "b", task: "fix the parser", branch: "fix", pr: { number: 7, state: "open", url: "https://github.com/o/r/pull/7" } }) }] },
  ] as unknown as OverviewGroup[];
  const on = handlers();
  act(() => root.render(<ProjectHome projectId="p" name="perch" groups={groups} {...on} />));
  expect([...host.querySelectorAll('[data-testid="project-home-group"]')].map((el) => el.getAttribute("data-group"))).toEqual(["needs_you", "landing"]);
  expect(host.querySelector('[data-testid="project-home-note"]')?.textContent).toBe("Waiting for you · Run it?");
  expect(host.querySelector('[data-testid="project-home-pr"]')?.textContent).toBe("PR #7 · open");
  act(() => { (host.querySelector('[data-session="b"] [data-testid="project-home-open"]') as HTMLButtonElement).click(); });
  expect(on.onOpen).toHaveBeenCalledWith("b");
  act(() => { (host.querySelector('[data-testid="project-home-memory"]') as HTMLButtonElement).click(); });
  expect(on.onMemory).toHaveBeenCalled();
  act(() => { (host.querySelector('[data-testid="project-home-instructions"]') as HTMLButtonElement).click(); });
  expect(on.onInstructions).toHaveBeenCalled();
  expect(host.querySelector('[data-testid="project-home-empty"]')).toBeNull();
});

it("says there are no threads, or why the core refused, instead of drawing nothing", () => {
  act(() => root.render(<ProjectHome projectId="p" name="perch" groups={[]} {...handlers()} />));
  expect(host.querySelector('[data-testid="project-home-empty"]')).not.toBeNull();
  act(() => root.render(<ProjectHome projectId="p" name="perch" groups={[]} error="This Project is not on this computer." {...handlers()} />));
  expect(host.querySelector('[data-testid="project-home-error"]')?.textContent).toContain("not on this computer");
  expect(host.querySelector('[data-testid="project-home-empty"]')).toBeNull();
});

it("words a thread from Perch's records: a question outranks the lifecycle and unknown is never idle", () => {
  const thread = (extra: Record<string, unknown>) => ({ leadSessionId: "l", row: row(extra) }) as never;
  expect(stateWord(thread({ lifecycle: "working", needsYou: { preview: "x", at: 1 } }))).toBe("Waiting on you");
  expect(stateWord(thread({ lifecycle: "idle", dispatch: "stopped" }))).toBe("Stopped");
  expect(stateWord(thread({ lifecycle: "idle", dispatch: "stop_unknown" }))).toBe("State unknown");
  expect(stateWord(thread({ lifecycle: "unknown" }))).toBe("State unknown");
  expect(stateWord(thread({ lifecycle: "working" }))).toBe("Working");
});
