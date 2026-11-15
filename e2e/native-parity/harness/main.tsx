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
import "./tauri-flag";
import { useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "../../../packages/web/src/styles/index.css";
import { usePerchStore } from "../../../packages/web/src/store";
import { useFileTabs } from "../../../packages/web/src/fileTabs";
import { useSplitSets } from "../../../packages/web/src/splitSets";
import { useBrowserPages } from "../../../packages/web/src/browserPages";
import { zoneBox } from "../../../packages/web/src/tabDrag";
import perchLogo from "../../../packages/web/src/assets/perch-logo-texture-medium.webp";
import { applyTheme } from "../../../packages/web/src/themes";
import { BrowserIcon, FileIcon } from "../../../packages/web/src/stock-ui/tabs/icons";
// The app registers its SDK with the package loader before anything renders (App.tsx); a stock source needs it.
import "../../../packages/web/src/sdk";
import { SessionMenu, useAgentChoices, useHosts, useKeybindings, useNavigation, useNotifications, usePaneLook, usePlanUsage, useStatusLine, useWorkspaceTabs, useZoom } from "@perch/sdk";

type Json = Record<string, unknown>;
interface Step { type?: { selector: string; text: string }; key?: { selector?: string; key: string }; click?: string; scroll?: { selector: string; y: number } }
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
  /** What a state's `view` sets in the app's own stores once the screen's source is loaded (a store that read its device settings when it was first imported). */
  ready?: (view: Json) => Promise<void>;
  /** The props the host gives the screen: the fixture's, plus the callbacks (no-ops: nothing here acts). */
  props?: (fixed: Json) => Json;
  /** A selector that matches once the screen has what its host answered (a listing), waited for before the first step so a step does not act on a screen still loading. */
  listed?: (props: Json) => string | null;
  /** The time the screen sees as now (a screen that writes "5m ago" would otherwise change from run to run). */
  clock?: number;
  /** What the screen worked out for itself that only its drawing shows (read from the page once it has settled), added to `sdk`. */
  after?: () => Json;
  /** Data hooks of the screen, called beside it so the derived shapes can be written to the reference output. */
  Probe?: ComponentType<{ view: Json; props: Json }>;
}

const noop = () => {};
/** The actions a host gives a screen, each a no-op: nothing here acts, so the fixture lists no action. */
const acts = () => new Proxy({}, { get: () => noop });
/** The part of what a Probe read that JSON can carry (functions drop out). */
let extra: Json = {};
const record = (value: Json) => ((window as unknown as { __PARITY_SDK__: unknown }).__PARITY_SDK__ = JSON.parse(JSON.stringify({ ...value, ...(state.steps ? { steps: state.steps } : {}), ...extra })));

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
/**
 * The tab drag layer the way the drag hands it its props: `drag.look` is a copy of the dragged tab's own markup, so the
 * real tab strip is drawn out of sight, the tab is copied exactly as `beginTabDrag` copies it, and the box a drop would
 * take is worked out by `zoneBox` as TabDragLayer.tsx does. The fixture gives the pointer, the grab offset, the pane
 * under the pointer and the zone; nothing else of the drag is an input.
 */
interface DragInput { id: string; label: string; x: number; y: number; overStrip: boolean; tab: string; grab: { dx: number; dy: number }; pane: { left: number; top: number; width: number; height: number } | null; zone: "left" | "right" | "up" | "down" | null }
function TabDragDemo({ Layer, Tabs, drag: input }: { Layer: ComponentType<Json>; Tabs: ComponentType; drag: DragInput }) {
  const strip = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Json | null>(null);
  useLayoutEffect(() => {
    const source = strip.current?.querySelector<HTMLElement>(`[data-tab-entry="${input.tab}"]`);
    if (!source) throw new Error(`tab-drag: no tab ${input.tab} on the strip`);
    const rect = source.getBoundingClientRect();
    const html = source.outerHTML.replace(/\s(data-testid|data-tab-entry|id|style)="[^"]*"/g, "");
    const built = {
      id: input.id, label: input.label, x: input.x, y: input.y, overStrip: input.overStrip,
      look: { html, width: rect.width, height: rect.height, ...input.grab },
      drop: input.pane ? { pane: input.pane, zone: input.zone, box: input.zone ? zoneBox(input.pane, input.zone) : input.pane } : null,
    };
    record({ props: { drag: built } });
    setDrag(built);
  }, []);
  return (
    <>
      <div ref={strip} style={{ position: "fixed", left: -10000, top: 0, width: 976, visibility: "hidden" }}><Tabs /></div>
      {drag && <Layer drag={drag} />}
    </>
  );
}
/**
 * The folder browser the way the app places it: inside the Add project dialog, whose panel is the panel fill with 16 px of
 * padding. `browse` answers from the fixture's folder tree (path to `{ parent, entries }`); `loading` never answers, so the
 * list stays at its first load.
 */
