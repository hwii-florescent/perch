//! Tabs, the stock screen `stock:tabs`: the strip of the shown workspace (a project checkout or one of
//! its git worktrees; with no workspace records, the project). Sessions come first, then open files,
//! reviews, browser pages and mod tabs, in `useWorkspaceTabs()` order, which the tab keys and the
//! sidebar read too, so they never disagree.
//!
//! Click shows a tab (`tab.select`); double-click renames a session inline (Enter keeps, Escape
//! drops) or keeps a previewed file (`tab.pin`); right-click opens the tab menu (`tab.menu`: split,
//! zoom, rename, close). Dragging (`beginTabDrag`) reorders within the strip or splits the canvas
//! when dropped on a pane's side; the order is kept per workspace on this device. × closes the tab
//! it sits on (`tab.close {id}`: a session through the same guard as everywhere else, so its owner
//! decides whether the process stops). "+" (and Cmd+T) opens the agent launcher for this workspace,
//! with a new browser page and a new file after the agents. Only the focused pane's tab is filled;
//! the active tab scrolls into view, also when the strip narrows. A legacy mod can redraw a session's
//! tab through the `tab` slot.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the
//! app runs and `perch mod clone stock:tabs` copies. It may import only `react`, `react-dom`,
//! `@perch/sdk` and files beside it (docs/MOD-SDK.md). The strip's markers (`data-testid="tab-bar"`,
//! `data-tab-entry`, `.tab-bar__tab--active`) are what the tab drag and focus code look for.
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import {
  AgentIcon, beginTabDrag, cn, NewFilePrompt, NewSessionMenu, PageIcon, runCommand, segmentClass, Slot, startSession, TabDragLayer, TabMenu,
  tabStateClass, openBrowserTab, openFileTab, useNewTabRequest, useWorkspaceTabs, type TabInfo, type TabState,
} from "@perch/sdk";
import { BrowserIcon, FileIcon, ReviewIcon, TabCloseIcon } from "./icons";

// Every tab sits in a wrapper that reserves room for its x (pr-[1.6rem]).
// Operational text uses subtext-0: on surface-0 and panel-bg it contrasts at least as much as
// overlay-1 in every theme (themes.test.ts). The palettes set the absolute level.
// The strip scrolls (overflow-x-auto), which clips outlines, so focus rings sit inside (-2px).
const FOCUS = "focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]";
const TAB = `min-w-0 flex-1 gap-2 text-left px-3 pr-[1.6rem] text-[0.8rem] leading-[1.2] whitespace-nowrap ${FOCUS}`;
// Small gutters inset each tab from its neighbors and the strip edge, like a browser tab bar.
const TAB_SLOT = "relative flex min-w-[7rem] max-w-[16rem] flex-1 basis-0 items-stretch";
// A hairline in the gap between two unfocused tabs (no fill to tell them apart).
const SEPARATOR = "pointer-events-none absolute top-1/2 -left-[2px] h-4 w-px -translate-y-1/2 bg-overlay-0";
// "square" is the shell's soft corner (--radius-pane), not a literal square.
const TAB_SHAPE = (shape: "square" | "round") => shape === "round" ? "rounded-full" : "rounded-ui";
const CLOSE = `absolute top-1/2 right-[0.25rem] grid h-[1.25rem] w-[1.25rem] cursor-pointer place-items-center rounded-ui bg-transparent p-0 text-[0.9rem] leading-none text-subtext-0 [border:0] [font-family:inherit] [transform:translateY(-50%)] hover:text-fg ${FOCUS}`;
// The focused tab is filled, so its x hovers on panel-bg: fg is drawn against it in every theme
// (overlay-0 is fg-coloured in the terminal theme and hid the x).
const closeButton = (state: TabState) => cn(CLOSE, state === "focused" ? "text-fg hover:bg-panel-bg" : "hover:bg-surface-1");

const openMenu = (id: string, x: number, y: number) => runCommand("tab.menu", { id, x, y });

