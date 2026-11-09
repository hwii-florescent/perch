//! StockWindow.tsx: Perch's own desktop window, as three parts: the sidebar card, the main card (tabs over the
//! canvas) and the drawer card (Files, Git and Browser), each with its head row, toggles and resize handle. The same
//! parts are the blocks `window:sidebar`, `window:main` and `window:drawer` of the stock layout
//! (`stock-ui/layouts/main.json`, `stock:main`), so a copy of that layout (`perch mod clone stock:main my-window`)
//! draws the same window and can rearrange it. `StockWindow` itself is the recovery shell App draws when no layout is
//! chosen, or the chosen one does not load: it puts the parts in `STOCK_WINDOW_PARTS` order, which a test holds
//! equal to the stock layout's. The drawer's tab, its workspace and both widths live in `useWindowChrome`, shared by
//! the parts wherever they are and kept on this device under the keys the window always used.
import { create } from "zustand";
import { useNeedsYouCount } from "../attention";
import { cn } from "../lib/cn";
import { usePerchStore } from "../store";
import { useIsMobileWidth } from "../responsive";
import { StockView } from "./mod-root";
import { ResizeHandle } from "./ResizeHandle";
import { SplitCanvas } from "./SplitCanvas";
import { WorkspaceTools, WorkspaceToolsTabs, type WorkspaceToolsTab } from "./WorkspaceTools";

const TOOLS_STORAGE_KEY = "perch.workspaceTools";
// Per-viewer column widths (px), set by dragging the dividers.
const SIDEBAR_KEY = "perch.layout.sidebarWidth";
const TOOLS_KEY = "perch.layout.toolsWidth";
export const SIDEBAR_DEFAULT = 240;
const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 480;
const TOOLS_MIN = 280;
const MAIN_MIN = 320;
// The open gutter between two cards is the resize handle (ResizeHandle.tsx); the same 8px surrounds the cards at
// the window edge.
const GUTTER = 8;
const toolsDefault = () => Math.min(760, Math.round(window.innerWidth * 0.46));

// The Tauri app on macOS draws its traffic lights over the web view's top row.
export const MAC_DESKTOP = "__TAURI_INTERNALS__" in window && /Mac/.test(navigator.platform);
// The sidebar and drawer toggles blend into the top row and fill only on hover.
const ICON_BUTTON = "inline-flex size-7 shrink-0 items-center justify-center rounded-ui bg-transparent p-0 text-[0.9rem] leading-none text-subtext-0 [font-family:inherit] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg";
// Sidebar toggle inset, same in both sidebar states. Derived, not eyeballed: the traffic lights end
// 72px into the card (glass.rs LIGHTS_LEFT 22 + 2 x 23 step + 12 diameter - 8 card inset), and the
// toggle keeps a 12px gap on each side: 72 + 12 = 84 before it, 12 - 8 (TabBar's px-2) = 4 after it
// (TOGGLE_AFTER). Change both together if LIGHTS_LEFT moves. Nudged 1px right of the measured
// centre (85 / 3): the round lights read as visually heavier, so exact centre looks left-shifted.
const TOGGLE_INSET = MAC_DESKTOP ? "pl-[85px]" : "pl-3";
const TOGGLE_AFTER = "pr-[3px]";
// Soft corners for the desktop chrome: every `rounded-ui` inside follows --radius-pane (base.css).
export const SOFT = "[--radius:var(--radius-pane)]";
// A full-height column of the desktop shell, lifted off the --backdrop (themes.ts `backdropFor`).
const CARD = "flex min-h-0 shrink-0 flex-col overflow-hidden rounded-[12px] bg-[var(--card-bg)]";

/** The stock window's parts, left to right: what `StockWindow` draws and the stock layout's row holds. */
export const STOCK_WINDOW_PARTS = ["window:sidebar", "window:main", "window:drawer"] as const;

function readWidth(key: string): number | null {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch { return null; }
}
function writeWidth(key: string, px: number) {
  try { localStorage.setItem(key, String(px)); } catch { /* per-viewer convenience */ }
}
function readTools(): WorkspaceToolsTab | null {
  try {
    const stored = localStorage.getItem(TOOLS_STORAGE_KEY);
    if (!stored) return null;
    // An old stored "terminal" tab maps to Files.
    return stored === "gitReview" || stored === "browser" ? stored : "files";
  } catch { return null; }
}

