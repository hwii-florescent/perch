//! Sidebar, the stock screen `stock:sidebar`: the host, New session, the active host's projects, workspaces and
//! sessions (by project, by status or in one list; Quickchat after the projects), and the Settings gear. Hidden on
//! a phone-width window, where the switcher panel shows the phone's own copy of the body (`content.tsx`, compiled
//! into the app), so `perch mod use stock:sidebar <clone>` changes the desktop sidebar only.
//!
//! Data comes from `useHosts`, `useNavigation`, `useSessionFolders` and `useAddProject`, with Perch's rules
//! (listing, order, attention, the chat held in Done while read) already applied; every action is a typed command
//! (`runCommand`) naming its target. The menus, dialogs and worktree menu that open from rows are drawn by Perch.
//!
//! This folder is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs
//! and `perch mod clone stock:sidebar` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md). Its markers (`data-reorder-group`/`data-reorder-id` for the drag, the test ids, the
//! `session-row` and `project-row` slots) are kept stable for tests and legacy mods.
import { cn, runCommand, segmentClass } from "@perch/sdk";
import { SidebarContent } from "./content";
import { GearIcon } from "./icons";

export default function Sidebar() {
  return (
    <aside className="sidebar flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-transparent [--radius:var(--radius-pane)] max-[700px]:hidden">
      <SidebarContent />
      <div className="flex shrink-0 items-stretch p-1">
        <button
          type="button"
          className={cn(segmentClass(), "w-full justify-end rounded-ui px-[0.9rem] py-[0.4rem] leading-none")}
          data-testid="settings-gear"
          title="Settings"
          aria-label="Settings"
          onClick={() => runCommand("app.settings")}
        >
          <GearIcon size={18} />
        </button>
      </div>
    </aside>
  );
}
