// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { NativeUiEditFile } from "@perch/shared";
import { afterEach, beforeEach, expect, it } from "vitest";
import { DiffCard } from "./DiffCard";
import { editFilePatchText, gutterChars, unifiedLineNumber } from "./editRows";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const file: NativeUiEditFile = {
  path: "/repo/src/a.ts", changeKind: "edited", added: 2, removed: 1, lineNumbersKnown: true, truncated: true,
  lines: [
    { kind: "context", text: "keep", oldLineNumber: 41, newLineNumber: 41 },
    { kind: "del", text: "was", oldLineNumber: 42 },
    { kind: "add", text: "now", newLineNumber: 42 },
    { kind: "gap", text: "" },
    { kind: "add", text: "later", newLineNumber: 310 },
  ],
};

it("numbers a removed row from the old side and the rest from the new, and copies signed rows without gaps", () => {
  expect(file.lines.map(unifiedLineNumber)).toEqual([41, 42, 42, undefined, 310]);
  expect(gutterChars(file)).toBe(4);
  expect(gutterChars({ ...file, lineNumbersKnown: false })).toBe(0);
  expect(editFilePatchText(file.lines)).toBe(" keep\n-was\n+now\n+later");
});

it("shows the file, its counts and 'Diff truncated', and builds its rows only once opened", () => {
  act(() => root.render(<DiffCard file={file} />));
  expect(host.textContent).toContain("Edited");
  expect(host.textContent).toContain("a.ts");
  expect(host.textContent).toContain("+2");
  expect(host.textContent).toContain("Diff truncated");
  expect(host.querySelector("[data-testid=native-cli-diff-rows]")).toBeNull();
  act(() => (host.querySelector("button[aria-expanded]") as HTMLButtonElement).click());
  const rows = host.querySelector("[data-testid=native-cli-diff-rows]")!;
  expect(rows.querySelectorAll("[role=separator]")).toHaveLength(1);
  expect(rows.textContent).toContain("later");
  expect(host.querySelector("button[aria-label='Copy diff']")).not.toBeNull();
});

it("gives a header-only change (a delete with no body) no disclosure", () => {
  act(() => root.render(<DiffCard file={{ path: "gone.ts", changeKind: "deleted", added: 0, removed: 0, lineNumbersKnown: true, lines: [] }} />));
  expect(host.querySelector("button[aria-expanded]")).toBeNull();
  expect(host.textContent).toContain("Deleted");
});