interface WindowChrome {
  /** The drawer's tab, or null while it is closed; reopening shows `lastTools`. */
  tools: WorkspaceToolsTab | null;
  lastTools: WorkspaceToolsTab;
  /** The workspace a Files/Git request named (a remote checkout has no local row); null follows focus. */
  toolsWorkspaceId: string | null;
  sidebarWidth: number;
  toolsWidth: number;
  setTools(tab: WorkspaceToolsTab | null): void;
  toggleDrawer(): void;
  setToolsWorkspaceId(id: string | null): void;
  setSidebarWidth(px: number): void;
  setToolsWidth(px: number): void;
}

export const useWindowChrome = create<WindowChrome>((set, get) => ({
  tools: readTools(),
  lastTools: readTools() ?? "files",
  toolsWorkspaceId: null,
  sidebarWidth: readWidth(SIDEBAR_KEY) ?? SIDEBAR_DEFAULT,
  toolsWidth: readWidth(TOOLS_KEY) ?? toolsDefault(),
  setTools(tab) {
    try { if (tab) localStorage.setItem(TOOLS_STORAGE_KEY, tab); else localStorage.removeItem(TOOLS_STORAGE_KEY); } catch { /* per-viewer convenience */ }
    set(tab ? { tools: tab, lastTools: tab } : { tools: null });
  },
  toggleDrawer() { get().setTools(get().tools ? null : get().lastTools); },
  setToolsWorkspaceId(id) { set({ toolsWorkspaceId: id }); },
  setSidebarWidth(px) { set({ sidebarWidth: px }); },
  setToolsWidth(px) { set({ toolsWidth: px }); },
}));

/** The widths the window draws at now, within their bounds: the drawer leaves the main card at least MAIN_MIN. */
export function useWindowWidths() {
  const sidebarCollapsed = usePerchStore((state) => state.sidebarCollapsed);
  const isMobile = useIsMobileWidth();
  const sidebarRaw = useWindowChrome((state) => state.sidebarWidth);
  const toolsRaw = useWindowChrome((state) => state.toolsWidth);
  const showSidebar = !isMobile && !sidebarCollapsed;
  const sidebarWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, sidebarRaw));
  const toolsMax = Math.max(TOOLS_MIN, window.innerWidth - (showSidebar ? sidebarWidth : 0) - 4 * GUTTER - MAIN_MIN);
  const toolsWidth = Math.min(toolsMax, Math.max(TOOLS_MIN, toolsRaw));
  return { showSidebar, sidebarWidth, toolsWidth, toolsMax };
}

function SidebarToggle() {
  const sidebarCollapsed = usePerchStore((state) => state.sidebarCollapsed);
  const toggleSidebar = usePerchStore((state) => state.toggleSidebar);
  // With the sidebar out of sight, chats that need you show as a count on the control that opens it.
  const needsYou = useNeedsYouCount();
  return (
    <button
      type="button"
      className={cn(ICON_BUTTON, "relative")}
      title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-label={sidebarCollapsed ? `Expand sidebar${needsYou ? `, ${needsYou} ${needsYou === 1 ? "chat needs" : "chats need"} you` : ""}` : "Collapse sidebar"}
      data-testid="sidebar-collapse-toggle"
      aria-pressed={!sidebarCollapsed}
      onClick={toggleSidebar}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
        <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
        <path d="M6 2.5v11" />
      </svg>
      {sidebarCollapsed && needsYou > 0 && (
        <span className="absolute -top-1 -right-1 grid h-[14px] min-w-[14px] place-items-center rounded-full bg-yellow px-[3px] text-[9px] leading-none font-semibold text-panel-bg tabular-nums" data-testid="needs-you-count" aria-hidden="true">{needsYou}</span>
      )}
    </button>
  );
}

// The drawer holds Files and Git, so its toggle is a right-panel glyph.
function DrawerToggle() {
  const tools = useWindowChrome((state) => state.tools);
  const toggleDrawer = useWindowChrome((state) => state.toggleDrawer);
  return (
    <button type="button" className={ICON_BUTTON} title="Files and Git for this workspace" aria-label="Files and Git" data-testid="workspace-tools-toggle" aria-pressed={tools !== null} onClick={toggleDrawer}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
        <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
        <path d="M10 2.5v11" />
      </svg>
    </button>
  );
}

/** The sidebar card and the handle that resizes it; nothing while the sidebar is collapsed. In the macOS app its
 * head is also the title bar: the traffic lights sit in its left padding, and the empty strip drags the window. */