interface FolderTree { home: string; loading?: boolean; tree: Record<string, { parent?: string; entries: { name: string; path: string; isGitRepo: boolean }[] }> }
function FolderBrowserHost({ Browser, home, loading, tree, ...rest }: { Browser: ComponentType<Json> } & FolderTree & Json) {
  const browse = (path?: string) => {
    if (loading) return new Promise<never>(() => {});
    const listing = tree[path ?? home];
    return listing ? Promise.resolve({ path: path ?? home, ...listing }) : Promise.reject(new Error(`no folder ${path}`));
  };
  return <div className="flex min-h-0 flex-1 flex-col bg-panel-bg p-4"><Browser {...rest} browse={browse} onUseFolder={noop} /></div>;
}
/**
 * The worktree menu the way the sidebar places it: its "+" button sits at `at` in the window (in the sidebar it is the end
 * of a project row, shown on hover) and the popover is placed against that button. The core's answers are the fixture's:
 * `listAnswer` (what `list` resolves; `listLoading` never answers), `createAnswer`, `removePlain` and `removeForce` (what
 * `remove` resolves without and with `force`) and `deleteBranchAnswer`. Perch's own asks (`request`) reach the screen as the key
 * that sends them does.
 */
type Answer = Record<string, unknown>;
function WorktreeHost({ Menu, at, listAnswer, listLoading, createAnswer, removePlain, removeForce, deleteBranchAnswer, ...rest }: { Menu: ComponentType<Json>; at: { x: number; y: number } } & { listAnswer?: Answer; listLoading?: boolean; createAnswer?: Answer; removePlain?: Answer; removeForce?: Answer; deleteBranchAnswer?: Answer } & Json) {
  // One object for the life of the page: the screen takes a request again whenever `actions` changes.
  const actions = useRef({
    list: () => (listLoading ? new Promise<Answer>(() => {}) : Promise.resolve(listAnswer ?? {})),
    create: () => Promise.resolve(createAnswer ?? {}),
    remove: (_path: string, force: boolean) => Promise.resolve((force ? removeForce : removePlain) ?? {}),
    deleteBranch: () => Promise.resolve(deleteBranchAnswer ?? {}),
    open: noop,
    takeRequest: noop,
  }).current;
  return <div style={{ position: "absolute", left: at.x, top: at.y }}><Menu {...rest} actions={actions} /></div>;
}
/**
 * The box a terminal's own chrome floats over: `.terminal` (position: relative, a column) holding the surface the terminal
 * draws on. The terminal's picture itself (xterm) is not drawn, so the surface is blank; the chrome is placed against this box.
 */
function TerminalFrame({ children }: { children: ReactNode }) {
  return <div className="terminal terminal--persistent" data-testid="persistent-agent-terminal">{children}<div className="terminal__surface" /></div>;
}
/** The find bar the way the terminal holds it: the query is the terminal's, the finds and the close are no-ops. */
function TerminalSearchDemo({ Bar, query: first }: { Bar: ComponentType<Json>; query: string }) {
  const [query, setQuery] = useState(first);
  return <TerminalFrame><Bar query={query} setQuery={setQuery} findNext={noop} findPrevious={noop} close={noop} /></TerminalFrame>;
}
/** The agent's controls in both places the terminal draws them (`part` top, before the surface; bottom, after it). */
interface ControlInput { agent: string; label: string | null; connected: boolean; pending: boolean; retry: boolean; control: { label: string; disabled: boolean } | null; error: string | null; ended: { sleeping: boolean; exitCode: number | null; close: boolean } | null; state: Json }
function AgentControlDemo({ Control, ac }: { Control: ComponentType<Json>; ac: ControlInput }) {
  const shared = {
    agent: ac.agent, label: ac.label, connected: ac.connected, pending: ac.pending, state: ac.state, error: ac.error,
    onRetry: ac.retry ? noop : null,
    control: ac.control ? { ...ac.control, onClick: noop } : null,
    ended: ac.ended ? { sleeping: ac.ended.sleeping, exitCode: ac.ended.exitCode, onRestart: noop, onClose: ac.ended.close ? noop : null } : null,
  };
  return <div className="terminal terminal--persistent" data-testid="persistent-agent-terminal"><Control {...shared} part="top" /><div className="terminal__surface" /><Control {...shared} part="bottom" /></div>;
}
/** A screen that is given everything as props and reads nothing else: the props are the whole story. */
function PropsProbe({ props }: { props: Json }) {
  record({ props });
  return null;
}

