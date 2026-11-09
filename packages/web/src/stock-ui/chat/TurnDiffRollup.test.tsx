// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { NativeUiEditFile, NativeUiTurnDiff } from "@perch/shared";
import { afterEach, beforeEach, expect, it } from "vitest";
import { TurnDiffRollup } from "./TurnDiffRollup";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const card = (path: string): NativeUiEditFile => ({ path, changeKind: "edited", added: 1, removed: 1, lineNumbersKnown: false, lines: [{ kind: "del", text: "was" }, { kind: "add", text: "now" }] });
const files = (count: number) => Array.from({ length: count }, (_, n) => ({ path: `/r/f${n}.ts`, added: 1, removed: 1, edits: [{ step: `s${n}`, fileIndex: 0 }] }));
const diff = (count: number): NativeUiTurnDiff => ({ turn: "u", after: "x", files: files(count), added: count, removed: count });
const cards = (step: string) => card(`/r/${step.replace("s", "f")}.ts`);

it("counts the files and totals, and opens a file to the cards of its edits", () => {
  act(() => root.render(<TurnDiffRollup diff={diff(2)} cards={cards} />));
  expect(host.textContent).toContain("2 changed files");
  expect(host.textContent).toContain("+2");
  expect(host.querySelector("[data-testid=native-cli-diff-card]")).toBeNull();
  act(() => (host.querySelector("button[aria-expanded]") as HTMLButtonElement).click());
  expect(host.querySelectorAll("[data-testid=native-cli-diff-card]")).toHaveLength(1);
  expect(host.querySelector("button[aria-expanded=true]")!.getAttribute("aria-label")).toBe("/r/f0.ts +1 -1");
});

it("says one changed file in the singular, marks a partial diff and skips a card the core dropped", () => {
  act(() => root.render(<TurnDiffRollup diff={{ ...diff(1), truncated: true }} cards={() => undefined} />));
  expect(host.textContent).toContain("1 changed file");
  expect(host.textContent).toContain("Partial diff");
  act(() => (host.querySelector("button[aria-expanded]") as HTMLButtonElement).click());
  expect(host.querySelector("[data-testid=native-cli-diff-card]")).toBeNull();
});

it("shows twenty files and offers the rest", () => {
  act(() => root.render(<TurnDiffRollup diff={diff(23)} cards={cards} />));
  expect(host.querySelectorAll("button[aria-expanded]")).toHaveLength(20);
  const more = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "Show 3 more")!;
  act(() => more.click());
  expect(host.querySelectorAll("button[aria-expanded]")).toHaveLength(23);
});
