/**
 * SettingsPage.tsx — settings as a full-window page (see `SettingsPage` below).
 * Opens whenever `settingsOpen` is true and fetches settings + hosts from the
 * server. The page is a frame (the section list, the search box, the close button) around the
 * section chosen on the left; every section but Mods is a screen bound to Perch in `settingsRoutes.tsx`
 * (`AgentCatalog.tsx`, `KeybindingsSection.tsx` and `MacPermissions.tsx` for their own).
 * Settings > Mods (`ModsSection.tsx`) is Perch's own always: it is where a broken copy is put back.
 */

import { useEffect, useState } from "react";
import { usePerchStore } from "../store";
import { MacPermissions, macPermissionsAvailable } from "./MacPermissions";
import { AgentCatalog } from "./AgentCatalog";
import { ModsSection } from "./ModsSection";
import { cn } from "../lib/cn";
import { SettingsQuery } from "./ui/setting-row";
import { KeybindingsSection } from "./KeybindingsSection";
import { AppearanceSettings, DevicesSettings, GeneralSettings, HostsSettings, NotificationsSettings, TerminalSettings } from "./settingsRoutes";
import { GHOST_BUTTON } from "./ui/icon-button";
import { TAP_BUTTON } from "./ui/glass";
import { disconnectNativeApp, inNativeApp } from "../nativeApp";
import { Chevron } from "./ui/chevron";
import { isPhoneDevice, useIsMobileWidth } from "../responsive";

// A full-height column of the shell, as in App.tsx (kept in step by hand: App imports this file).
const CARD = "flex min-h-0 shrink-0 flex-col overflow-hidden rounded-[12px] bg-[var(--card-bg)]";

type SettingsTab = "general" | "appearance" | "agents" | "mods" | "keyboard" | "terminal" | "notifications" | "hosts" | "devices" | "permissions";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "agents", label: "Agents" },
  { id: "mods", label: "Mods" },
  { id: "keyboard", label: "Keyboard" },
  { id: "terminal", label: "Terminal" },
  { id: "notifications", label: "Notifications" },
  { id: "hosts", label: "SSH hosts" },
  { id: "devices", label: "Devices" },
  ...(macPermissionsAvailable ? [{ id: "permissions" as const, label: "Permissions" }] : []),
];

function TabContent({ tab }: { tab: SettingsTab }) {
  switch (tab) {
    case "general": return <GeneralSettings />;
    case "appearance": return <AppearanceSettings />;
    case "agents": return <AgentCatalog />;
    case "mods": return <ModsSection />;
    case "keyboard": return <KeybindingsSection />;
    case "terminal": return <TerminalSettings />;
    case "notifications": return <NotificationsSettings />;
    case "hosts": return <HostsSettings />;
    case "devices": return <DevicesSettings />;
    case "permissions": return <MacPermissions />;
  }
}

const SEARCH_FIELD = "box-border h-8 w-full min-w-0 rounded-ui bg-surface-0 px-[0.65rem] text-[0.82rem] text-fg [border:none] [font:inherit] placeholder:text-subtext-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-1px]";

/** The settings search field. Escape clears the text first, so a second Escape closes the page. */
function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      className={SEARCH_FIELD}
      type="search"
      data-testid="settings-search"
      aria-label="Search settings"
      placeholder="Search settings"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Escape" && value) { e.stopPropagation(); onChange(""); } }}
    />
  );
}

/** Every matching row across the sections, grouped under the section name. Keyboard has no rows
 * to filter, so it appears (whole) only when its name matches. */
function SettingsResults({ query }: { query: string }) {
  const q = query.trim().toLowerCase();
  const isMobile = useIsMobileWidth();
  return (
    <div className="[&:not(:has([data-setting-row]))>[data-none]]:block" data-testid="settings-results">
      {TABS.map(({ id, label }) => {
        const whole = id === "keyboard";
        if (whole && !label.toLowerCase().includes(q)) return null;
        if (id === "keyboard" && isMobile) return null; // no shortcuts to rebind on a touch screen
        return (
          <div key={id} data-testid={`settings-result-${id}`} className="not-has-[[data-setting-row]]:hidden">
            <h2 className="m-0 mb-3 text-[0.75rem] font-medium tracking-[0.04em] text-subtext-0 uppercase">{label}</h2>
            <SettingsQuery.Provider value={whole ? "" : q}>
              {whole && <span data-setting-row hidden />}
              <TabContent tab={id} />
            </SettingsQuery.Provider>
          </div>
        );
      })}
      <p className="m-0 hidden text-[0.85rem] text-subtext-0" data-none>No settings match “{query.trim()}”.</p>
    </div>
  );
}

/** The phone's settings: a section list, then one section at a time with a back
 * row (iOS-style), instead of the desktop's sidebar. Keyboard shortcuts are left
 * out: a touch screen has none to rebind. */
