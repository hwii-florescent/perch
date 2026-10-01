import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBar } from "./StatusBar";
import { Sidebar } from "./Sidebar";
import { DockviewShell } from "./dockview/DockviewShell";
import { SettingsModal } from "./components/SettingsModal";
import { TabBar } from "./components/TabBar";
import { Navigator } from "./components/Navigator";
import { KeybindHelp } from "./components/KeybindHelp";
import { Onboarding } from "./components/Onboarding";
import { hasSeenOnboarding, markOnboardingSeen } from "./onboarding";
import { MobileHeader } from "./components/MobileHeader";
import { MobileSwitcher } from "./components/MobileSwitcher";
import { Toast } from "./components/Toast";
import { useIsMobileWidth } from "./responsive";
import { useLeaderKey } from "./keybinds";
import { usePerchStore } from "./store";
import { MobilePaneShell, type MobilePaneKind } from "./components/MobilePaneShell";
import { PairingGate } from "./components/PairingGate";
import { isPaired } from "./pairing";
import { WorkspaceTools, type WorkspaceToolsTab } from "./components/WorkspaceTools";

const TOOLS_STORAGE_KEY = "perch.workspaceTools";
// The Tauri app on macOS draws its traffic lights over the web view's top row.
const MAC_DESKTOP = "__TAURI_INTERNALS__" in window && /Mac/.test(navigator.platform);

export default function App() {
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [keybindHelpOpen, setKeybindHelpOpen] = useState(false);
  // Wave 2 item 11: first-run onboarding modal. Lazily initialized from
  // localStorage (same rationale as the other overlay booleans here — keep
  // store.ts's diff minimal) so it renders at most once per browser/profile.
  const [onboardingOpen, setOnboardingOpen] = useState(() => !hasSeenOnboarding());
  // Phase 5 (narrow-width collapse): below MOBILE_WIDTH_BREAKPOINT, swap the
  // desktop Sidebar+TabBar/Dockview canvas for MobileHeader+MobileSwitcher
  // and one mounted pane. StatusBar stays mounted either way. Overlay open
  // state lives here, same rationale as navigatorOpen/keybindHelpOpen above.
  const isMobile = useIsMobileWidth();
  const [mobileSwitcherOpen, setMobileSwitcherOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePaneKind>("chat");
  const workspaceFilesWorkspaceId = usePerchStore((state) => state.workspaceFilesWorkspaceId);
  const closeWorkspaceFiles = usePerchStore((state) => state.closeWorkspaceFiles);
  const workspaceGitReviewWorkspaceId = usePerchStore((state) => state.workspaceGitReviewWorkspaceId);
  const closeWorkspaceGitReview = usePerchStore((state) => state.closeWorkspaceGitReview);
  const activeWorkspaceId = usePerchStore((state) => state.activeWorkspaceId);
  // The ›_ drawer (Terminal | Files | Git for the active workspace). App
  // state, not part of a session's layout, so it stays put across chats.
  const [tools, setTools] = useState<WorkspaceToolsTab | null>(() => {
    try { return localStorage.getItem(TOOLS_STORAGE_KEY) as WorkspaceToolsTab | null; } catch { return null; }
  });
  useEffect(() => {
    try { if (tools) localStorage.setItem(TOOLS_STORAGE_KEY, tools); else localStorage.removeItem(TOOLS_STORAGE_KEY); } catch { /* per-viewer convenience */ }
  }, [tools]);
  const focusWorkspace = usePerchStore((state) => state.focusWorkspace);

  // The toggle reopens the drawer on whichever tab was last shown.
  const lastTools = useRef<WorkspaceToolsTab>(tools ?? "terminal");
  if (tools) lastTools.current = tools;
  const toggleTerminal = useCallback(() => {
    if (isMobile) setMobilePane((pane) => pane === "terminal" ? "chat" : "terminal");
    else setTools((tab) => tab ? null : lastTools.current);
  }, [isMobile]);

  // Sidebar Files/Git requests open the drawer on that tab, focused on the
  // requested workspace.
  useEffect(() => {
    const workspaceId = workspaceFilesWorkspaceId ?? workspaceGitReviewWorkspaceId;
    if (isMobile || !workspaceId) return;
    if (workspaceId !== usePerchStore.getState().activeWorkspaceId) focusWorkspace(workspaceId);
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
  // the Ctrl+Space leader chord, Ctrl/Cmd+K, and plain '?'. Overlay open/close
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
  useLeaderKey({ openNavigator, openKeybindHelp });

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
  if (unpaired) return <PairingGate onPaired={() => window.location.reload()} />;

  // Desktop: the drawer holds Terminal, Files and Git, so its toggle is a
  // right-panel glyph. The phone's button still opens just the terminal.
  const terminalButton = isMobile ? (
    <button
      type="button"
      className="toolbar__button"
      title="Open terminal"
      aria-label="Open terminal"
      aria-pressed={mobilePane === "terminal"}
      onClick={toggleTerminal}
    >
      {"›_"}
    </button>
  ) : (
    <button
      type="button"
      className="toolbar__button toolbar__button--icon"
      title="Workspace tools: terminal, files, Git"
      aria-label="Workspace tools"
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

  return (
    <div className={"app" + (isMobile ? " app--mobile" : "") + (MAC_DESKTOP ? " app--mac-desktop" : "")}>
      {isMobile ? (
        <>
          <div className="toolbar">{terminalButton}</div>
          <MobileHeader onOpenSwitcher={() => setMobileSwitcherOpen(true)} />
        </>
      ) : (
        // One row for tabs and ›_ (Orca). In the macOS app it is also the
        // title bar: the traffic lights sit in its left padding and empty
        // space drags the window (crates/perch-desktop/src/main.rs).
        <div className="toolbar toolbar--tabs" data-tauri-drag-region>
          <TabBar />
          {terminalButton}
        </div>
      )}

      <div className="app__body">
        {!isMobile && <Sidebar />}
        <main className="dock-area">
          {isMobile ? (
            <MobilePaneShell
              activePane={mobilePane}
              workspaceFilesWorkspaceId={workspaceFilesWorkspaceId}
              workspaceGitReviewWorkspaceId={workspaceGitReviewWorkspaceId}
              fallbackWorkspaceId={activeWorkspaceId}
              onPaneChange={setMobilePane}
              onCloseFiles={closeWorkspaceFiles}
              onCloseGitReview={closeWorkspaceGitReview}
            />
          ) : <DockviewShell />}
        </main>
        {!isMobile && tools && <WorkspaceTools tab={tools} onTabChange={setTools} onClose={() => setTools(null)} />}
      </div>

      <StatusBar />
      <SettingsModal />
      <Navigator open={navigatorOpen} onClose={() => setNavigatorOpen(false)} />
      <KeybindHelp open={keybindHelpOpen} onClose={() => setKeybindHelpOpen(false)} />
      {isMobile && (
        <MobileSwitcher open={mobileSwitcherOpen} onClose={() => setMobileSwitcherOpen(false)} />
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
