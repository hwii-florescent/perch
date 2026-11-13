//! The reference page. `/?screen=sidebar&state=by-project&theme=dark` mounts a stock screen's own source (here
//! `packages/web/src/stock-ui/sidebar`) on the app's real store, CSS, Tailwind build and theme code, with the store
//! filled from `fixtures/<screen>.json` and nothing else (no socket, no core). `window.__PARITY_READY__` says the
//! page has settled; `window.__PARITY_SDK__` holds what the stock source's `useNavigation` and `useHosts` returned.
//!
//! A new screen is a new entry in `SCREENS` (its component and how its per-viewer view settings reach the page),
//! a `fixtures/<screen>.json` and a `named-elements.json` entry.
import type { ComponentType } from "react";
import { createRoot } from "react-dom/client";
import "../../../packages/web/src/styles/index.css";
import { usePerchStore } from "../../../packages/web/src/store";
import { applyTheme } from "../../../packages/web/src/themes";
// The app registers its SDK with the package loader before anything renders (App.tsx); a stock source needs it.
import "../../../packages/web/src/sdk";
import { useHosts, useNavigation } from "@perch/sdk";

interface Fixture {
  size: { width: number; height: number };
  data: Record<string, unknown>;
  states: { id: string; view: Record<string, unknown>; patch: Record<string, unknown> }[];
}
interface Screen {
  load: () => Promise<{ default: ComponentType }>;
  /** The per-viewer settings (localStorage) a state's `view` selects, written before the screen mounts. */
  storage: (view: Record<string, unknown>) => Record<string, string>;
  /** Data hooks of the screen, called beside it so the derived shapes can be written to the reference output. */
  Probe?: ComponentType<{ view: Record<string, unknown> }>;
}

function SidebarProbe({ view }: { view: Record<string, unknown> }) {
  const navigation = useNavigation({ showTerminals: !!view.showTerminals, sortByAttention: !!view.sortByAttention });
  const hosts = useHosts();
  (window as unknown as { __PARITY_SDK__: unknown }).__PARITY_SDK__ = JSON.parse(JSON.stringify({ navigation, hosts }));
  return null;
}

const SCREENS: Record<string, Screen> = {
  sidebar: {
    load: () => import("../../../packages/web/src/stock-ui/sidebar/main"),
    storage: (view) => ({
      "perch.sidebar.organize": String(view.organize),
      "perch.sidebar.sort": view.sortByAttention ? "attention" : "manual",
      "perch.sidebar.showTerminals": view.showTerminals ? "1" : "0",
      "perch.sidebar.collapsedProjects": JSON.stringify(view.collapsedProjects ?? []),
    }),
    Probe: SidebarProbe,
  },
};
/** Dark is the app's default look; light is the app's Catppuccin Latte, the one light preset with its own `base`. */
const THEMES: Record<string, string> = { dark: "perch", light: "catppuccin-latte" };

const params = new URLSearchParams(location.search);
const screenName = params.get("screen") ?? "sidebar";
const stateId = params.get("state");
const themeName = params.get("theme") ?? "dark";

const fixtures = import.meta.glob<Fixture>("../fixtures/*.json", { eager: true, import: "default" });
const fixture = fixtures[`../fixtures/${screenName}.json`];
const screen = SCREENS[screenName];
const state = fixture?.states.find((candidate) => candidate.id === stateId);
if (!fixture || !screen || !state || !THEMES[themeName]) throw new Error(`unknown screen/state/theme: ${location.search}`);

for (const [key, value] of Object.entries(screen.storage(state.view))) localStorage.setItem(key, value);
applyTheme(THEMES[themeName]!);

// The fixture's data, with the state's patch on top (a session's fields by id, a host's state by id).
const data = structuredClone(fixture.data) as Record<string, unknown>;
const { sessions: sessionPatch, hostStates: hostPatch, ...rest } = state.patch as { sessions?: Record<string, object>; hostStates?: Record<string, object> } & Record<string, unknown>;
Object.assign(data, rest);
if (sessionPatch) data.sessions = (data.sessions as { id: string }[]).map((session) => ({ ...session, ...sessionPatch[session.id] }));
if (hostPatch) data.hostStates = { ...(data.hostStates as object), ...hostPatch };
usePerchStore.setState(data);

const { default: Screen } = await screen.load();
const { Probe } = screen;
const { width, height } = fixture.size;
createRoot(document.getElementById("root")!).render(
  // The card the app lays the screen on (`CARD` in StockWindow.tsx), square-cornered, at the sidebar size the fixture names.
  <div className="app app--cards">
    <div style={{ display: "flex", flexDirection: "column", width, height, overflow: "hidden", background: "var(--card-bg)" }} data-parity-card="">
      <Screen />
    </div>
    {Probe && <Probe view={state.view} />}
  </div>,
);
await document.fonts.ready;
await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
(window as unknown as { __PARITY_READY__: boolean }).__PARITY_READY__ = true;
