// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { usePerchStore } from "../store";
import { BorrowTerminals, lendTerminal } from "../terminalKeeper";
import { AgentCliTerminal } from "./AgentCliTerminal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { document.body.innerHTML = ""; });

/** A peek (a borrowing surface) of a remote session: the tab's own view moves in, or a placeholder; never an attach. */
it("a peek of a remote session borrows the view its tab has, or shows a placeholder, and never attaches a second viewer", async () => {
  const attachAgentCli = vi.fn();
  usePerchStore.setState({
    sessions: [{ id: "far", hostId: "box", cliProviderId: "claude" }] as never, activeHostId: "local",
    hosts: [{ id: "box", name: "Build box" }] as never, attachAgentCli: attachAgentCli as never,
  });
  const show = async () => {
    const into = document.body.appendChild(document.createElement("div"));
    const root = createRoot(into);
    await act(async () => root.render(<BorrowTerminals.Provider value={true}><AgentCliTerminal sessionId="far" agent="claude" /></BorrowTerminals.Provider>));
    return { into, close: () => act(async () => root.unmount()) };
  };

  const none = await show();
  expect(none.into.textContent).toContain("runs on Build box and is shown only in its own tab");
  await none.close();

  const tab = document.body.appendChild(document.createElement("div"));
  const surface = tab.appendChild(document.createElement("div"));
  const withdraw = lendTerminal("far", tab, surface, () => {});
  const peek = await show();
  expect(peek.into.querySelector('[data-testid="borrowed-legacy-terminal"]')!.contains(surface)).toBe(true);
  expect(peek.into.textContent).not.toContain("shown only in its own tab");
  await peek.close();
  expect(tab.contains(surface)).toBe(true);
  withdraw();
  expect(attachAgentCli).not.toHaveBeenCalled();
});
