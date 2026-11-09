//! Pane header, the stock screen `stock:pane-header`: the header row of a session's pane while the
//! canvas is split (agent icon, name, what the agent is doing, leave split, close), and with
//! `corner`, the two controls a split file, review or browser pane shows in its top-right corner.
//! Perch draws one copy per pane and keeps the pane itself (its terminal, size, drag grip and focus)
//! outside it; the header only names and acts on its pane by `id`. Right-click opens the tab menu;
//! a layout's `paneHeaderAt`/`paneHeaderReveal`/`paneHeaderHeight` (`usePaneLook`) place it. A
//! legacy mod can redraw the name and state through the `pane-header` slot.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the
//! app runs and `perch mod clone stock:pane-header` copies. It may import only `react`, `react-dom`,
//! `@perch/sdk` and files beside it (docs/MOD-SDK.md).
import { agentStateColor, AgentIcon, cn, ghostButton, runCommand, Slot, usePaneLook, useWorkspaceTabs, type AgentState, type TabInfo } from "@perch/sdk";

const STATE_WORD: Record<AgentState, string> = { blocked: "Waiting for you", working: "Working", done: "Done", idle: "Idle", unknown: "" };

function Controls({ tab }: { tab: TabInfo }) {
  return (
    <span className="flex shrink-0 items-center" data-testid={`tile-controls-${tab.id}`}>
      <button type="button" className={cn(ghostButton, "flex size-6 items-center justify-center p-0 text-subtext-0 hover:text-fg")} title="Show this tab full size — leave the split" aria-label={`Exit split for ${tab.label}`} data-testid={`tile-expand-${tab.id}`} onClick={() => runCommand("pane.unsplit", { id: tab.id })}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M6 2H2v4m8-4h4v4M2 10v4h4m8-4v4h-4" /></svg>
      </button>
      <button type="button" className={cn(ghostButton, "flex size-6 items-center justify-center p-0 text-subtext-0 hover:text-fg")} title="Close this tab" aria-label={`Close ${tab.label}`} data-testid={`tile-close-${tab.id}`} onClick={() => runCommand("pane.close", { id: tab.id })}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" /></svg>
      </button>
    </span>
  );
}

export default function PaneHeader({ id, corner }: { id: string; corner?: boolean }) {
  const { tabs, activeId } = useWorkspaceTabs();
  const look = usePaneLook();
  const tab = tabs.find((candidate) => candidate.id === id);
  if (!tab) return null;
  if (corner) return <div className="pointer-events-auto absolute top-1 right-1 rounded-ui bg-panel-bg"><Controls tab={tab} /></div>;
  const state = tab.activity ?? "unknown";
  return (
    // One compact row owns the name, status and actions; no floating controls over the header.
    <div
      className={cn(
        "flex shrink-0 items-center gap-1.5 bg-panel-bg px-1.5 text-xs text-subtext-0",
        // `hover`: drawn over the terminal while the pointer is on the pane, so the terminal never resizes.
        look.headerReveal === "hover" && cn("absolute inset-x-0 z-20 opacity-0 transition-opacity group-hover:opacity-100", look.headerAt === "bottom" ? "bottom-0" : "top-0"),
        look.headerReveal !== "hover" && look.headerAt === "bottom" && "order-last",
      )}
      style={{ height: look.headerHeight }}
      data-testid={`pane-header-${id}`}
      onContextMenu={(event) => { event.preventDefault(); runCommand("tab.menu", { id, x: event.clientX, y: event.clientY }); }}>
      <Slot
        name="pane-header"
        className="flex min-w-0 flex-1 items-center gap-1.5"
        data={{ id, title: tab.title, label: tab.label, state, provider: tab.provider, focused: id === activeId }}
        actions={{ open: () => runCommand("tab.select", { id }), menu: (x: unknown, y: unknown) => runCommand("tab.menu", { id, x: Number(x), y: Number(y) }) }}
      >
        <span className="shrink-0"><AgentIcon provider={tab.provider} size={12} /></span>
        <span className="min-w-0 flex-1 truncate" title={tab.title}>{tab.label}</span>
        <span className="flex min-w-0 items-center gap-1" title={STATE_WORD[state]}>
          <span className="size-[5px] shrink-0 rounded-full" style={{ background: agentStateColor(state) }} aria-hidden="true" />
          <span className="truncate">{STATE_WORD[state]}</span>
        </span>
      </Slot>
      <Controls tab={tab} />
    </div>
  );
}
