// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AgentControlProps } from "@perch/sdk";
import AgentControl from "./main";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  host = document.body.appendChild(document.createElement("div"));
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

const q = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const base: AgentControlProps = {
  part: "top", agent: "Claude", label: null, connected: true, pending: false, onRetry: null, control: null, error: null, ended: null,
  state: { controlling: true, shared: false, writable: true, phone: false },
};
const draw = (props: Partial<AgentControlProps>) => act(() => root.render(<AgentControl {...base} {...props} />));

it("the top part shows Perch's label and asks Perch to take control or retry; nothing while this view controls", () => {
  draw({});
  expect(host.innerHTML).toBe("");
  const takeControl = vi.fn();
  draw({ label: "Another view is typing in this agent", control: { label: "Take control", disabled: false, onClick: takeControl } });
  expect(q("agent-control-chip")!.textContent).toContain("Another view is typing in this agent");
  act(() => q("agent-take-control")!.click());
  expect(takeControl).toHaveBeenCalledTimes(1);
  draw({ label: "Reconnecting…", control: { label: "Take control", disabled: true, onClick: takeControl } });
  expect((q("agent-take-control") as HTMLButtonElement).disabled).toBe(true);
  const retry = vi.fn();
  draw({ label: "Agent unavailable", onRetry: retry });
  act(() => [...host.querySelectorAll("button")].find((b) => b.textContent === "Retry CLI")!.click());
  expect(retry).toHaveBeenCalledTimes(1);
  // The bottom part's error and banner are not drawn at the top.
  draw({ label: "Viewing agent", error: "boom", ended: { sleeping: false, exitCode: 1, onRestart: () => {}, onClose: null } });
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(q("cli-exited")).toBeNull();
});

it("the bottom part shows the error and the ended banner, and Restart, Resume and Close go to Perch", () => {
  const restart = vi.fn(), close = vi.fn();
  draw({ part: "bottom", label: "Viewing agent", error: "spawn failed", ended: { sleeping: false, exitCode: 2, onRestart: restart, onClose: close } });
  expect(host.querySelector('[role="alert"]')!.textContent).toBe("spawn failed");
  expect(q("agent-control-chip")).toBeNull();
  expect(q("cli-exited")!.textContent).toContain("Claude exited (code 2)");
  act(() => q("cli-restart")!.click());
  act(() => q("cli-close-session")!.click());
  expect([restart.mock.calls.length, close.mock.calls.length]).toEqual([1, 1]);

  draw({ part: "bottom", ended: { sleeping: true, exitCode: null, onRestart: restart, onClose: null } });
  expect(q("cli-sleeping")!.textContent).toContain("sleeping to save memory");
  expect(q("cli-close-session")).toBeNull();
  act(() => q("cli-resume")!.click());
  expect(restart).toHaveBeenCalledTimes(2);
});
