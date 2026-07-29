import { useCallback, useRef, useState } from "react";
import type { DockviewApi } from "dockview-react";
import { StatusBar } from "./StatusBar";
import { Sidebar } from "./Sidebar";
import { DockviewShell } from "./dockview/DockviewShell";
import { SettingsModal } from "./components/SettingsModal";
import { TabBar } from "./components/TabBar";
import { Navigator } from "./components/Navigator";
import { KeybindHelp } from "./components/KeybindHelp";
import { MobileHeader } from "./components/MobileHeader";
import { MobileSwitcher } from "./components/MobileSwitcher";
import { Toast } from "./components/Toast";
import { useIsMobileWidth } from "./responsive";
import { useLeaderKey } from "./keybinds";

function newPanelId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `terminal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function App() {
  const apiRef = useRef<DockviewApi | null>(null);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [keybindHelpOpen, setKeybindHelpOpen] = useState(false);
  // Phase 5 (narrow-width collapse): below MOBILE_WIDTH_BREAKPOINT, swap the
  // desktop Sidebar+TabBar chrome for MobileHeader+MobileSwitcher. The
  // dockview area and StatusBar stay mounted unchanged either way. Overlay
  // open state lives here, same rationale as navigatorOpen/keybindHelpOpen
  // above (keep store.ts's diff minimal).
  const isMobile = useIsMobileWidth();
  const [mobileSwitcherOpen, setMobileSwitcherOpen] = useState(false);

  const handleReady = useCallback((api: DockviewApi) => {
    apiRef.current = api;
  }, []);

  const openTerminal = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    api.addPanel({
      id: newPanelId(),
      component: "terminal",
      title: "Terminal",
      position: { referencePanel: "chat", direction: "below" },
    });
  }, []);

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
          onClick={openTerminal}
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
          <DockviewShell onReady={handleReady} />
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
    </div>
  );
}
