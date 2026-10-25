import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { StatusBar } from "./StatusBar";
import { Sidebar } from "./Sidebar";
import { SplitCanvas } from "./components/SplitCanvas";
import { SettingsPage } from "./components/SettingsPage";
import { TabBar } from "./components/TabBar";
import { Navigator } from "./components/Navigator";
import { ContextBridge } from "./components/ContextBridge";
import { CloseAgentGuard } from "./components/CloseAgentGuard";
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
import { isPaired } from "./pairing";
import { WorkspaceTools, WorkspaceToolsTabs, type WorkspaceToolsTab } from "./components/WorkspaceTools";
import { ResizeHandle } from "./components/ResizeHandle";
import { cn } from "./lib/cn";
import "./attention";
import "./surfaceSync";
import "./workspaceCleanup";

const TOOLS_STORAGE_KEY = "perch.workspaceTools";
// The Tauri app on macOS draws its traffic lights over the web view's top row.
const MAC_DESKTOP = "__TAURI_INTERNALS__" in window && /Mac/.test(navigator.platform);
// The sidebar and drawer toggles blend into the top row and fill only on hover.
const ICON_BUTTON = "inline-flex size-7 shrink-0 items-center justify-center rounded-ui border border-transparent bg-transparent p-0 text-[0.9rem] leading-none text-subtext-0 [font-family:inherit] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg";
// Soft corners for the desktop chrome: every `rounded-ui` inside follows --radius-pane (base.css).
const SOFT = "[--radius:var(--radius-pane)]";
// The open gutter between a column and the canvas is the column's resize handle (ResizeHandle.tsx).
const GUTTER = 8;
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
  const toolsMax = Math.max(TOOLS_MIN, window.innerWidth - (showSidebar ? sidebarWidth : 0) - 2 * GUTTER - MAIN_MIN);
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
      className={ICON_BUTTON}
      title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      data-testid="sidebar-collapse-toggle"
      aria-pressed={!sidebarCollapsed}
      onClick={toggleSidebar}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
        <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
        <path d="M6 2.5v11" />
      </svg>
    </button>
  );

  return (
    <div
      className={"app" + (isMobile ? " app--mobile" : "") + (MAC_DESKTOP ? " app--mac-desktop" : "")}
      style={{ "--sidebar-width": `${sidebarWidth}px`, "--tools-width": `${toolsWidth}px` } as CSSProperties}
    >
      {isMobile ? (
        <MobileHeader onOpenSwitcher={() => setMobileSwitcherOpen(true)} />
      ) : (
        // One row (Orca): the sidebar toggle above the sidebar, tabs, then the
        // drawer's header column. No rules: the column widths equal the sidebar
        // and drawer widths below. In the macOS app it is also the title bar: the
        // traffic lights sit in the first column's left padding and empty space
        // drags the window (crates/perch-desktop/src/main.rs).
        <div className={cn("box-border flex h-10 shrink-0 items-center bg-panel-bg", SOFT)} data-tauri-drag-region>
          <div
            className={cn(
              "box-border flex shrink-0 items-center self-stretch pr-2",
              MAC_DESKTOP ? "pl-[78px]" : "pl-3",
              !sidebarCollapsed && "w-[var(--sidebar-width,240px)]",
            )}
            data-tauri-drag-region
          >
            {sidebarToggle}
          </div>
          <TabBar />
          {/* With the drawer open, its Files/Git switch heads a column as wide as the drawer. */}
          {tools ? (
            <div
              className="box-border flex w-[var(--tools-width)] shrink-0 items-center justify-between gap-2 self-stretch px-2"
              data-testid="workspace-tools-header"
              data-tauri-drag-region
            >
              <WorkspaceToolsTabs requestedWorkspaceId={toolsWorkspaceId} tab={tools} onTabChange={setTools} />
              {terminalButton}
            </div>
          ) : (
            <div className="box-border flex shrink-0 items-center self-stretch pr-2 pl-1" data-testid="workspace-tools-header" data-tauri-drag-region>
              {terminalButton}
            </div>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {showSidebar && <Sidebar />}
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
        {/* The canvas floats in the shell: 8px gutters at its sides (the resize handles, or a
            margin where a column is closed) and 6px below, so its rounded panes have room. */}
        <main className={cn("dock-area relative flex min-h-0 min-w-0 flex-1", !isMobile && "mb-[6px]", !isMobile && !showSidebar && "ml-2", !isMobile && !tools && "mr-2")}>
          {isMobile ? (
            <MobilePaneShell
              activePane={mobilePane}
              workspaceFilesWorkspaceId={workspaceFilesWorkspaceId}
              workspaceGitReviewWorkspaceId={workspaceGitReviewWorkspaceId}
              onPaneChange={setMobilePane}
              onCloseFiles={closeWorkspaceFiles}
              onCloseGitReview={closeWorkspaceGitReview}
            />
          ) : (
            <>
              <SplitCanvas />
            </>
          )}
        </main>
        {!isMobile && tools && (
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
        {!isMobile && tools && <WorkspaceTools requestedWorkspaceId={toolsWorkspaceId} tab={tools} />}
      </div>

      {!isMobile && <StatusBar />}
      <SettingsPage />
      <MacPermissionSetup enabled={!onboardingOpen} />
      <Navigator open={navigatorOpen} onClose={() => setNavigatorOpen(false)} />
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
