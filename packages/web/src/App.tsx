import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { StatusBar } from "./StatusBar";
import { Sidebar } from "./Sidebar";
import { SplitCanvas } from "./components/SplitCanvas";
import { SettingsPage } from "./components/SettingsPage";
import { TabBar } from "./components/TabBar";
import { Navigator } from "./components/Navigator";
import { ContextBridge } from "./components/ContextBridge";
import { CloseAgentGuard } from "./components/CloseAgentGuard";
import { NewSessionDialog } from "./components/NewSessionDialog";
import { KeybindHelp } from "./components/KeybindHelp";
import { Onboarding } from "./components/Onboarding";
import { MacPermissionSetup } from "./components/MacPermissions";
import { hasSeenOnboarding, markOnboardingSeen } from "./onboarding";
import { MobileHeader } from "./components/MobileHeader";
import { MobileSwitcher } from "./components/MobileSwitcher";
import { Toast } from "./components/Toast";
import { useIsMobileWidth } from "./responsive";
import { useLeaderKey } from "./keybinds";
import { usePerchStore } from "./store";
import { MobilePaneShell, type MobilePaneKind } from "./components/MobilePaneShell";
import { LaptopUnreachable, PairingGate } from "./components/PairingGate";
import { ConnectionDetails } from "./components/ConnectionDetails";
import { isPaired } from "./pairing";
import { WorkspaceTools, WorkspaceToolsTabs, type WorkspaceToolsTab } from "./components/WorkspaceTools";
import { ResizeHandle } from "./components/ResizeHandle";
import { cn } from "./lib/cn";
import { useNeedsYouCount } from "./attention";
import "./surfaceSync";
import "./workspaceCleanup";

const TOOLS_STORAGE_KEY = "perch.workspaceTools";
// The Tauri app on macOS draws its traffic lights over the web view's top row.
const MAC_DESKTOP = "__TAURI_INTERNALS__" in window && /Mac/.test(navigator.platform);
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
const SOFT = "[--radius:var(--radius-pane)]";
// The open gutter between two cards is the resize handle (ResizeHandle.tsx); the same 8px
// surrounds the cards at the window edge.
const GUTTER = 8;
// A full-height column of the desktop shell, lifted off the --backdrop (themes.ts `backdropFor`).
const CARD = "flex min-h-0 shrink-0 flex-col overflow-hidden rounded-[12px] bg-[var(--card-bg)]";
const toolsDefault = () => Math.min(760, Math.round(window.innerWidth * 0.46));

// Per-viewer column widths (px), set by dragging the dividers.
const SIDEBAR_KEY = "perch.layout.sidebarWidth";
const TOOLS_KEY = "perch.layout.toolsWidth";
const SIDEBAR_DEFAULT = 240;
const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 480;
const TOOLS_MIN = 280;
const MAIN_MIN = 320;
function readWidth(key: string): number | null {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch { return null; }
}
function writeWidth(key: string, px: number) {
  try { localStorage.setItem(key, String(px)); } catch { /* per-viewer convenience */ }
}

