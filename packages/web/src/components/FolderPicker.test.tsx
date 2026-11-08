// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ADD_PROJECT_EVENT } from "../appEvents";
import { FolderPicker, type StartTarget } from "./FolderPicker";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const targets: StartTarget[] = [
  { key: "/work/app-wt", label: "app (current folder)", name: "app", path: "/work/app-wt" },
  { key: "/work/other", label: "other", name: "other", path: "/work/other" },
  { key: "~", label: "No project (Quickchat)", name: "Quickchat", path: "~" },
];

function open(onChange: (key: string) => void) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<FolderPicker targets={targets} value="/work/app-wt" onChange={onChange} />));
  act(() => host.querySelector<HTMLButtonElement>("[data-testid=cli-start-target]")!.click());
  const rows = () => Array.from(document.body.querySelectorAll<HTMLElement>("[role=option]"));
  return { rows, done: () => { act(() => root.unmount()); host.remove(); } };
}

it("offers the exact current folder, other projects and Quickchat, and reports the real cwd picked", () => {
  const onChange = vi.fn();
  const view = open(onChange);
  expect(view.rows().map((row) => row.textContent)).toEqual(["app (current folder)✓", "other", "No project (Quickchat)", "Add project…"]);
  act(() => view.rows()[1]!.click());
  expect(onChange).toHaveBeenCalledExactlyOnceWith("/work/other");
  view.done();
});

it("Add project opens the add flow and never becomes a target", () => {
  const onChange = vi.fn(), added = vi.fn();
  window.addEventListener(ADD_PROJECT_EVENT, added);
  const view = open(onChange);
  act(() => view.rows().at(-1)!.click());
  expect(added).toHaveBeenCalledOnce();
  expect(onChange).not.toHaveBeenCalled();
  window.removeEventListener(ADD_PROJECT_EVENT, added);
  view.done();
});
