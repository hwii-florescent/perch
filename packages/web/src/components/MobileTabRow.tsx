/**
 * MobileTabRow.tsx — the phone's tab row under its header: the shown workspace's tabs as the desktop's strip has them
 * (sessions, files, review; the core shares them, `sharedTabs.ts`), scrolling sideways. Browser tabs are left out for
 * now: the phone has no browser pane, so one is never shown here nor kept as the phone's active tab (the desktop keeps
 * them in the shared tabs). A tap shows the tab on this phone only: the session, a file in the Files sheet, the review
 * in the Git pane.
 * Nothing it does on a tap reaches another device. Holding a tab offers its close, which is shared as the desktop's ×
 * is (a session's close goes through the same guard, `closeGuard.ts`). Drawn only with two tabs or more.
 */
import { useEffect, useRef, useState } from "react";
import type { MobilePaneKind } from "@perch/sdk";
import { usePerchStore } from "../store";
import { fileTabKey, useFileTabs } from "../fileTabs";
import { useTabOrderVersion } from "../tabOrder";
import { activeTabId, entryLabel, workspaceTabs, type TabEntry } from "../workspaceTabs";
import { requestCloseSession } from "../closeGuard";
import { segment } from "./ui/segment";
import { TAP_BUTTON } from "./ui/glass";
import { cn } from "../lib/cn";

const HOLD_MS = 500;

/** Show `entry` on this phone; `onPane` picks the phone's pane (session, Files, Git). */
export function showOnPhone(entry: TabEntry, onPane: (pane: MobilePaneKind) => void): void {
  const files = useFileTabs.getState();
  if (entry.kind === "session") {
    files.showSession();
    usePerchStore.getState().switchSession(entry.id);
    return onPane("chat");
  }
  const tab = entry.tab;
  if (tab.kind === "review") {
    files.showSession();
    return onPane("gitReview");
  }
  if (tab.kind === "browser") return;
  files.open(tab.workspaceId, tab.path, tab.kind, tab.scope);
  onPane("files");
}

function close(entry: TabEntry): void {
  if (entry.kind === "session") requestCloseSession(entry.id);
  else useFileTabs.getState().close(fileTabKey(entry.tab));
}

export function MobileTabRow({ onPane }: { onPane: (pane: MobilePaneKind) => void }) {
  // What the strip is made of; the rest of the store's changes do not redraw the row.
  usePerchStore((s) => s.sessions);
  usePerchStore((s) => s.sessionId);
  usePerchStore((s) => s.activeWorkspaceId);
  usePerchStore((s) => s.workspaces);
  usePerchStore((s) => s.workspaceOrderByHost);
  usePerchStore((s) => s.activeProject);
  const tabs = useFileTabs((s) => s.tabs);
  const active = useFileTabs((s) => s.active);
  useTabOrderVersion();
  const [armed, setArmed] = useState<string | null>(null);
  const hold = useRef<{ timer: ReturnType<typeof setTimeout>; held: boolean } | null>(null);
  const state = usePerchStore.getState();
  const entries = workspaceTabs(state, tabs).filter((entry) => entry.kind === "session" || entry.tab.kind !== "browser");
  // A browser tab never stays the phone's active tab (shared tabs, or the last session closing, can select one).
  const browserActive = tabs.some((tab) => tab.kind === "browser" && fileTabKey(tab) === active);
  useEffect(() => { if (browserActive) useFileTabs.getState().showSession(); }, [browserActive]);
  if (entries.length < 2) return null;
  const shown = activeTabId(state.sessionId, active);

  const press = (id: string) => {
    hold.current = { held: false, timer: setTimeout(() => { if (hold.current) hold.current.held = true; setArmed(id); }, HOLD_MS) };
  };
  const release = () => { if (hold.current) clearTimeout(hold.current.timer); };

  return (
    <nav className="flex h-11 shrink-0 items-stretch overflow-x-auto overflow-y-hidden [scrollbar-width:none]" aria-label="Tabs" data-testid="mobile-tabs">
      {entries.map((entry) => {
        const label = entryLabel(entry);
        const current = entry.id === shown;
        return (
          <div key={entry.id} className="flex shrink-0 items-stretch">
            <button
              type="button"
              className={cn(segment({ active: current }), TAP_BUTTON, current && "bg-surface-1 text-fg", "min-w-11 max-w-[11rem] px-3 text-[0.8rem] whitespace-nowrap")}
              data-testid="mobile-tab"
              data-tab={entry.id}
              aria-current={current ? "page" : undefined}
              onPointerDown={() => press(entry.id)}
              onPointerUp={release}
              onPointerLeave={release}
              onPointerCancel={release}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => {
                // The click that ends a hold only offers the close.
                if (hold.current?.held) { hold.current = null; return; }
                setArmed(null);
                showOnPhone(entry, onPane);
              }}
            >
              <span className="overflow-hidden text-ellipsis">{label}</span>
            </button>
            {armed === entry.id && (
              <button
                type="button"
                className={cn(segment(), TAP_BUTTON, "w-11 justify-center text-red")}
                data-testid="mobile-tab-close"
                aria-label={`Close ${label}`}
                onClick={() => { setArmed(null); close(entry); }}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </nav>
  );
}
