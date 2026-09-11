import { useCallback, useEffect, useRef, useState } from "react";
import type { DockviewApi } from "dockview-react";
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
import { ConfirmDialog } from "./components/ConfirmDialog";
import { useIsMobileWidth } from "./responsive";
import { useLeaderKey } from "./keybinds";
import { getDockviewController } from "./dockview/dockviewController";
import { usePerchStore } from "./store";
import { MobilePaneShell, type MobilePaneKind } from "./components/MobilePaneShell";

export default function App() {
  const apiRef = useRef<DockviewApi | null>(null);
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
  // Mirrors the live dockview terminal-open state so the toolbar button can
  // render pressed/unpressed — see the onDidLayoutChange subscription below.
  // The actual toggle decision itself is always made from live panel state
  // (via the controller), not this mirror, so it can never drift out of sync
  // with reality (e.g. a terminal tab closed via its own close button, or via
  // the pane context menu, still flips this back correctly).
  const [terminalOpen, setTerminalOpen] = useState(false);
  // Wave 1 item 6: when the toolbar toggle is about to close a terminal
  // *group* holding more than one terminal tab, confirm first (closing a
  // single terminal stays a one-click, unconfirmed action). Holds the
  // count to show in the dialog, or null when no confirmation is pending.
  const [confirmCloseTerminals, setConfirmCloseTerminals] = useState<number | null>(null);

  const handleReady = useCallback((api: DockviewApi) => {
    apiRef.current = api;
    const controller = getDockviewController();
    setTerminalOpen(controller?.hasTerminalOpen() ?? false);
    api.onDidLayoutChange(() => {
      setTerminalOpen(getDockviewController()?.hasTerminalOpen() ?? false);
    });
  }, []);

  const toggleTerminal = useCallback(() => {
    if (isMobile) {
      setMobilePane((pane) => pane === "terminal" ? "chat" : "terminal");
      return;
    }
    const controller = getDockviewController();
    if (!controller) return;
    if (controller.hasTerminalOpen()) {
      const count = controller.terminalPanelCount();
      if (count > 1) {
        setConfirmCloseTerminals(count);
        return;
      }
    }
    controller.toggleTerminalGroup();
  }, [isMobile]);

  // Workspace navigation originates in the shared switcher on mobile. The
  // request ids remain in the store so desktop Dockview can consume them when
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

  return (
    <div className={"app" + (isMobile ? " app--mobile" : "")}>
      <div className="toolbar">
        <button
          type="button"
          className="toolbar__button"
          title="Open terminal"
          aria-label="Open terminal"
          aria-pressed={isMobile ? mobilePane === "terminal" : terminalOpen}
          onClick={toggleTerminal}
        >
          {"›_"}
        </button>
      </div>

      {isMobile ? (
        <MobileHeader onOpenSwitcher={() => setMobileSwitcherOpen(true)} />
      ) : (
        <TabBar />
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
          ) : <DockviewShell onReady={handleReady} />}
        </main>
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
      {confirmCloseTerminals !== null && (
        <ConfirmDialog
          message={`Close ${confirmCloseTerminals} terminals?`}
          confirmLabel="Close"
          onConfirm={() => {
            setConfirmCloseTerminals(null);
            getDockviewController()?.toggleTerminalGroup();
          }}
          onCancel={() => setConfirmCloseTerminals(null)}
        />
      )}
    </div>
  );
}