export default function TabBar() {
  const { tabs, activeId, hostId, cwd, workspace: ws, tabShape, draggingId } = useWorkspaceTabs();
  const [popoverAnchor, setPopoverAnchor] = useState<DOMRect | null>(null);
  // The "+" menu's New file: the explorer's name prompt, creating in the workspace root.
  const [newFile, setNewFile] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.select();
  }, [renamingId]);

  // Cmd+T: open the harness picker as the "+" button would.
  useNewTabRequest(useCallback(() => {
    const button = stripRef.current?.querySelector('[data-testid="tab-new"]');
    if (button) setPopoverAnchor(button.getBoundingClientRect());
  }, []));

  // The strip scrolls when tabs overflow: keep the active one in view, also when the strip narrows.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const reveal = () => strip.querySelector(".tab-bar__tab--active")?.scrollIntoView({ inline: "nearest", block: "nearest" });
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [activeId, tabs.length]);

  function commitRename() {
    if (renamingId) {
      const trimmed = renameValue.trim();
      if (trimmed) runCommand("tab.rename", { id: renamingId, name: trimmed });
    }
    setRenamingId(null);
  }

  function handleNewClick(e: MouseEvent<HTMLButtonElement>) {
    // The launcher always lets the user choose the CLI before starting it.
    setPopoverAnchor(e.currentTarget.getBoundingClientRect());
  }

  function sessionTab(tab: TabInfo, separated: boolean) {
    const { state } = tab;
    return (
      renamingId === tab.id ? (
        <input
          key={tab.id}
          ref={renameInputRef}
          type="text"
          className="w-40 shrink-0 rounded-ui bg-surface-0 px-2 py-1 text-[0.8rem] leading-[1.2] text-fg [font-family:inherit] focus:[outline:1px_solid_var(--accent)]"
          data-testid="rename-input"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setRenamingId(null);
          }}
        />
      ) : (
        <span key={tab.id} className={TAB_SLOT} data-tab-entry={tab.id}>
        {separated && <span className={SEPARATOR} aria-hidden="true" data-testid="tab-separator" />}
        <Slot
          name="tab"
          className="flex min-w-0"
          data={{ id: tab.id, title: tab.title, label: tab.label, state, provider: tab.provider, blocked: tab.blocked, unseen: tab.unseen }}
          actions={{
            open: () => runCommand("tab.select", { id: tab.id }),
            rename: () => { setRenamingId(tab.id); setRenameValue(tab.title || ""); },
            menu: (x: unknown, y: unknown) => openMenu(tab.id, Number(x), Number(y)),
          }}
        >
        <button
          type="button"
          className={cn(
            "tab-bar__tab",
            segmentClass(),
            TAB,
            TAB_SHAPE(tabShape),
            tabStateClass[state],
            state === "focused" && "tab-bar__tab--active",
            tab.id === draggingId && "opacity-40",
          )}
          data-pane-state={state}
          data-testid={`tab-${tab.id}`}
          title={tab.title || "New session"}
          onPointerDown={(e) => beginTabDrag(e, tab.id, tab.label)}
          onClick={() => runCommand("tab.select", { id: tab.id })}
          onContextMenu={(e) => {
            e.preventDefault();
            openMenu(tab.id, e.clientX, e.clientY);
          }}
          onDoubleClick={() => {
            setRenamingId(tab.id);
            setRenameValue(tab.title || "");
          }}
        >
          <span className="shrink-0 opacity-80" aria-hidden="true">
            <AgentIcon provider={tab.provider} size={14} />
          </span>
          <span className="truncate">{tab.label}</span>
        </button>
        </Slot>
        {/* Like closing a tab in Orca: the session, its agent and its shells
         * end (the agent's own transcript stays on disk). */}
        <button
          type="button"
          className={closeButton(state)}
          data-testid={`tab-close-${tab.id}`}
          title="Close session"
          aria-label={`Close ${tab.label}`}
          onClick={() => runCommand("tab.close", { id: tab.id })}
        >
          <TabCloseIcon />
        </button>
        </span>
      )
    );
  }

  return (
    <div ref={stripRef} className="tab-bar flex min-w-0 flex-1 items-stretch gap-[3px] self-stretch overflow-x-auto px-2 py-[6px] max-[700px]:hidden" data-testid="tab-bar" data-tauri-drag-region>
      {tabs.map((tab, i) => {
        const separated = i > 0 && tab.state !== "focused" && tabs[i - 1]!.state !== "focused";
        return tab.kind === "session" ? sessionTab(tab, separated) : (
          <ResourceTab key={tab.id} tab={tab} tabShape={tabShape} dragging={tab.id === draggingId} separated={separated} />
        );
      })}

      <button
        type="button"
        className={cn(segmentClass(), `w-7 shrink-0 justify-center text-[0.8rem] leading-none ${FOCUS}`, TAB_SHAPE(tabShape))}
        data-testid="tab-new"
        title="New session in this workspace"
        aria-label="New session in this workspace"
        onClick={handleNewClick}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true"><path d="M6 2v8M2 6h8" /></svg>
      </button>
      <TabMenu />
      <TabDragLayer />
      {popoverAnchor && (
        <NewSessionMenu
          hostId={hostId}
          cwd={cwd ?? "~"}
          anchorRect={popoverAnchor}
          onClose={() => setPopoverAnchor(null)}
          onSelect={(selectedCwd, provider) => startSession(hostId, selectedCwd, provider)}
          extras={ws ? [
            { id: "browser", label: "New browser", icon: <BrowserIcon />, onSelect: () => openBrowserTab(ws.id) },
            { id: "file", label: "New file", icon: <FileIcon />, onSelect: () => setNewFile(true) },
          ] : undefined}
        />
      )}
      {newFile && ws && (
        <NewFilePrompt
          workspaceId={ws.id}
          workspacePath={ws.path}
          onClose={() => setNewFile(false)}
          onOpenFile={(path) => openFileTab(ws.id, path)}
        />
      )}
    </div>
  );
}

