/**
 * MobileSwitcher.tsx — the phone's sidebar, a slide-over from the left. The screen is `stock:mobile-switcher` (`stock-ui/mobile-switcher/`), or the
 * person's copy once turned on for this phone (`phoneMods.ts`); this file keeps the plan-usage poller (mounted for the
 * whole phone session, which has no status bar) and hands the screen the sidebar's own body (`SidebarContent` from
 * `stock:sidebar`'s source, compiled in: the desktop's sidebar choice never reaches a phone) and the usage line.
 * Choosing a session or workspace closes the panel; `onPicked` fires for that (not on a plain close), so the shell can
 * show the session pane. Settings and the phone's own UI/CLI view are at its foot.
 */
import type { MobileSwitcherProps as Props } from "@perch/sdk";
import { UsageSummary } from "../stock-ui/status/usage";
import { usePlanUsage } from "../sdk";
import { SidebarContent } from "../stock-ui/sidebar/content";
import Switcher from "../stock-ui/mobile-switcher/main";
import { StockRoute } from "./mod-root";
import { useChatMode, useSetChatMode } from "../chatMode";
import { usePerchStore } from "../store";

export interface MobileSwitcherProps {
  open: boolean;
  onClose: () => void;
  onPicked?: () => void;
}

export function MobileSwitcher({ open, onClose, onPicked }: MobileSwitcherProps) {
  // Mounted for the whole phone session and the status bar is not, so this is the one usage poller there.
  const { usage, updatedAt: usageUpdatedAt } = usePlanUsage({ keepFresh: true });
  const chatMode = useChatMode();
  const setChatMode = useSetChatMode();
  const setSettingsOpen = usePerchStore((s) => s.setSettingsOpen);

  if (!open) return null;

  function picked() {
    onClose();
    onPicked?.();
  }

  const props: Props = {
    body: <SidebarContent compact onNavigate={picked} onManageHosts={onClose} />,
    usage: <UsageSummary usage={usage} updatedAt={usageUpdatedAt} />,
    chatMode,
    onChatMode: setChatMode,
    onOpenSettings: () => { onClose(); setSettingsOpen(true); },
    onClose,
    onPicked: picked,
  };
  return <StockRoute name="mobile-switcher" props={props} stock={Switcher} />;
}
