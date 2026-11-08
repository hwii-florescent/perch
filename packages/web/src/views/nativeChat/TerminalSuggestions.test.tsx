// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SuggestionCard } from "@perch/shared";

const mocks = vi.hoisted(() => ({ cards: [] as SuggestionCard[], act: vi.fn(), generation: vi.fn() }));
vi.mock("../../suggestions", async (original) => ({
  ...(await original<typeof import("../../suggestions")>()),
  useSuggestions: () => ({ cards: mocks.cards, refresh: () => {} }),
  actOnSuggestion: mocks.act,
}));
vi.mock("../../agentTerminals", () => ({ agentInputGeneration: mocks.generation }));
vi.mock("../../store", () => ({ usePerchStore: Object.assign((select: (state: object) => unknown) => select({ connected: true }), { getState: () => ({ switchSession: () => {} }) }) }));
import { waitingCount } from "../../suggestions";
import { TerminalSuggestions } from "./TerminalSuggestions";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); mocks.act.mockReset(); mocks.generation.mockReset(); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const card = (states: string[]): SuggestionCard => ({
  id: "c1",
  items: states.map((state, index) => ({ id: `s${index}`, task: `task ${index}`, agent: "claude", worktree: false, state })),
});
const q = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);

it("counts only the tasks still waiting for the person", () => {
  expect(waitingCount([card(["pending", "started", "pending", "dismissed"]), card(["pending"])])).toBe(3);
  expect(waitingCount([])).toBe(0);
});

it("shows nothing when nothing waits, else a count that opens the same cards and acts under the terminal's lease", async () => {
  mocks.cards = [card(["started"])];
  act(() => root.render(<TerminalSuggestions sessionId="lead" terminalId="t1" controlling />));
  expect(q("terminal-suggestions")).toBeNull();

  mocks.cards = [card(["pending", "pending"])];
  mocks.generation.mockReturnValue(7);
  mocks.act.mockResolvedValue({ outcome: "started" });
  act(() => root.render(<TerminalSuggestions sessionId="lead" terminalId="t1" controlling />));
  expect(q("terminal-suggestions-toggle")!.textContent).toBe("2 suggested tasks");
  expect(q("terminal-suggestions-panel")).toBeNull();
  await act(async () => q("terminal-suggestions-toggle")!.click());
  await act(async () => q("native-cli-suggestion-start-all")!.click());
  expect(mocks.act).toHaveBeenCalledWith({ sessionId: "lead", cardId: "c1", generation: 7, action: "start_all" });
});

it("does not ask the core without the terminal's input lease", async () => {
  mocks.cards = [card(["pending"])];
  mocks.generation.mockReturnValue(undefined);
  act(() => root.render(<TerminalSuggestions sessionId="lead" terminalId="t1" controlling={false} />));
  expect(q("terminal-suggestions-toggle")!.textContent).toBe("1 suggested task");
  await act(async () => q("terminal-suggestions-toggle")!.click());
  expect((q("native-cli-suggestion-start") as HTMLButtonElement).disabled).toBe(true);
  expect(mocks.act).not.toHaveBeenCalled();
});