/** A file's, review's, browser page's or mod's tab: its name, a ● while a file has unsaved changes, and ×. */
function ResourceTab({ tab, tabShape, dragging, separated }: {
  tab: TabInfo;
  tabShape: "square" | "round";
  dragging: boolean;
  separated: boolean;
}) {
  const { id, state, kind } = tab;
  const review = kind === "review";
  const browser = kind === "browser";
  const testId = review ? `review-tab-${tab.workspaceId}` : browser ? "browser-tab" : kind === "mod" ? `mod-tab-${tab.mod}` : `file-tab-${tab.path}`;
  return (
    <span className={TAB_SLOT} data-tab-entry={id}>
      {separated && <span className={SEPARATOR} aria-hidden="true" data-testid="tab-separator" />}
      <button
        type="button"
        className={cn(
          "tab-bar__tab",
          segmentClass(),
          TAB,
          TAB_SHAPE(tabShape),
          tabStateClass[state],
          state === "focused" && "tab-bar__tab--active",
          dragging && "opacity-40",
        )}
        data-pane-state={state}
        data-testid={testId}
        title={review ? "Changes" : browser ? tab.url || (tab.blank ? "New browser" : tab.path) : tab.path}
        onPointerDown={(e) => beginTabDrag(e, id, tab.label)}
        onClick={() => runCommand("tab.select", { id })}
        onDoubleClick={() => runCommand("tab.pin", { id })}
        onContextMenu={(e) => {
          e.preventDefault();
          openMenu(id, e.clientX, e.clientY);
        }}
      >
        <span className="shrink-0 opacity-80" aria-hidden="true">{browser ? <PageIcon icon={tab.icon} fallback={<BrowserIcon />} /> : review ? <ReviewIcon /> : <FileIcon />}</span>
        <span className={cn("block truncate", tab.preview && "italic")}>{tab.label}</span>
        {tab.dirty && <span className="text-subtext-0" aria-label="unsaved changes"> ●</span>}
      </button>
      <button
        type="button"
        className={closeButton(state)}
        data-testid={review ? `review-tab-close-${tab.workspaceId}` : browser ? "browser-tab-close" : `file-tab-close-${tab.path}`}
        aria-label={`Close ${tab.label}`}
        onClick={() => runCommand("tab.close", { id })}
      >
        <TabCloseIcon />
      </button>
    </span>
  );
}
