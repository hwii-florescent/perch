// The web app's Settings page (`packages/web/src/components/SettingsPage.tsx`: the frame with the section list, the
// search box and Back to app) on the native React runtime, over the whole window: the window opens this mod as its
// `settings` screen from the sidebar's gear and Cmd+, (`global.settings`), with `page: "agents"` to land on that
// section. Each section is the app's own stock source (`settings-<page>/`, written by `mods-runtime/react/build.mjs`) with
// the props the web builds for it (`settings-props.js`: the core's settings, computers, devices and agents, saved through
// the core as the web saves them). Mods and Permissions are the desktop app's: they say so in the web's own words and
// offer Open in Perch.
//
// The runtime files beside this one are `mods/react-runtime/`, which the mod host writes into this folder. To change
// it, copy this folder from `<native-mods>/.stock/settings/` to `<native-mods>/settings/` and edit the plain JS there;
// it reloads on save. Escape closes Settings, except while the search holds text (it clears the text first) or a
// section listens for a key to record, which keep it.
// `screen.js` first: it sets up the host the runtime reads when it loads.
import { closeWith, screen } from "./screen.js";
import { runningHost } from "./host.js";
import { Component, createElement as h, useEffect, useState } from "react";
import { cn, ghostButton, SettingsQuery, settingsClass } from "@perch/sdk";
import { useAgentsProps, useAppearanceProps, useDevicesProps, useGeneralProps, useHostsProps, keyboardPages, useKeyboardProps, useNotificationsProps, useTerminalProps } from "./settings-props.js";
import General from "./settings-general/main.js";
import Appearance from "./settings-appearance/main.js";
import Agents from "./settings-agents/main.js";
import Keyboard from "./settings-keyboard/main.js";
import Terminal from "./settings-terminal/main.js";
import Notifications from "./settings-notifications/main.js";
import Hosts from "./settings-hosts/main.js";
import Devices from "./settings-devices/main.js";

// A full-height column of the shell (`CARD` in `SettingsPage.tsx`).
const CARD = "flex min-h-0 shrink-0 flex-col overflow-hidden rounded-[12px] bg-[var(--card-bg)]";
const SEARCH_FIELD = "box-border h-8 w-full min-w-0 rounded-ui bg-surface-0 px-[0.65rem] text-[0.82rem] text-fg [border:none] [font:inherit] placeholder:text-subtext-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-1px]";

/** What the desktop app holds and this window does not: the web's words, and a way there. */
function HandOff({ testId, lines }) {
  return h("div", { "data-testid": testId },
    ...lines.map((line) => h("p", { key: line, className: "m-0 mb-4 text-[0.85rem] text-fg" }, line)),
    h("button", { type: "button", className: settingsClass.primary, "data-testid": "settings-open-in-perch", onClick: () => runningHost().command("handoff.open", { place: "settings" }) }, "Open in Perch"));
}
const Mods = () => h(HandOff, { testId: "mods-handoff", lines: [
  "Perch's own screens are packages you can copy and edit. Choose your copy to show it wherever Perch shows that screen; if it cannot run, Perch's own comes back and says why.",
  "Mods are managed in the Perch desktop app.",
] });
const Permissions = () => h(HandOff, { testId: "mac-permissions", lines: [
  "Choose what perch and the tools you run may access. Allow opens macOS System Settings; you still decide there. All permissions are optional.",
  "These permissions belong to the Perch desktop app, which holds them for its terminals.",
] });

/** A section that cannot be drawn says why where it would be, so the rest of Settings stays usable. */
class Guard extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    return this.state.error
      ? h("p", { className: "m-0 text-[0.85rem] text-red", "data-testid": "settings-page-error" }, `This section could not be shown: ${this.state.error?.message ?? this.state.error}`)
      : this.props.children;
  }
}

/** The Keyboard page, one group of commands at a time under a row of group buttons (see `KEYBOARD_PAGE_ROWS`). */
function KeyboardSection() {
  const props = useKeyboardProps();
  const pages = keyboardPages(props.groups);
  const [shown, setShown] = useState(pages[0]?.id);
  const page = pages.find((p) => p.id === shown) ?? pages[0];
  return h("div", null,
    h("div", { className: "mb-4 flex flex-wrap gap-1", "data-testid": "keyboard-groups" },
      ...pages.map((p) => h("button", {
        key: p.id, type: "button",
        className: cn(ghostButton, "px-[0.6rem] py-[0.25rem] text-[0.8rem]", p.id === page?.id && "bg-surface-1 text-fg"),
        "data-testid": `keyboard-group-${p.id}`, onClick: () => setShown(p.id),
      }, p.title))),
    page && h(Keyboard, { ...props, groups: page.groups }));
}