const SCREENS: Record<string, Screen> = {
  window: {
    // The whole window: `StockWindow` and the status bar under it, as App.tsx lays them, as the Mac app draws it
    // (`tauri-flag.ts`).
    load: async () => {
      const [{ StockWindow, useWindowWidths }, { StockView }] = await Promise.all([import("../../../packages/web/src/components/StockWindow"), import("./mod-root-stub")]);
      // App.tsx hands the two column widths down as CSS variables.
      const Window = () => {
        const { sidebarWidth, toolsWidth } = useWindowWidths();
        return <div className="flex size-full min-h-0 flex-col" style={{ "--sidebar-width": `${sidebarWidth}px`, "--tools-width": `${toolsWidth}px` } as React.CSSProperties}><StockWindow /><StockView name="status" placeholder={<div className="h-6 shrink-0" />} /></div>;
      };
      return { default: Window as unknown as ComponentType<never> };
    },
    mount: "stage",
    ready: async (view) => {
      // The window's store read the device's drawer tab when it was first imported, which an SDK import did before the fixture's.
      const { useWindowChrome } = await import("../../../packages/web/src/components/StockWindow");
      useWindowChrome.getState().setTools(view.tools ? (String(view.tools) as "files") : null);
    },
  },
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
  "session-menu": {
    // The menu the SDK draws for a session wherever it is shown (the sidebar opens it on a row): it works out for itself which
    // rows the session's tab menu offers, so the reference records what it drew.
    load: async () => ({ default: ((props: Json) => <SessionMenu {...(props as unknown as Parameters<typeof SessionMenu>[0])} />) as unknown as ComponentType<never> }),
    mount: "stage",
    props: (fixed) => ({ ...fixed, onClose: noop, extraItems: ((fixed.extraItems ?? []) as Json[]).map((item) => ({ ...item, onSelect: noop })) }),
    after: () => ({
      menu: [...(document.querySelector('[data-testid="tab-split-menu"]')?.children ?? [])].map((row) => row.classList.contains("h-px")
        ? { divider: true }
        : { testId: row.getAttribute("data-testid"), text: (row.textContent ?? "").trim(), ...(row instanceof HTMLButtonElement && row.disabled ? { disabled: true } : {}) }),
    }),
    Probe: PropsProbe,
  },
  "tab-drag": {
    load: async () => {
      const [{ default: Layer }, { default: Tabs }] = await Promise.all([import("../../../packages/web/src/stock-ui/tab-drag/main"), import("../../../packages/web/src/stock-ui/tabs/main")]);
      return { default: ((props: { drag: DragInput }) => <TabDragDemo Layer={Layer as unknown as ComponentType<Json>} Tabs={Tabs as unknown as ComponentType} drag={props.drag} />) as unknown as ComponentType<never> };
    },
    mount: "stage",
  },
  start: {
    // The main area with nothing open. The logo is the app's own asset (the home page's 80 px mark), not a fixture value.
    load: () => import("../../../packages/web/src/stock-ui/start/main"),
    mount: "card",
    props: (fixed) => ({ ...fixed, logo: perchLogo, actions: acts() }),
    Probe: NewSessionProbe,
  },
  "folder-browser": {
    load: async () => {
      const { default: Browser } = await import("../../../packages/web/src/stock-ui/folder-browser/main");
      return { default: ((props: FolderTree & Json) => <FolderBrowserHost Browser={Browser as unknown as ComponentType<Json>} {...props} />) as unknown as ComponentType<never> };
    },
    mount: "card",
    // The folder the browser opens at is the last one used on the host, kept by the browser in localStorage.
    listed: (props) => (props.loading ? null : '[data-testid="dir-browser-use"]:not(:disabled)'),
    storage: (view) => (view.lastPath ? { "perch.dirBrowser.lastPath.local": String(view.lastPath) } : {}),
    Probe: PropsProbe,
  },
  instructions: {
    // The core answers `load` and `save`: the fixture's `loaded` and `saved` are those answers (null: no answer); `loading` never answers.
    load: () => import("../../../packages/web/src/stock-ui/instructions/main"),
    mount: "stage",
    listed: (props) => (props.loading || !props.loaded ? null : '[data-testid="instructions-text"]:not(:disabled)'),
    props: ({ loaded, saved, loading, ...fixed }) => ({
      ...fixed, onClose: noop,
      load: () => (loading ? new Promise(() => {}) : Promise.resolve(loaded ?? null)),
      save: () => Promise.resolve(saved ?? null),
    }),
    Probe: PropsProbe,
  },
  memory: {
    clock: 1_800_000_000_000,
    listed: (props) => (props.loading ? null : '[data-testid="memory-new"]:not(:disabled)'),
    // The core answers `list`, `get`, `save` and `remove` with the fixture's `files` (the index, as `MemoryState`) and `texts` (a file's text by name);
    // `saved` and `removed` are what a write answers, `loading` never answers the list.
    load: () => import("../../../packages/web/src/stock-ui/memory/main"),
    mount: "stage",
    props: ({ index, texts, saved, removed, loading, noToggle, ...fixed }) => ({
      ...fixed, onClose: noop,
      list: () => (loading ? new Promise(() => {}) : Promise.resolve(index ?? null)),
      get: (file: string) => Promise.resolve((texts as Record<string, { entry: unknown; text: string }>)?.[file] ? { file: (texts as Record<string, unknown>)[file] } : { error: "That file is gone." }),
      save: () => Promise.resolve(saved ?? null),
      remove: () => Promise.resolve(removed ?? null),
      ...(noToggle ? {} : { setEnabled: () => Promise.resolve(index ?? null) }),
    }),
    Probe: PropsProbe,
  },
  worktree: {
    load: async () => {
      const { default: Menu } = await import("../../../packages/web/src/stock-ui/worktree/main");
      return { default: ((props: Json) => <WorktreeHost Menu={Menu as unknown as ComponentType<Json>} {...(props as { at: { x: number; y: number } })} />) as unknown as ComponentType<never> };
    },
    mount: "stage",
    Probe: NewSessionProbe,
  },
  "terminal-search": {
    load: async () => {
      const { default: Bar } = await import("../../../packages/web/src/stock-ui/terminal-search/main");
      return { default: ((props: { query: string }) => <TerminalSearchDemo Bar={Bar as unknown as ComponentType<Json>} query={props.query} />) as unknown as ComponentType<never> };
    },
    mount: "card",
    Probe: PropsProbe,
  },
  "agent-control": {
    load: async () => {
      const { default: Control } = await import("../../../packages/web/src/stock-ui/agent-control/main");
      return { default: ((props: { ac: ControlInput }) => <AgentControlDemo Control={Control as unknown as ComponentType<Json>} ac={props.ac} />) as unknown as ComponentType<never> };
    },
    mount: "card",
    Probe: PropsProbe,
  },
  "phone-size": {
    load: async () => {
      const { default: Notice } = await import("../../../packages/web/src/stock-ui/phone-size/main");
      return { default: ((props: Json) => <TerminalFrame><Notice {...props} onThisTab={noop} onAllTabs={noop} /></TerminalFrame>) as unknown as ComponentType<never> };
    },
    mount: "card",
    Probe: PropsProbe,
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
if (screen.clock !== undefined) { const now = screen.clock; Date.now = () => now; }
const { default: Component } = await screen.load(state.via);
await screen.ready?.(state.view ?? {});
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
/** The element a step acts on: a screen that lists something from its host (the folder browser) has it a moment after it mounts. */
const found = async <T extends Element>(selector: string | undefined, what: string): Promise<T | Document> => {
  if (!selector) return document;
  for (let tries = 0; tries < 120; tries++) {
    const element = document.querySelector<T>(selector);
    if (element) return element;
    await frames();
  }
  throw new Error(`step: no ${selector} for ${what}`);
};
const listed = screen.listed?.(props);
if (listed && state.steps?.length) await found(listed, "listing");
for (const step of state.steps ?? []) {
  if (step.type) {
    const input = (await found<HTMLInputElement>(step.type.selector, "type")) as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, step.type.text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  } else if (step.key) {
    const target = await found(step.key.selector, "key");
    target.dispatchEvent(new KeyboardEvent("keydown", { key: step.key.key, bubbles: true, cancelable: true }));
  } else if (step.click) {
    ((await found<HTMLElement>(step.click, "click")) as HTMLElement).click();
  } else if (step.scroll) {
    // The wheel over a scroll area, `y` logical pixels down.
    ((await found<HTMLElement>(step.scroll.selector, "scroll")) as HTMLElement).scrollTop = step.scroll.y;
  }
  await frames();
}
if (screen.after) {
  extra = screen.after();
  Object.assign((window as unknown as { __PARITY_SDK__: Json }).__PARITY_SDK__, JSON.parse(JSON.stringify(extra)));
}
await new Promise<void>((resolve) => setTimeout(resolve, 250));
await frames();
(window as unknown as { __PARITY_READY__: boolean }).__PARITY_READY__ = true;