export default function App() {
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [keybindHelpOpen, setKeybindHelpOpen] = useState(false);
  // Wave 2 item 11: first-run onboarding modal. Lazily initialized from
  // localStorage (same rationale as the other overlay booleans here — keep
  // store.ts's diff minimal) so it renders at most once per browser/profile.
  const [onboardingOpen, setOnboardingOpen] = useState(() => !hasSeenOnboarding());
  // Phase 5 (narrow-width collapse): below MOBILE_WIDTH_BREAKPOINT, swap the
  // desktop Sidebar+TabBar/Dockview canvas and StatusBar for MobileHeader,
  // MobileSwitcher and one mounted pane over a bottom bar. Overlay open
  // state lives here, same rationale as navigatorOpen/keybindHelpOpen above.
  const isMobile = useIsMobileWidth();
  const [mobileSwitcherOpen, setMobileSwitcherOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePaneKind>("chat");
  const workspaceFilesWorkspaceId = usePerchStore((state) => state.workspaceFilesWorkspaceId);
  const closeWorkspaceFiles = usePerchStore((state) => state.closeWorkspaceFiles);
  const workspaceGitReviewWorkspaceId = usePerchStore((state) => state.workspaceGitReviewWorkspaceId);
  const closeWorkspaceGitReview = usePerchStore((state) => state.closeWorkspaceGitReview);
  const activeWorkspaceId = usePerchStore((state) => state.activeWorkspaceId);
  // The right drawer (Files | Git | Browser for the active workspace). App state, not
  // part of a session's layout, so it stays put across chats. An old stored
  // "terminal" tab maps to Files.
  const [tools, setTools] = useState<WorkspaceToolsTab | null>(() => {
    try {
      const stored = localStorage.getItem(TOOLS_STORAGE_KEY);
      if (!stored) return null;
      return stored === "gitReview" || stored === "browser" ? stored : "files";
    } catch { return null; }
  });
  const sidebarCollapsed = usePerchStore((state) => state.sidebarCollapsed);
  const toggleSidebar = usePerchStore((state) => state.toggleSidebar);
  // With the sidebar out of sight, chats that need you show as a count on the control that opens it.
  const needsYou = useNeedsYouCount();
  const [sidebarWidthRaw, setSidebarWidth] = useState(() => readWidth(SIDEBAR_KEY) ?? SIDEBAR_DEFAULT);
  const [toolsWidthRaw, setToolsWidth] = useState(() => readWidth(TOOLS_KEY) ?? toolsDefault());
  useEffect(() => {
    try { if (tools) localStorage.setItem(TOOLS_STORAGE_KEY, tools); else localStorage.removeItem(TOOLS_STORAGE_KEY); } catch { /* per-viewer convenience */ }
  }, [tools]);
  const focusWorkspace = usePerchStore((state) => state.focusWorkspace);

  // The toggle reopens the drawer on whichever tab was last shown.
  // The workspace a Files/Git request named. A remote checkout has no local
  // row, so focusing it leaves `activeWorkspaceId` alone; the drawer keeps
  // this id until focus moves.
  const [toolsWorkspaceId, setToolsWorkspaceId] = useState<string | null>(null);
  useEffect(() => setToolsWorkspaceId(null), [activeWorkspaceId]);
  const lastTools = useRef<WorkspaceToolsTab>(tools ?? "files");
  if (tools) lastTools.current = tools;
  // The phone has no drawer: its bottom bar switches panes.
  const toggleTerminal = useCallback(() => {
    if (!isMobile) setTools((tab) => tab ? null : lastTools.current);
  }, [isMobile]);

  // Sidebar Files/Git requests open the drawer on that tab, focused on the
  // requested workspace.
  useEffect(() => {
    const workspaceId = workspaceFilesWorkspaceId ?? workspaceGitReviewWorkspaceId;
    if (isMobile || !workspaceId) return;
    if (workspaceId !== usePerchStore.getState().activeWorkspaceId) focusWorkspace(workspaceId);
    setToolsWorkspaceId(workspaceId);
    setTools(workspaceFilesWorkspaceId ? "files" : "gitReview");
    closeWorkspaceFiles();
    closeWorkspaceGitReview();
  }, [isMobile, workspaceFilesWorkspaceId, workspaceGitReviewWorkspaceId, focusWorkspace, closeWorkspaceFiles, closeWorkspaceGitReview]);

  // Workspace navigation originates in the shared switcher on mobile. The
  // request ids remain in the store so the desktop drawer can consume them when
  // the viewport grows again; the mobile canvas only selects the matching
  // single pane while the narrow layout is active.
  useEffect(() => {
    if (!isMobile) return;
    if (workspaceFilesWorkspaceId) {
      setMobilePane("files");
    } else if (workspaceGitReviewWorkspaceId) {
      setMobilePane("gitReview");
    }
  }, [isMobile, workspaceFilesWorkspaceId, workspaceGitReviewWorkspaceId]);

  // Phase 4 (Keybindings + Navigator): single global keydown listener owning
  // the direct shortcuts, the Ctrl+Space leader chord, Ctrl/Cmd+K, and plain '?'. Overlay open/close
  // state lives here (not in the zustand store) to keep the diff to the
  // shared, high-contention store.ts minimal.
  const openNavigator = useCallback(() => {
    setKeybindHelpOpen(false);
    setNavigatorOpen(true);
  }, []);
  const openKeybindHelp = useCallback(() => {
    setNavigatorOpen(false);
    setKeybindHelpOpen(true);
  }, []);
  useLeaderKey({ openNavigator, openKeybindHelp, toggleDrawer: toggleTerminal });

  // A rejected WebSocket handshake looks exactly like an unreachable host from
  // the browser's side, so ask the host which it is whenever the socket is
  // down. Only an explicit "not paired" replaces the app.
  const connected = usePerchStore((state) => state.connected);
  const [unpaired, setUnpaired] = useState(false);
  useEffect(() => {
    if (connected) {
      setUnpaired(false);
      return;
    }
    let cancelled = false;
    void isPaired().then((paired) => {
      if (!cancelled) setUnpaired(!paired);
    });
    return () => {
      cancelled = true;
    };
  }, [connected]);
  // A phone has no perch of its own: if it has never reached its laptop, say
  // so rather than show an app with nothing behind it. Once it has connected,
  // a later drop keeps the app (the header says "Reconnecting…").
  const [everConnected, setEverConnected] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (connected) {
      setEverConnected(true);
      setGaveUp(false);
      return;
    }
    const timer = setTimeout(() => setGaveUp(true), 6000);
    return () => clearTimeout(timer);
  }, [connected]);
  if (unpaired) return <PairingGate phone={isMobile} onPaired={() => window.location.reload()} />;
  if (isMobile && gaveUp && !everConnected && !connected) return <LaptopUnreachable />;

  const showSidebar = !isMobile && !sidebarCollapsed;
  const sidebarWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, sidebarWidthRaw));
  const toolsMax = Math.max(TOOLS_MIN, window.innerWidth - (showSidebar ? sidebarWidth : 0) - 4 * GUTTER - MAIN_MIN);
  const toolsWidth = Math.min(toolsMax, Math.max(TOOLS_MIN, toolsWidthRaw));

  // The drawer holds Files and Git, so its toggle is a right-panel glyph.
  const terminalButton = (
    <button
      type="button"
      className={ICON_BUTTON}
      title="Files and Git for this workspace"
      aria-label="Files and Git"
      data-testid="workspace-tools-toggle"
      aria-pressed={tools !== null}
      onClick={toggleTerminal}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
        <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
        <path d="M10 2.5v11" />
      </svg>
    </button>
  );

  const sidebarToggle = (
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

  return (
    <div
      className={"app" + (isMobile ? " app--mobile" : " app--cards") + (MAC_DESKTOP ? " app--mac-desktop" : "")}
      style={{ "--sidebar-width": `${sidebarWidth}px`, "--tools-width": `${toolsWidth}px` } as CSSProperties}
    >
      {isMobile && <MobileHeader onOpenSwitcher={() => setMobileSwitcherOpen(true)} />}

      {!connected && !MAC_DESKTOP && <div className="shrink-0 px-4"><ConnectionDetails /></div>}
      {isMobile ? (
        <div className="flex min-h-0 flex-1">
          <main className="dock-area relative flex min-h-0 min-w-0 flex-1">
            <MobilePaneShell
              activePane={mobilePane}
              workspaceFilesWorkspaceId={workspaceFilesWorkspaceId}
              workspaceGitReviewWorkspaceId={workspaceGitReviewWorkspaceId}
              onPaneChange={setMobilePane}
              onCloseFiles={closeWorkspaceFiles}
              onCloseGitReview={closeWorkspaceGitReview}
            />
          </main>
        </div>
      ) : (
        // Three full-height cards (sidebar, main, drawer) on --backdrop. Each card carries
        // its own 44px head row: the sidebar toggle, the tabs, the drawer's Files/Git switch.
        // In the macOS app the sidebar card's head is also the title bar: the traffic lights
        // sit in its left padding, and the empty strips drag the window (perch-desktop glass.rs).
        <div className={cn("flex min-h-0 flex-1 px-2 pt-2", SOFT)} data-tauri-drag-region>
          {showSidebar && (
            <div className={cn(CARD, "w-[var(--sidebar-width,240px)]")} data-testid="sidebar-card">
              <div className={cn("box-border flex h-11 shrink-0 items-center justify-start", TOGGLE_INSET)} data-tauri-drag-region>
                {sidebarToggle}
              </div>
              <Sidebar />
            </div>
          )}
          {showSidebar && (
            <ResizeHandle
              edge="left"
              testId="resize-sidebar"
              label="Resize sidebar"
              value={sidebarWidth}
              min={SIDEBAR_MIN}
              max={SIDEBAR_MAX}
              defaultValue={SIDEBAR_DEFAULT}
              onChange={setSidebarWidth}
              onCommit={(px) => writeWidth(SIDEBAR_KEY, px)}
            />
          )}
          <div className={cn(CARD, "min-w-0 flex-1")} data-testid="main-card">
            <div className="box-border flex h-11 shrink-0 items-center" data-tauri-drag-region>
              {/* With the sidebar closed, its toggle (and the traffic lights' room) heads the main card. */}
              {!showSidebar && (
                <div className={cn("box-border flex shrink-0 items-center self-stretch", TOGGLE_INSET, TOGGLE_AFTER)} data-tauri-drag-region>
                  {sidebarToggle}
                </div>
              )}
              <TabBar />
              {!tools && (
                <div className="box-border flex shrink-0 items-center self-stretch pr-2 pl-1" data-testid="workspace-tools-header" data-tauri-drag-region>
                  {terminalButton}
                </div>
              )}
            </div>
            <main className="dock-area relative flex min-h-0 min-w-0 flex-1">
              <SplitCanvas />
            </main>
          </div>
          {tools && (
            <ResizeHandle
              edge="right"
              testId="resize-tools"
              label="Resize files and Git"
              value={toolsWidth}
              min={TOOLS_MIN}
              max={toolsMax}
              defaultValue={toolsDefault()}
              onChange={setToolsWidth}
              onCommit={(px) => writeWidth(TOOLS_KEY, px)}
            />
          )}
          {tools && (
            <div className={cn(CARD, "w-[var(--tools-width)]")} data-testid="tools-card">
              <div className="box-border flex h-11 shrink-0 items-center justify-between gap-2 px-2" data-testid="workspace-tools-header" data-tauri-drag-region>
                <WorkspaceToolsTabs requestedWorkspaceId={toolsWorkspaceId} tab={tools} onTabChange={setTools} />
                {terminalButton}
              </div>
              <WorkspaceTools requestedWorkspaceId={toolsWorkspaceId} tab={tools} />
            </div>
          )}
        </div>
      )}

      {!isMobile && <StatusBar />}
      <SettingsPage />
      <MacPermissionSetup enabled={!onboardingOpen} />
      <Navigator open={navigatorOpen} onClose={() => setNavigatorOpen(false)} />
      <NewSessionDialog />
      <KeybindHelp open={keybindHelpOpen} onClose={() => setKeybindHelpOpen(false)} />
      <CloseAgentGuard />
      <ContextBridge />
      {isMobile && (
        <MobileSwitcher open={mobileSwitcherOpen} onClose={() => setMobileSwitcherOpen(false)} onPicked={() => setMobilePane("chat")} />
      )}
      <Toast />
      {onboardingOpen && (
        <Onboarding
          onDismiss={() => {
            markOnboardingSeen();
            setOnboardingOpen(false);
          }}
        />
      )}
    </div>
  );
}