const page = (Page, useProps) => function Section() { return h(Page, useProps()); };
const TABS = [
  { id: "general", label: "General", Content: page(General, useGeneralProps) },
  { id: "appearance", label: "Appearance", Content: page(Appearance, useAppearanceProps) },
  { id: "agents", label: "Agents", Content: page(Agents, useAgentsProps) },
  { id: "mods", label: "Mods", Content: Mods },
  { id: "keyboard", label: "Keyboard", Content: KeyboardSection },
  { id: "terminal", label: "Terminal", Content: page(Terminal, useTerminalProps) },
  { id: "notifications", label: "Notifications", Content: page(Notifications, useNotificationsProps) },
  { id: "hosts", label: "SSH hosts", Content: page(Hosts, useHostsProps) },
  { id: "devices", label: "Devices", Content: page(Devices, useDevicesProps) },
  { id: "permissions", label: "Permissions", Content: Permissions },
];

/** The settings search field. Escape clears the text first, so a second Escape closes the page. */
function SearchBox({ value, onChange }) {
  // The window dismisses a screen with Escape; while there is text it is this field's to clear.
  useEffect(() => { runningHost().holdEscape("search", value !== ""); }, [value]);
  return h("input", {
    className: SEARCH_FIELD, type: "search", "data-testid": "settings-search", "aria-label": "Search settings", placeholder: "Search settings", value,
    onChange: (e) => onChange(e.target.value),
    onKeyDown: (e) => { if (e.key === "Escape" && value) { e.stopPropagation(); onChange(""); } },
  });
}

/** Every matching row across the sections, grouped under the section name. Keyboard has no rows to filter, so it
 * appears (whole) only when its name matches. */
function SettingsResults({ query }) {
  const q = query.trim().toLowerCase();
  return h("div", { className: "[&:not(:has([data-setting-row]))>[data-none]]:block", "data-testid": "settings-results" },
    ...TABS.map(({ id, label, Content }) => {
      const whole = id === "keyboard";
      if (whole && !label.toLowerCase().includes(q)) return null;
      return h("div", { key: id, "data-testid": `settings-result-${id}`, className: "not-has-[[data-setting-row]]:hidden" },
        h("h2", { className: "m-0 mb-3 text-[0.75rem] font-medium tracking-[0.04em] text-subtext-0 uppercase" }, label),
        h(SettingsQuery.Provider, { value: whole ? "" : q },
          whole && h("span", { "data-setting-row": true, hidden: true }),
          h(Content)));
    }),
    h("p", { className: "m-0 hidden text-[0.85rem] text-subtext-0", "data-none": true }, `No settings match “${query.trim()}”.`));
}

const CHEVRON = h("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, h("path", { d: "M9.5 3.5 5 8l4.5 4.5" }));

function Settings({ page: opened }) {
  const [tab, setTab] = useState(TABS.some((t) => t.id === opened) ? opened : "general");
  const [query, setQuery] = useState("");
  const current = TABS.find((t) => t.id === tab);
  const searching = query.trim() !== "";
  return h("div", { className: "fixed inset-0 z-[1000] flex gap-2 bg-[var(--backdrop)] p-2", "data-testid": "settings-modal", role: "region", "aria-label": "Settings" },
    h("nav", { className: cn(CARD, "w-[15rem]"), "aria-label": "Settings sections" },
      // The window's traffic lights sit here, as the web's desktop app leaves room for them.
      h("div", { className: "box-border flex h-11 shrink-0 items-center", style: { paddingLeft: 84 } },
        h("button", { type: "button", className: cn(ghostButton, "flex items-center gap-1 py-[0.3rem] pr-2 pl-1 text-left text-[0.85rem]"), "data-testid": "settings-close", "aria-label": "Close settings", onClick: () => closeWith(null) }, CHEVRON, "Back to app")),
      h("div", { className: "flex min-h-0 flex-1 flex-col gap-[2px] overflow-y-auto px-2 pb-3" },
        ...TABS.map(({ id, label }) => h("button", {
          key: id, type: "button",
          className: cn(ghostButton, "px-[0.65rem] py-[0.4rem] text-left text-[0.85rem]", !searching && id === current.id && "bg-surface-1 text-fg"),
          "data-testid": `settings-nav-${id}`, "aria-current": !searching && id === current.id ? "page" : undefined,
          onClick: () => { setQuery(""); setTab(id); },
        }, label)))),
    h("main", { className: cn(CARD, "min-w-0 flex-1") },
      h("div", { className: "box-border flex h-11 shrink-0 items-center justify-end px-4" },
        h("div", { className: "w-[16rem] max-w-full" }, h(SearchBox, { value: query, onChange: setQuery }))),
      h("div", { className: "settings-modal__body min-h-0 flex-1 overflow-y-auto px-8 pb-8" },
        h("div", { className: "mx-auto max-w-[46rem]" },
          h("h1", { className: "m-0 mb-8 text-[1.6rem] font-semibold text-fg" }, searching ? "Search results" : current.label),
          searching ? h(SettingsResults, { query }) : h(Guard, { key: current.id }, h(current.Content))))));
}

const WINDOW = { width: "100%", height: "100%" };
export default screen("settings", Settings, {
  container: WINDOW,
  keyboard: true,
  escapeForKeys: true,
  props: (raw) => ({ page: typeof raw.page === "string" ? raw.page : undefined }),
});
