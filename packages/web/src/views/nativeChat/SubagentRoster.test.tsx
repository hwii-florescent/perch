// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import type { NativeUiSubagentGroup } from "@perch/shared";
import { SubagentRoster, duration } from "./SubagentRoster";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const group: NativeUiSubagentGroup = {
  turn: "u1", after: "run1", working: true, headline: "Kicked off 2 subagents", verdictState: "working", verdict: "1 working",
  alertState: "failed", alert: "1 failed",
  agents: [{ id: "a", label: "audit", state: "working", stateLabel: "working", agentType: "general-purpose" }, { id: "b", label: "review", state: "failed", stateLabel: "failed" }],
};

it("shows the core's headline and verdict, and the children once opened", () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<SubagentRoster group={group} />));
  expect(host.textContent).toBe("Kicked off 2 subagents1 working +1 failed");
  expect(host.querySelectorAll("[data-testid=native-cli-subagent]").length).toBe(0);
  act(() => host.querySelector("button")!.click());
  const rows = [...host.querySelectorAll("[data-testid=native-cli-subagent]")];
  expect(rows.map((row) => row.textContent)).toEqual(["auditworking", "reviewfailed"]);
  expect(rows.map((row) => row.getAttribute("data-state"))).toEqual(["working", "failed"]);
  act(() => root.unmount());
});

it("words a settled run length", () => {
  expect(duration(12_400)).toBe("12s");
  expect(duration(65_000)).toBe("1m 5s");
});
