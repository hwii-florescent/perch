// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { DockedTasks } from "./DockedTasks";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

it("shows progress, each task's state for screen readers and the present tense of the one in progress", () => {
  act(() => root.render(<DockedTasks list={{ tasks: [
    { content: "Read the notes", status: "completed" },
    { content: "Write the summary", status: "in_progress", activeForm: "Writing the summary" },
    { content: "Ship it", status: "pending", activeForm: "Shipping it" },
  ] }} />));
  expect(host.querySelector("summary")!.textContent).toBe("Tasks 1 of 3 completed");
  const items = Array.from(host.querySelectorAll("li")).map((item) => item.textContent);
  expect(items).toEqual(["Completed: Read the notes", "In progress: Writing the summary", "Pending: Ship it"]);
});