export function WindowSidebar() {
  const { showSidebar, sidebarWidth } = useWindowWidths();
  const setSidebarWidth = useWindowChrome((state) => state.setSidebarWidth);
  if (!showSidebar) return null;
  return (
    <>
      <div className={cn(CARD, SOFT, "w-[var(--sidebar-width,240px)]")} data-testid="sidebar-card">
        <div className={cn("box-border flex h-11 shrink-0 items-center justify-start", TOGGLE_INSET)} data-tauri-drag-region>
          <SidebarToggle />
        </div>
        <StockView name="sidebar" placeholder={<div className="min-h-0 flex-1" />} />
      </div>
      <ResizeHandle edge="left" testId="resize-sidebar" label="Resize sidebar" value={sidebarWidth} min={SIDEBAR_MIN} max={SIDEBAR_MAX}
        defaultValue={SIDEBAR_DEFAULT} onChange={setSidebarWidth} onCommit={(px) => writeWidth(SIDEBAR_KEY, px)} />
    </>
  );
}

/** The main card: its head (the sidebar toggle while the sidebar is collapsed, the tabs, the drawer toggle while the
 * drawer is closed) over the canvas. */
export function WindowMain() {
  const { showSidebar } = useWindowWidths();
  const tools = useWindowChrome((state) => state.tools);
  return (
    <div className={cn(CARD, SOFT, "min-w-0 flex-1")} data-testid="main-card">
      <div className="box-border flex h-11 shrink-0 items-center" data-tauri-drag-region>
        {/* With the sidebar closed, its toggle (and the traffic lights' room) heads the main card. */}
        {!showSidebar && (
          <div className={cn("box-border flex shrink-0 items-center self-stretch", TOGGLE_INSET, TOGGLE_AFTER)} data-tauri-drag-region>
            <SidebarToggle />
          </div>
        )}
        <StockView name="tabs" placeholder={<div className="flex min-w-0 flex-1 self-stretch" />} />
        {!tools && (
          <div className="box-border flex shrink-0 items-center self-stretch pr-2 pl-1" data-testid="workspace-tools-header" data-tauri-drag-region>
            <DrawerToggle />
          </div>
        )}
      </div>
      <main className="dock-area relative flex min-h-0 min-w-0 flex-1">
        <SplitCanvas />
      </main>
    </div>
  );
}

/** The drawer (Files | Git | Browser for the active workspace, or the one a request named) and its resize handle;
 * nothing while it is closed. */
export function WindowDrawer() {
  const { toolsWidth, toolsMax } = useWindowWidths();
  const tools = useWindowChrome((state) => state.tools);
  const toolsWorkspaceId = useWindowChrome((state) => state.toolsWorkspaceId);
  const setTools = useWindowChrome((state) => state.setTools);
  const setToolsWidth = useWindowChrome((state) => state.setToolsWidth);
  if (!tools) return null;
  return (
    <>
      <ResizeHandle edge="right" testId="resize-tools" label="Resize files and Git" value={toolsWidth} min={TOOLS_MIN} max={toolsMax}
        defaultValue={toolsDefault()} onChange={setToolsWidth} onCommit={(px) => writeWidth(TOOLS_KEY, px)} />
      <div className={cn(CARD, SOFT, "w-[var(--tools-width)]")} data-testid="tools-card">
        <div className="box-border flex h-11 shrink-0 items-center justify-between gap-2 px-2" data-testid="workspace-tools-header" data-tauri-drag-region>
          <WorkspaceToolsTabs requestedWorkspaceId={toolsWorkspaceId} tab={tools} onTabChange={setTools} />
          <DrawerToggle />
        </div>
        <WorkspaceTools requestedWorkspaceId={toolsWorkspaceId} tab={tools} />
      </div>
    </>
  );
}

const PARTS = { "window:sidebar": WindowSidebar, "window:main": WindowMain, "window:drawer": WindowDrawer } as const;
/** A stock window part by its layout name (`window:sidebar`, `window:main`, `window:drawer`). */
export function WindowPart({ name }: { name: (typeof STOCK_WINDOW_PARTS)[number] }) {
  const Part = PARTS[name];
  return <Part />;
}

/** Perch as shipped: three full-height cards (sidebar, main, drawer) on --backdrop, each with its own 44px head row. */
export function StockWindow() {
  return (
    <div className={cn("flex min-h-0 flex-1 px-2 pt-2", SOFT)} data-tauri-drag-region>
      {STOCK_WINDOW_PARTS.map((name) => <WindowPart key={name} name={name} />)}
    </div>
  );
}
