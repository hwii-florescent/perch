//! The reference page. `/?screen=sidebar&state=by-project&theme=dark` mounts a stock screen's own source (here
//! `packages/web/src/stock-ui/sidebar`) on the app's real store, CSS, Tailwind build and theme code, with the store
//! filled from `fixtures/<screen>.json` and nothing else (no socket, no core). `window.__PARITY_READY__` says the
//! page has settled; `window.__PARITY_SDK__` holds what the screen's `@perch/sdk` hooks returned (and, for a screen
//! that takes props, the props object it was given).
//!
//! A new screen is a new entry in `SCREENS` (its component, how it is mounted and what props the host gives it), a
//! `fixtures/<screen>.json` and a `named-elements.json` entry.
//!
//! Two ways to mount:
//! - `card`: a screen the app lays in a box of its own (the sidebar card, the tab strip, the status bar, a pane
//!   header). The box has the size the fixture names; boxes are measured against it.
//! - `stage`: a screen that floats over the window (a menu, a dialog, the palette, the toasts: they render through a
//!   portal into `<body>` and are placed against the viewport). The stage is the whole window on the app's backdrop.
import { useState, type ComponentType, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "../../../packages/web/src/styles/index.css";
import { usePerchStore } from "../../../packages/web/src/store";
import { useFileTabs } from "../../../packages/web/src/fileTabs";
import { useSplitSets } from "../../../packages/web/src/splitSets";
import { useBrowserPages } from "../../../packages/web/src/browserPages";
import { applyTheme } from "../../../packages/web/src/themes";
import { BrowserIcon, FileIcon } from "../../../packages/web/src/stock-ui/tabs/icons";
// The app registers its SDK with the package loader before anything renders (App.tsx); a stock source needs it.
import "../../../packages/web/src/sdk";
import { useAgentChoices, useHosts, useKeybindings, useNavigation, useNotifications, usePaneLook, usePlanUsage, useStatusLine, useWorkspaceTabs, useZoom } from "@perch/sdk";

type Json = Record<string, unknown>;
interface Step { type?: { selector: string; text: string }; key?: { selector?: string; key: string }; click?: string }
interface State { id: string; title?: string; view?: Json; patch?: Json; props?: Json; size?: { width: number; height: number }; window?: { width: number; height: number }; via?: string; steps?: Step[] }
interface Fixture {
  size: { width: number; height: number };
  /** The fixture whose `data` this one starts from (the sidebar's sessions, workspaces and hosts, so every screen speaks of the same ones). */
  dataFrom?: string;
  data: Json;
  /** Props every state starts from; a state's own `props` go on top. */
  props?: Json;
  states: State[];
}
interface Screen {
  load: (via?: string) => Promise<{ default: ComponentType<never> }>;
  mount: "card" | "stage";
  /** The per-viewer settings (localStorage) a state's `view` selects, written before the screen mounts. */
  storage?: (view: Json) => Record<string, string>;
  /** The props the host gives the screen: the fixture's, plus the callbacks (no-ops: nothing here acts). */
  props?: (fixed: Json) => Json;
  /** Data hooks of the screen, called beside it so the derived shapes can be written to the reference output. */
  Probe?: ComponentType<{ view: Json; props: Json }>;
}

const noop = () => {};
/** The actions a host gives a screen, each a no-op: nothing here acts, so the fixture lists no action. */
const acts = () => new Proxy({}, { get: () => noop });
/** The part of what a Probe read that JSON can carry (functions drop out). */
const record = (value: Json) => ((window as unknown as { __PARITY_SDK__: unknown }).__PARITY_SDK__ = JSON.parse(JSON.stringify({ ...value, ...(state.steps ? { steps: state.steps } : {}) })));

function SidebarProbe({ view }: { view: Json }) {
  record({ navigation: useNavigation({ showTerminals: !!view.showTerminals, sortByAttention: !!view.sortByAttention }), hosts: useHosts() });
  return null;
}
function TabsProbe({ props }: { props: Json }) {
  record({ ...(Object.keys(props).length ? { props } : {}), workspaceTabs: useWorkspaceTabs() });
  return null;
}
function StatusProbe() {
  record({ statusLine: useStatusLine(), planUsage: usePlanUsage(), zoom: useZoom() });
  return null;
}
function PaneHeaderProbe({ props }: { props: Json }) {
  record({ props, workspaceTabs: useWorkspaceTabs(), paneLook: usePaneLook() });
  return null;
}
function ToastProbe() {
  record({ notifications: useNotifications().items });
  return null;
}
function NewSessionProbe({ props }: { props: Json }) {
  record({ props, agentChoices: useAgentChoices(String(props.hostId)) });
  return null;
}
function KeybindProbe({ props }: { props: Json }) {
  record({ props, keybindings: useKeybindings() });
  return null;
}
/** The stock select the way a caller holds it: it keeps the value, the field sits at `at` in the window. */
function SelectDemo({ Select, at, ...props }: { Select: ComponentType<Json>; at: { x: number; y: number; width: number } } & Json) {
  const [value, setValue] = useState(String(props.value));
  return <div style={{ position: "absolute", left: at.x, top: at.y, width: at.width }}><Select {...props} value={value} onChange={(next: string) => setValue(next)} /></div>;
}
/** A screen that is given everything as props and reads nothing else: the props are the whole story. */
function PropsProbe({ props }: { props: Json }) {
  record({ props });
  return null;
}

const SCREENS: Record<string, Screen> = {
  sidebar: {
    load: () => import("../../../packages/web/src/stock-ui/sidebar/main"),
    mount: "card",
    storage: (view) => ({
      "perch.sidebar.organize": String(view.organize),
      "perch.sidebar.sort": view.sortByAttention ? "attention" : "manual",
      "perch.sidebar.showTerminals": view.showTerminals ? "1" : "0",
      "perch.sidebar.collapsedProjects": JSON.stringify(view.collapsedProjects ?? []),
    }),
    Probe: SidebarProbe,
  },
  tabs: { load: () => import("../../../packages/web/src/stock-ui/tabs/main"), mount: "card", Probe: TabsProbe },
  status: { load: () => import("../../../packages/web/src/stock-ui/status/main"), mount: "card", Probe: StatusProbe },
  "pane-header": { load: () => import("../../../packages/web/src/stock-ui/pane-header/main"), mount: "card", Probe: PaneHeaderProbe },
  navigator: {
    load: () => import("../../../packages/web/src/stock-ui/navigator/main"),
    mount: "stage",
    props: (fixed) => ({
      ...fixed, onClose: noop,
      actions: { switchTo: noop, searchFiles: noop, openFile: noop, newTerminal: noop, startAgent: noop, manageAgents: noop, run: async () => {} },
    }),
    Probe: PropsProbe,
  },
  "tab-menu": {
    load: () => import("../../../packages/web/src/stock-ui/tab-menu/main"),
    mount: "stage",
    props: (fixed) => ({ ...fixed, onClose: noop, extraItems: ((fixed.extraItems ?? []) as Json[]).map((item) => ({ ...item, onSelect: noop })), actions: acts() }),
    Probe: PropsProbe,
  },
  select: {
    load: async () => {
      const { default: Select } = await import("../../../packages/web/src/stock-ui/select/main");
      return { default: ((props: Json) => <SelectDemo Select={Select as unknown as ComponentType<Json>} {...(props as { at: { x: number; y: number; width: number } })} />) as unknown as ComponentType<never> };
    },
    mount: "stage",
    Probe: PropsProbe,
  },
  "keybind-help": {
    load: () => import("../../../packages/web/src/stock-ui/keybind-help/main"),
    mount: "stage",
    props: (fixed) => ({ ...fixed, open: true, onClose: noop }),
    Probe: KeybindProbe,
  },
  launcher: {
    load: () => import("../../../packages/web/src/stock-ui/launcher/main"),
    mount: "stage",
    props: (fixed) => ({ ...fixed, onClose: noop, actions: acts() }),
    Probe: NewSessionProbe,
  },
  "pane-menu": {
    load: () => import("../../../packages/web/src/stock-ui/pane-menu/main"),
    mount: "stage",
    props: (fixed) => ({
      ...fixed, onClose: noop,
      actions: { splitNew: noop, splitSession: noop, showBesideTab: noop, toggleZoom: noop, rename: noop, stopAgent: noop, close: noop },
    }),
    Probe: PropsProbe,
  },
  confirm: {
    // `via` names a caller that opens the confirmation (the close guard asks it with its own extra rows).
    load: (via) => via === "close-guard" ? import("../../../packages/web/src/stock-ui/close-guard/main") : import("../../../packages/web/src/stock-ui/confirm/main"),
    mount: "stage",
    props: (fixed) => ({ ...fixed, onConfirm: noop, onCancel: noop, onStop: noop, onKeepRunning: noop }),
    Probe: PropsProbe,
  },
  dialog: {
    // The dialog is a shell: its callers (here the file menu's name prompt) fill it. `rejects` is what the stubbed
    // create answers when the name is submitted, so the prompt's own error line can be shown.
    load: () => import("../../../packages/web/src/stock-ui/file-menu/main"),
    mount: "stage",
    props: ({ rejects, ...fixed }) => ({
      ...fixed, onClose: noop, onOpenFile: noop, onExpand: noop, onRefresh: noop,
      actions: new Proxy({}, { get: (_, name) => name === "createFileAt" && rejects ? async () => { throw new Error(String(rejects)); } : name === "freeName" ? (n: string) => n : async () => undefined }),
    }),
    Probe: PropsProbe,
  },
  toast: { load: () => import("../../../packages/web/src/stock-ui/toast/main"), mount: "stage", Probe: ToastProbe },
  "new-session": {
    load: () => import("../../../packages/web/src/stock-ui/new-session/main"),
    mount: "stage",
    props: ({ anchorRect, extras, ...fixed }) => ({
      ...fixed, onClose: noop, onSelect: noop,
      anchorRect: DOMRect.fromRect(anchorRect as DOMRectInit),
      // The tab strip's "+" offers a browser and a file after the agents; the icons are the strip's own.
      ...(extras ? { extras: (extras as { id: string; label: string }[]).map((extra) => ({ ...extra, icon: extra.id === "browser" ? <BrowserIcon /> : <FileIcon />, onSelect: noop })) } : {}),
    }),
    Probe: NewSessionProbe,
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

for (const [key, value] of Object.entries(screen.storage?.(state.view ?? {}) ?? {})) localStorage.setItem(key, value);
applyTheme(THEMES[themeName]!);

// The fixture's data, with the state's patch on top. A session's fields by id (`sessions`), only some sessions
// (`keepSessions`), more sessions (`addSessions`), a host's state by id (`hostStates`); any other key replaces the
// store's value outright. `fileTabs`, `splitSets` and `browserPages` are the app's other stores, not the main one.
const base = fixture.dataFrom ? fixtures[`../fixtures/${fixture.dataFrom}.json`]!.data : {};
const data = structuredClone({ ...base, ...fixture.data }) as Json;
const { sessions: sessionPatch, keepSessions, addSessions, hostStates: hostPatch, fileTabs, splitSets, browserPages, ...rest } = (state.patch ?? {}) as {
  sessions?: Record<string, object>; keepSessions?: string[]; addSessions?: object[]; hostStates?: Record<string, object>;
  fileTabs?: { tabs: never[]; active: string | null }; splitSets?: { sets: never[]; zoomedId: string | null }; browserPages?: Record<string, never>;
} & Json;
Object.assign(data, rest);
let sessions = data.sessions as { id: string }[];
if (keepSessions) sessions = sessions.filter((session) => keepSessions.includes(session.id));
if (addSessions) sessions = [...sessions, ...(addSessions as { id: string }[])];
if (sessionPatch) sessions = sessions.map((session) => ({ ...session, ...sessionPatch[session.id] }));
data.sessions = sessions;
if (hostPatch) data.hostStates = { ...(data.hostStates as object), ...hostPatch };
usePerchStore.setState(data);
// Nothing here has a core to ask for the host's agents: the fixture's list stands.
usePerchStore.setState({ fetchAgentManifests: () => null });
useFileTabs.setState({ tabs: fileTabs?.tabs ?? [], active: fileTabs?.active ?? null });
useSplitSets.setState({ sets: splitSets?.sets ?? [], zoomedId: splitSets?.zoomedId ?? null });
useBrowserPages.setState({ pages: browserPages ?? {} });

// A state's `null` unsets a prop its fixture sets (an absent prop is not the same as a null one to a component).
const props = Object.fromEntries(Object.entries({ ...(fixture.props ?? {}), ...(state.props ?? {}) }).filter(([, value]) => value !== null));
const { default: Component } = await screen.load(state.via);
const { Probe } = screen;
const { width, height } = state.size ?? fixture.size;
const Shown = Component as ComponentType<Json>;
const shown: ReactNode = <Shown {...(screen.props ? screen.props(props) : props)} />;
createRoot(document.getElementById("root")!).render(
  <div className="app app--cards">
    {screen.mount === "card"
      // The box the app lays the screen in (`CARD` in StockWindow.tsx), square-cornered, at the size the fixture names.
      ? <div style={{ display: "flex", flexDirection: "column", width, height, overflow: "hidden", background: "var(--card-bg)", position: "relative" }} data-parity-card="">{shown}</div>
      // The window on the app's backdrop; the screen's own scrim and panel float over it from `<body>`.
      : <div style={{ width, height, background: "var(--backdrop)", position: "relative" }} data-parity-card="">{shown}</div>}
    {Probe && <Probe view={state.view ?? {}} props={props} />}
  </div>,
);
const frames = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
await document.fonts.ready;
await frames();

// What a person does on the way to the state (type into the palette, move the highlight, press a chip), done inside
// the page: events on the elements, never at the screen. A state that needs none has no `steps`.
for (const step of state.steps ?? []) {
  if (step.type) {
    const input = document.querySelector<HTMLInputElement>(step.type.selector);
    if (!input) throw new Error(`step: no ${step.type.selector}`);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, step.type.text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  } else if (step.key) {
    const target = step.key.selector ? document.querySelector(step.key.selector) : document;
    if (!target) throw new Error(`step: no ${step.key.selector}`);
    target.dispatchEvent(new KeyboardEvent("keydown", { key: step.key.key, bubbles: true, cancelable: true }));
  } else if (step.click) {
    const button = document.querySelector<HTMLElement>(step.click);
    if (!button) throw new Error(`step: no ${step.click}`);
    button.click();
  }
  await frames();
}
await new Promise<void>((resolve) => setTimeout(resolve, 250));
await frames();
(window as unknown as { __PARITY_READY__: boolean }).__PARITY_READY__ = true;
