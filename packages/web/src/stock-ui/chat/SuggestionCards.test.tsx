// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SuggestionCard } from "@perch/shared";
import { SuggestionCards, optionsLine, startedWords } from "./SuggestionCards";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const card = (items: Partial<SuggestionCard["items"][number]>[], id = "c1"): SuggestionCard => ({
  id,
  items: items.map((item, index) => ({ id: `s${index}`, task: `task ${index}`, agent: "codex", worktree: false, state: "pending", ...item })),
});
const q = (selector: string) => host.querySelector<HTMLElement>(`[data-testid="${selector}"]`)!;
const click = async (element: HTMLElement) => { await act(async () => element.click()); };
const outcome = (extra: object = {}) => Promise.resolve({ outcome: "started", ...extra });

it("words what a task will run with and where a started sub-session is", () => {
  expect(optionsLine({ agent: "codex", model: "gpt-5.6-luna", worktree: true })).toBe("codex · gpt-5.6-luna · own worktree");
  expect(optionsLine({ agent: "claude", worktree: false })).toBe("claude");
  expect(startedWords("running")).toBe("Started");
  expect(startedWords("exited")).toBe("Finished");
  expect(startedWords("start_unknown")).toContain("not sure it started");
  expect(startedWords(undefined)).toBe("Started");
});

it("draws nothing without cards and shows one card of one task with Start, Do it here, Options and Dismiss", () => {
  act(() => root.render(<SuggestionCards cards={[]} canAct onOpen={() => {}} />));
  expect(host.querySelector('[data-testid="native-cli-suggestions"]')).toBeNull();
  act(() => root.render(<SuggestionCards cards={[card([{ task: "fix the parser", model: "gpt-5.6-luna" }])]} canAct onOpen={() => {}} onAct={() => outcome()} onSendHere={() => Promise.resolve({ ok: true })} />));
  expect(q("native-cli-suggestion-task").textContent).toBe("fix the parser");
  expect(q("native-cli-suggestion-options").textContent).toBe("codex · gpt-5.6-luna");
  for (const id of ["start", "here", "options-toggle", "dismiss"]) expect(q(`native-cli-suggestion-${id}`)).toBeTruthy();
  expect(host.querySelector('[data-testid="native-cli-suggestion-start-all"]')).toBeNull();
});

it("Start asks the core to start that task and shows why it refused, in the core's words", async () => {
  const onAct = vi.fn().mockResolvedValue({ outcome: "refused", reason: "You already have 4 sub-sessions running." });
  act(() => root.render(<SuggestionCards cards={[card([{}])]} canAct onOpen={() => {}} onAct={onAct} />));
  await click(q("native-cli-suggestion-start"));
  expect(onAct).toHaveBeenCalledWith("c1", { action: "start", suggestionId: "s0" });
  expect(q("native-cli-suggestion-note").textContent).toBe("You already have 4 sub-sessions running.");
});

it("Options sends the agent, model and worktree the person chose with Start", async () => {
  const onAct = vi.fn().mockReturnValue(outcome());
  act(() => root.render(<SuggestionCards cards={[card([{ agent: "codex" }])]} canAct onOpen={() => {}} onAct={onAct} />));
  expect(host.querySelector('[data-testid="native-cli-suggestion-options-form"]')).toBeNull();
  await click(q("native-cli-suggestion-options-toggle"));
  const agent = q("native-cli-suggestion-agent") as HTMLSelectElement;
  const model = q("native-cli-suggestion-model") as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(agent, "claude");
    agent.dispatchEvent(new Event("change", { bubbles: true }));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(model, " claude-haiku-4-5 ");
    model.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click(q("native-cli-suggestion-worktree"));
  await click(q("native-cli-suggestion-start-options"));
  expect(onAct).toHaveBeenCalledWith("c1", { action: "start", suggestionId: "s0", agent: "claude", model: "claude-haiku-4-5", worktree: true });
});

it("Do it here sends the task to the lead and only then records it; a task that was not sent stays", async () => {
  const onAct = vi.fn().mockResolvedValue({ outcome: "handed" });
  const failing = vi.fn().mockResolvedValue({ ok: false, reason: "The CLI did not accept the message" });
  act(() => root.render(<SuggestionCards cards={[card([{ task: "fix the parser" }])]} canAct onOpen={() => {}} onAct={onAct} onSendHere={failing} />));
  await click(q("native-cli-suggestion-here"));
  expect(failing).toHaveBeenCalledWith("fix the parser");
  expect(onAct).not.toHaveBeenCalled();
  expect(q("native-cli-suggestion-note").textContent).toBe("The CLI did not accept the message");
  const sending = vi.fn().mockResolvedValue({ ok: true });
  act(() => root.render(<SuggestionCards cards={[card([{ task: "fix the parser" }])]} canAct onOpen={() => {}} onAct={onAct} onSendHere={sending} />));
  await click(q("native-cli-suggestion-here"));
  expect(sending).toHaveBeenCalledWith("fix the parser");
  expect(onAct).toHaveBeenCalledWith("c1", { action: "handed", suggestionId: "s0" });
});

it("a card of several tasks offers Start all and Dismiss all, and says when only some started", async () => {
  const onAct = vi.fn().mockResolvedValue({ outcome: "partial", reason: "You already have 4 sub-sessions running." });
  act(() => root.render(<SuggestionCards cards={[card([{}, {}, { state: "dismissed" }])]} canAct onOpen={() => {}} onAct={onAct} />));
  expect(q("native-cli-suggestion-start-all").textContent).toBe("Start all (2)");
  await click(q("native-cli-suggestion-start-all"));
  expect(onAct).toHaveBeenCalledWith("c1", { action: "start_all" });
  expect(q("native-cli-suggestion-note").textContent).toContain("already have 4");
  await click(q("native-cli-suggestion-dismiss-all"));
  expect(onAct).toHaveBeenLastCalledWith("c1", { action: "dismiss" });
});

it("a started task shows its sub-session's state and opens it; nothing is offered for it", async () => {
  const open = vi.fn();
  act(() => root.render(<SuggestionCards cards={[card([{ state: "started", childSessionId: "kid", dispatch: "running" }])]} canAct onOpen={open} onAct={() => outcome()} />));
  expect(q("native-cli-suggestion-started").textContent).toContain("Started");
  expect(host.querySelector('[data-testid="native-cli-suggestion-start"]')).toBeNull();
  await click(q("native-cli-suggestion-open"));
  expect(open).toHaveBeenCalledWith("kid");
});

it("without the chat's input control every button is off and says why", () => {
  act(() => root.render(<SuggestionCards cards={[card([{}])]} canAct={false} onOpen={() => {}} onAct={() => outcome()} />));
  for (const id of ["start", "here", "options-toggle", "dismiss"]) expect((q(`native-cli-suggestion-${id}`) as HTMLButtonElement).disabled).toBe(true);
  expect(host.textContent).toContain("Take control of this chat to answer a suggestion");
});
