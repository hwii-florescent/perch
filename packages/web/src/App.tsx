import { useCallback, useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { LayoutRoot } from "./components/LayoutRoot";
import { activeLayout, currentMods, subscribeMods } from "./mods";
import { SettingsPage } from "./components/SettingsPage";
import { Navigator } from "./components/Navigator";
import { ContextBridge } from "./components/ContextBridge";
import { ModsHost } from "./components/ModsHost";
import { CloseAgentGuard } from "./components/CloseAgentGuard";
import { NewSessionDialog } from "./components/NewSessionDialog";
import { StockView } from "./components/mod-root";
import { Onboarding } from "./components/Onboarding";
import { MacPermissionSetup } from "./components/MacPermissions";
import { hasSeenOnboarding, markOnboardingSeen } from "./onboarding";
import { MobileHeader } from "./components/MobileHeader";
import { MobileSwitcher } from "./components/MobileSwitcher";
import { Toast } from "./components/Toast";
import { useIsMobileWidth } from "./responsive";
import { SHORTCUTS, bindableCombo, dispatchShortcut, registerCommand, shortcutLabel, useLeaderKey } from "./keybinds";
import { setCommandBridge } from "./modApp";
import { setWindowOwner } from "./modUi";
import { TYPED_COMMANDS } from "./modCommands";
import { installKeysFile } from "./keysFile";
import { usePerchStore } from "./store";
import { useFileTabs } from "./fileTabs";
import { MobilePaneShell, type MobilePaneKind } from "./components/MobilePaneShell";
import { LaptopUnreachable, PairingGate } from "./components/PairingGate";
import { ConnectionDetails } from "./components/ConnectionDetails";
import { isPaired } from "./pairing";
import { MAC_DESKTOP, StockWindow, useWindowChrome, useWindowWidths } from "./components/StockWindow";
import { isRelayMode } from "./relay/transport";
import { setPhoneMods } from "./phoneMods";
import "./surfaceSync";
import "./workspaceCleanup";
// `@perch/sdk`, before anything renders a package (stock screens, clones, other mods); see main.tsx.
import "./sdk";

export default function App() {
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [keybindHelpOpen, setKeybindHelpOpen] = useState(false);
  // Wave 2 item 11: first-run onboarding modal. Lazily initialized from
  // localStorage (same rationale as the other overlay booleans here — keep
  // store.ts's diff minimal) so it renders at most once per browser/profile.
  const [onboardingOpen, setOnboardingOpen] = useState(() => !hasSeenOnboarding());
  // On a phone (`responsive.ts`: narrow, sideways, or through a relay), swap the desktop Sidebar+TabBar/Dockview canvas
  // and StatusBar for MobileHeader (sidebar button, session, tools button), the sidebar drawer (MobileSwitcher) and
  // the session with the Files/Git drawer over it (`mobilePane`: "chat" is the drawer closed). Overlay open state
  // lives here, same rationale as navigatorOpen/keybindHelpOpen above.
  const isMobile = useIsMobileWidth();
  const [mobileSwitcherOpen, setMobileSwitcherOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePaneKind>("chat");
  // The header's tools button: the drawer opens on the explorer, never on a file left open earlier (a file is put away
  // with its own sheet's × or pull; opening the tools starts from the tree).
  const openTools = useCallback(() => { useFileTabs.getState().showSession(); setMobilePane("files"); }, []);
  const workspaceFilesWorkspaceId = usePerchStore((state) => state.workspaceFilesWorkspaceId);
  const closeWorkspaceFiles = usePerchStore((state) => state.closeWorkspaceFiles);
  const workspaceGitReviewWorkspaceId = usePerchStore((state) => state.workspaceGitReviewWorkspaceId);
  const closeWorkspaceGitReview = usePerchStore((state) => state.closeWorkspaceGitReview);
  const activeWorkspaceId = usePerchStore((state) => state.activeWorkspaceId);
  // The right drawer (Files | Git | Browser for the active workspace) and the column widths: the stock window's
  // parts share them (`StockWindow.tsx`), wherever a layout puts those parts. App state, not part of a session's
  // layout, so it stays put across chats.
  const { sidebarWidth, toolsWidth } = useWindowWidths();
  const focusWorkspace = usePerchStore((state) => state.focusWorkspace);

  // The workspace a Files/Git request named. A remote checkout has no local
  // row, so focusing it leaves `activeWorkspaceId` alone; the drawer keeps
  // this id until focus moves.
  useEffect(() => useWindowChrome.getState().setToolsWorkspaceId(null), [activeWorkspaceId]);
  // The phone's drawer is its own (`mobilePane`); the toggle is the desktop's.
  const toggleTerminal = useCallback(() => {
    if (!isMobile) useWindowChrome.getState().toggleDrawer();
  }, [isMobile]);

  // Sidebar Files/Git requests open the drawer on that tab, focused on the
  // requested workspace.
  useEffect(() => {
    const workspaceId = workspaceFilesWorkspaceId ?? workspaceGitReviewWorkspaceId;
    if (isMobile || !workspaceId) return;
    if (workspaceId !== usePerchStore.getState().activeWorkspaceId) focusWorkspace(workspaceId);
    const chrome = useWindowChrome.getState();
    chrome.setToolsWorkspaceId(workspaceId);
    chrome.setTools(workspaceFilesWorkspaceId ? "files" : "gitReview");
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
  useEffect(() => installKeysFile(), []); // keys.json
  // Mods run the same commands a key does.
  useEffect(() => {
    setCommandBridge({
      list: () => [
        ...SHORTCUTS.map(({ id, description, conflict }) => {
          const keys = shortcutLabel(id);
          return { id, description, ...(keys ? { keys } : conflict ? { conflict } : {}) };
        }),
        ...Object.entries(TYPED_COMMANDS).map(([id, { description, args }]) => ({ id, description, args })),
      ],
      run: (command, args) => {
        const typed = TYPED_COMMANDS[command];
        if (typed) return typed.run(args), true;
        const own = SHORTCUTS.find((s) => s.id === command)?.runWith;
        if (own) return own(args), true;
        return dispatchShortcut(command, { openNavigator, openKeybindHelp, toggleDrawer: toggleTerminal });
      },
      register: registerCommand,
      keys: () => SHORTCUTS.flatMap((s) => { const label = shortcutLabel(s.id); return label ? [{ command: s.id, keys: label }] : []; }),
      bind: (command, keys) => {
        if (keys && !bindableCombo(keys)) throw new Error(`"${keys}" cannot be bound: it is reserved or has no modifier.`);
        const next = { ...usePerchStore.getState().settings?.keybindings };
        if (keys === null) delete next[command];
        else next[command] = keys;
        usePerchStore.getState().updateSettings({ keybindings: next });
      },
    });
  }, [openNavigator, openKeybindHelp, toggleTerminal]);

  // A rejected WebSocket handshake looks exactly like an unreachable host from
  // the browser's side, so ask the host which it is whenever the socket is
  // down. Only an explicit "not paired" replaces the app.
  const connected = usePerchStore((state) => state.connected);
  const [unpaired, setUnpaired] = useState(false);
  // A phone that lost its pairing (revoked on the computer) forgets that it ran the person's phone screens: a new
  // pairing starts with Perch's own (`phoneMods.ts`).
  useEffect(() => {
    if (unpaired) setPhoneMods(false);
  }, [unpaired]);
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
  // Read before the early returns below: a hook after them changes the hook count when pairing or reachability flips.
  // A chosen layout (a mod's doing) replaces the stock cards; none, or one that stops parsing, is stock.
  const modsState = useSyncExternalStore(subscribeMods, currentMods);
  // A page reached through a relay is a phone, however wide: it never draws the desktop's chosen layout.
  const layout = isRelayMode() ? null : activeLayout(modsState);
  // Kept mod windows belong to the layout shown (`modUi.ts`): they follow it once the core has said which it is. Not on
  // a phone, whose screens are its own.
  useEffect(() => { if (modsState && !isMobile) setWindowOwner(layout?.id ?? ""); }, [modsState, isMobile, layout?.id]);
  if (unpaired) return <PairingGate phone={isMobile} onPaired={() => window.location.reload()} />;
  if (isMobile && gaveUp && !everConnected && !connected) return <LaptopUnreachable />;

  return (
    <div
      className={"app" + (isMobile ? " app--mobile" : " app--cards") + (MAC_DESKTOP ? " app--mac-desktop" : "")}
      style={{ "--sidebar-width": `${sidebarWidth}px`, "--tools-width": `${toolsWidth}px` } as CSSProperties}
    >
      {!connected && !MAC_DESKTOP && <div className="shrink-0 px-4"><ConnectionDetails /></div>}
      {isMobile ? (
        // The phone is one main card on the backdrop, as the desktop's three are: 12px, the card color, 8px in from the
        // window edge, a 44px head row (`stock:mobile-header`) over the session (`stock:mobile-panes`).
        <div className="flex min-h-0 flex-1 pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] [--radius:var(--radius-pane)]">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[12px] bg-[var(--card-bg)]" data-testid="mobile-card">
            <MobileHeader onOpenSwitcher={() => setMobileSwitcherOpen(true)} onOpenTools={openTools} />
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
        </div>
      ) : layout?.root ? (
        <LayoutRoot root={layout.root} />
      ) : (
        // Perch as shipped, drawn by the recovery shell from the stock window's parts (`StockWindow.tsx`, the same
        // parts as the stock layout `stock:main`, whose copies a person edits).
        <StockWindow />
      )}

      {!isMobile && !layout && <StockView name="status" placeholder={<div className="h-6 shrink-0" />} />}
      <SettingsPage />
      <MacPermissionSetup enabled={!onboardingOpen} />
      <Navigator open={navigatorOpen} onClose={() => setNavigatorOpen(false)} />
      <NewSessionDialog />
      {keybindHelpOpen && <StockView name="keybind-help" props={{ open: true, onClose: () => setKeybindHelpOpen(false) }} />}
      <CloseAgentGuard />
      <ContextBridge />
      <ModsHost />
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