function MobileSettings({ tab, onTab, onClose }: { tab: SettingsTab | null; onTab: (tab: SettingsTab | null) => void; onClose: () => void }) {
  const current = TABS.find((t) => t.id === tab);
  const [query, setQuery] = useState("");
  const searching = !current && query.trim() !== "";
  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-panel-bg" data-testid="settings-modal" role="region" aria-label="Settings">
      <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center pt-[max(0.5rem,env(safe-area-inset-top))] pr-[env(safe-area-inset-right)] pl-[max(0.25rem,env(safe-area-inset-left))]">
        <button
          type="button"
          className={cn(GHOST_BUTTON, TAP_BUTTON, "flex min-h-[3.25rem] items-center gap-1 justify-self-start px-3 text-[0.9rem]")}
          data-testid={current ? "settings-back" : "settings-close"}
          aria-label={current ? "Back to settings" : "Close settings"}
          onClick={() => (current ? onTab(null) : onClose())}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9.5 3.5 5 8l4.5 4.5" /></svg>
          {current ? "Settings" : "Back"}
        </button>
        <h1 className="m-0 min-w-0 truncate text-center text-[0.95rem] font-semibold text-fg">{current?.label ?? "Settings"}</h1>
      </header>
      {current ? (
        <main className="settings-modal__body min-w-0 flex-1 overflow-y-auto px-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <TabContent tab={current.id} />
        </main>
      ) : (
        <nav className="flex-1 overflow-y-auto px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" aria-label="Settings sections">
          <div className="mb-4"><SearchBox value={query} onChange={setQuery} /></div>
          {searching ? <SettingsResults query={query} /> : <>
          <div className="overflow-hidden rounded-ui bg-surface-0">
            {TABS.filter((t) => t.id !== "keyboard").map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={cn(GHOST_BUTTON, TAP_BUTTON, "flex min-h-[3.25rem] w-full items-center justify-between rounded-none px-4 text-left text-[0.95rem] text-fg hover:text-fg")}
                data-testid={`settings-nav-${id}`}
                onClick={() => onTab(id)}
              >
                {label}
                <Chevron open={false} />
              </button>
            ))}
          </div>
          {inNativeApp() && (
            <button
              type="button"
              className={cn(GHOST_BUTTON, TAP_BUTTON, "mt-4 flex min-h-[3.25rem] w-full items-center rounded-ui bg-surface-0 px-4 text-left text-[0.95rem] text-red hover:bg-surface-0 hover:text-red")}
              data-testid="native-change-computer"
              onClick={disconnectNativeApp}
            >
              Change computer
            </button>
          )}
          </>}
        </nav>
      )}
    </div>
  );
}

/** Settings as a page of its own: it fills the window (the app stays mounted
 * underneath, so terminals keep running), with a section list on the left and
 * the chosen section on the right. Not a popup. */
export function SettingsPage() {
  const settingsOpen = usePerchStore((s) => s.settingsOpen);
  const settingsPage = usePerchStore((s) => s.settingsPage);
  const setSettingsOpen = usePerchStore((s) => s.setSettingsOpen);
  const fetchSettings = usePerchStore((s) => s.fetchSettings);
  const fetchHosts = usePerchStore((s) => s.fetchHosts);
  const isMobile = useIsMobileWidth();
  // `null` = the phone's section list.
  const [tab, setTab] = useState<SettingsTab | null>("general");
  const [query, setQuery] = useState("");

  // Fetch data every time the page opens, on the section the opener asked for.
  useEffect(() => {
    if (settingsOpen) {
      setQuery("");
      setTab(settingsPage === "agents" ? "agents" : isPhoneDevice() ? null : "general");
      fetchSettings();
      fetchHosts();
    }
  }, [settingsOpen, settingsPage, fetchSettings, fetchHosts]);

  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setSettingsOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [settingsOpen, setSettingsOpen]);

  if (!settingsOpen) return null;
  if (isMobile) return <MobileSettings tab={tab} onTab={setTab} onClose={() => setSettingsOpen(false)} />;
  const current = TABS.find((t) => t.id === (tab ?? "general"))!;
  const searching = query.trim() !== "";

  return (
    // Same shell as the app: full-height cards on the backdrop (App.tsx CARD; the traffic lights sit in the nav card).
    <div className="fixed inset-0 z-[1000] flex gap-2 bg-[var(--backdrop)] p-2 [--radius:var(--radius-pane)]" data-testid="settings-modal" role="region" aria-label="Settings" data-tauri-drag-region>
      <nav className={cn(CARD, "w-[15rem]")} aria-label="Settings sections">
        <div className="box-border flex h-11 shrink-0 items-center pl-3 in-[.app--mac-desktop]:pl-[84px]" data-tauri-drag-region>
          <button
            type="button"
            className={cn(GHOST_BUTTON, "flex items-center gap-1 py-[0.3rem] pr-2 pl-1 text-left text-[0.85rem]")}
            data-testid="settings-close"
            aria-label="Close settings"
            onClick={() => setSettingsOpen(false)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9.5 3.5 5 8l4.5 4.5" /></svg>
            Back to app
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-[2px] overflow-y-auto px-2 pb-3">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={cn(GHOST_BUTTON, "px-[0.65rem] py-[0.4rem] text-left text-[0.85rem]", !searching && id === current.id && "bg-surface-1 text-fg")}
              data-testid={`settings-nav-${id}`}
              aria-current={!searching && id === current.id ? "page" : undefined}
              onClick={() => { setQuery(""); setTab(id); }}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
      <main className={cn(CARD, "min-w-0 flex-1")}>
        <div className="box-border flex h-11 shrink-0 items-center justify-end px-4" data-tauri-drag-region>
          <div className="w-[16rem] max-w-full"><SearchBox value={query} onChange={setQuery} /></div>
        </div>
        <div className="settings-modal__body min-h-0 flex-1 overflow-y-auto px-8 pb-8">
          <div className="mx-auto max-w-[46rem]">
            <h1 className="m-0 mb-8 text-[1.6rem] font-semibold text-fg">{searching ? "Search results" : current.label}</h1>
            {searching ? <SettingsResults query={query} /> : <TabContent tab={current.id} />}
          </div>
        </div>
      </main>
    </div>
  );
}
