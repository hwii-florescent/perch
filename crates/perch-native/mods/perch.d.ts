// What a native mod gets from `import * as perch from "perch"`.
//
// Names follow the web's `@perch/sdk` (`useNavigation` here is `navigation()`, `useHosts` is
// `hosts()`, and so on): a mod written against the web's shapes reads the same fields here. Every
// function answers from what this window knows now; a mod that read something is drawn again
// when it changes, so call these in `render()` rather than caching them.
declare module "perch" {
  /** `AgentState`: what a session is doing, by the dot it shows. */
  export type AgentState = "blocked" | "working" | "done" | "idle";
  /** `StatusSection`: the status grouping a session falls in. */
  export type StatusSection = "needs" | "done" | "working" | "idle";

  export interface SessionInfo {
    id: string;
    title: string;
    hostId: string;
    cwd: string;
    createdAt: number;
    status: "running" | "idle";
    branch?: string;
    projectId?: string;
    projectName?: string;
    workspaceId?: string;
    workspaceLabel?: string;
    parentId?: string;
    provider?: string;
    state: AgentState;
    section: StatusSection;
    needReason?: string;
    blocked: boolean;
    unseen: boolean;
    active: boolean;
  }

  export interface WorktreeJobInfo {
    id: string;
    branch: string;
    path: string;
    status: string;
    phase: string;
    error?: string;
  }

  export interface WorkspaceInfo {
    id: string;
    projectId: string;
    name: string;
    path: string;
    branch?: string;
    dirty: boolean;
    pinned: boolean;
    sleeping: boolean;
    linked: boolean;
    active: boolean;
    shortcut?: string;
    sessions: SessionInfo[];
    children: WorkspaceInfo[];
  }

  export interface ProjectInfo {
    id: string;
    hostId: string;
    name: string;
    path: string;
    repoPath?: string;
    favorite: boolean;
    quickchat: boolean;
    workspaces: WorkspaceInfo[];
    hidden: WorkspaceInfo[];
    jobs: WorktreeJobInfo[];
    sessions: SessionInfo[];
    hasChats: boolean;
    /** The most urgent state among its sessions, for a folded project's badge. */
    top: StatusSection | null;
    instructions: boolean;
    memory: boolean;
  }

  export interface StatusProject {
    id: string;
    name: string;
    project: ProjectInfo | null;
    sessions: SessionInfo[];
  }

  export interface StatusGroup {
    key: StatusSection | "offline";
    title: string;
    note?: string;
    sessions: SessionInfo[];
    projects: StatusProject[];
  }

  export interface Navigation {
    hostId: string;
    reachable: boolean;
    loading: boolean;
    error?: string;
    reorderable: boolean;
    projects: ProjectInfo[];
    quickchat: ProjectInfo | null;
    sessions: SessionInfo[];
    status: StatusGroup[];
    needsYou: number;
    activeWorkspaceId: string | null;
    activeSessionId: string | null;
    shortcuts: boolean;
  }

  export interface NavigationOptions {
    showTerminals?: boolean;
    sortByAttention?: boolean;
  }

  export interface HostInfo {
    id: string;
    name: string;
    state: string;
    error?: string;
    detail?: string;
    address?: string;
    direct: boolean;
    enabled?: boolean;
  }

  export interface Hosts {
    activeId: string;
    active: HostInfo;
    list: HostInfo[];
    local: { hostname?: string; platform?: string; isSsh?: boolean; cwd?: string; branch?: string };
    connected: boolean;
    canCreate: boolean;
    workspaces: boolean;
  }

  export interface SidebarSettings {
    organize: "project" | "status" | "list";
    sortByAttention: boolean;
    showTerminals: boolean;
    collapsedProjects: string[];
  }

  export interface StatusLine {
    connected: boolean;
    hostId: string;
    hostName?: string;
    hostState?: string;
    sessionId: string | null;
    cwd: string;
    branch?: string;
    /** The agent's context window use, in tokens, when the core reports one. */
    contextTokens?: number;
    /** The agent's cost so far, in US dollars, when the core reports one. */
    costUsd?: number;
  }

  /** One notification (`useNotifications`' item): what happened (`heading`) and to what (`detail`). */
  export interface NotificationItem {
    id: string;
    kind: "done" | "blocked";
    title: string;
    heading: string;
    detail: string;
    sessionId: string;
    sessionTitle?: string;
    /** The notification is about a session this window knows. */
    hasSession: boolean;
    /** How long it stays, ms: the screen dismisses it (`run("notification.dismiss", {id})`). */
    timeout: number;
  }

  /** `usePaneLook`: how pane headers are drawn. */
  export interface PaneLook {
    headerAt: "top" | "bottom";
    headerReveal: "always" | "hover";
    headerHeight: number;
  }

  // Screens: what the window passes a mod it opens as a screen (`props()`). The web's callbacks
  // are results: `onClose()` is `close()`, `actions.x(a, b)` is `close({ action: "x", args: [a, b] })`.

  /** `navigator`. Close with an action (`switchTo`, `newTerminal`, `startAgent`) or `{ command, args? }`. */
  export interface NavigatorScreenProps {
    open: boolean;
    sessions: { id: string; title: string; cwd: string; hostId?: string; createdAt: number; state: AgentState }[];
    currentSessionId: string | null;
    connected: boolean;
    workspace: { id: string; path: string } | null;
    supportsSearch: boolean;
    supportsRun: boolean;
    agents: { id: string; label: string }[];
    agentCwd: string | null;
    terminalCwd: string | null;
  }

  /** `pane-menu`. Close with an action (`splitNew`, `toggleZoom`, `rename`, `stopAgent`, `close`) or
   * `{ command }` of one of `items` (the native menu's entries). */
  export interface PaneMenuScreenProps {
    panelId: string;
    title: string;
    x: number;
    y: number;
    sessionId?: string;
    canClose: boolean;
    maximized: boolean;
    canStopAgent: boolean;
    items: { label: string; command: string }[];
  }

  /** `tab-menu`. Close with an action (`rename`, `splitNew`, `showFull`, `stopAgent`, `close`). */
  export interface TabMenuScreenProps {
    id: string;
    x: number;
    y: number;
    self: { id: string; kind: "session"; label: string; title?: string };
    canSplitNew: boolean;
    canSplitMore: boolean;
    offered: { id: string; label: string }[];
    inSplit: boolean;
    canStopAgent: boolean;
    extraItems: never[];
  }

  /** `confirm`. Close with `{ confirmed: true }` (`onConfirm`) or `{ confirmed: false }` (`onCancel`). */
  export interface ConfirmProps {
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    busy?: boolean;
  }

  /** `dialog`: the opener's title and fields. Close with `{ value }`. */
  export interface DialogProps {
    title: string;
    testId?: string;
    [field: string]: unknown;
  }

  /** `new-session`. Close with `{ cwd, agent }` (`onSelect`; no `cwd`: a Quickchat). */
  export interface NewSessionScreenProps {
    hostId: string;
    projectCwds: string[];
    fixedCwd?: string;
    anchorRect: { x: number; y: number; width: number; height: number };
  }

  /** `pane-header`, one copy per pane while the area is split. */
  export interface PaneHeaderProps {
    id: string;
    corner: boolean;
  }

  export interface WorkspaceTab {
    id: string;
    kind: "session";
    label: string;
    title: string;
    state: "focused" | "visible" | "hidden";
    dirty: boolean;
    preview: boolean;
    path: string;
    provider?: string;
    activity?: AgentState;
    blocked?: boolean;
    unseen?: boolean;
  }

  export interface WorkspaceTabs {
    hostId: string;
    cwd: string | null;
    workspace: { id: string; path: string } | null;
    activeId: string | null;
    tabs: WorkspaceTab[];
    tabShape: "square";
    draggingId: null;
  }

  export interface Focus {
    hostId: string;
    workspaceId: string | null;
    sessionId: string | null;
    terminalId: null;
    panes: { id: string; kind: "session"; title: string; focused: boolean }[];
  }

  export interface TerminalRecord {
    target: string;
    hostId: string;
    sessionId: string;
    workspaceId?: string;
    parentSessionId?: string;
    kind: "terminal" | "agent";
    provider: string;
    title: string;
    cwd: string;
    terminalId: null;
    shown: boolean;
    open: boolean;
    pinned: boolean;
    order: null;
    focused: boolean;
    /** Never more than is known: `unknown` unless this window has it open. */
    state: "running" | "unknown" | "host-unavailable";
  }

  export interface AgentChoices {
    connected: boolean;
    discovery: boolean;
    /** Loading until a computer that lists its agents has answered; ready otherwise. */
    state: "ready" | "loading";
    /** `isDefault` where the computer's list says. */
    choices: { id: string; label: string; isDefault?: boolean }[];
  }

  export interface Command {
    id: string;
    title: string;
    /** The arguments `run` takes, as `{name}`; null for none. */
    args: string | null;
    /** The key that runs it, as the person has it bound. */
    keys: string | null;
  }

  export interface Keybinding {
    keys: string;
    description: string;
    group: "global" | "tabs" | "nests" | "panes" | "terminal" | "leader";
  }

  /** The 18 theme tokens by the web's CSS names (`--accent` is `accent`), as `#rrggbb`. */
  export interface ThemeTokens {
    accent: string;
    "panel-bg": string;
    "surface-0": string;
    "surface-1": string;
    "surface-dim": string;
    "overlay-0": string;
    "overlay-1": string;
    text: string;
    "subtext-0": string;
    mauve: string;
    green: string;
    yellow: string;
    red: string;
    blue: string;
    teal: string;
    peach: string;
    backdrop: string;
    "card-bg": string;
  }

  /** `useNavigation`: projects, workspaces and sessions of the shown computer. */
  export function navigation(options?: NavigationOptions): Navigation;
  /** `useHosts`: the computers and which one is shown. */
  export function hosts(): Hosts;
  /** `useStatusLine`: where the focused session is. */
  export function statusLine(): StatusLine;
  /** `useWorkspaceTabs`: the window's tab strip. */
  export function workspaceTabs(): WorkspaceTabs;
  /** What has the keyboard, and the panes on screen. */
  export function focus(): Focus;
  /** Every session on every computer, as a terminal record. */
  export function terminals(): TerminalRecord[];
  /** `useAgentChoices`: what a computer (default `local`) can start. */
  export function agentChoices(hostId?: string): AgentChoices;
  /** The sidebar's view settings (the web's `perch.sidebar.*`). */
  export function sidebarSettings(): SidebarSettings;
  /** Changes the named settings; a wrong value throws and changes nothing. */
  export function setSidebarSettings(patch: Partial<SidebarSettings>): SidebarSettings;
  /** The scale factor of the window this mod is drawn in: device pixels per logical pixel. */
  export function scale(): number;
  /** The theme on screen, as its 18 tokens. */
  export function theme(): ThemeTokens;
  export function themeName(): string;
  export function themes(): string[];
  /** Every command `run` takes. */
  export function commands(): Command[];
  /** Each bound command and its keys. */
  export function keys(): { command: string; keys: string }[];
  /** `useKeybindings`: every binding grouped as the help screen groups them. */
  export function keybindings(): Keybinding[];
  /** `shortcutFor`: the key that runs a command, or null. */
  export function shortcutLabel(command: string): string | null;
  /** What the window opened this screen with (`{}` for none); a change re-renders the mod. */
  export function props<T = Record<string, unknown>>(): T;
  /** Closes this floating screen with `result`, which the window acts on; no result is a dismissal. */
  export function close(result?: unknown): void;
  /** Opens floating screen `id` (`confirm`, `new-session`, `dialog`, ...) with `props`, as the window opens it, and
   * resolves with its result (`null` when dismissed or replaced). Rejects when no mod draws that screen. */
  export function openScreen(id: string, props?: Record<string, unknown>): Promise<unknown>;
  /** `useNotifications`: the notifications, oldest first. Open and dismiss them with `run`. */
  export function notifications(): { items: NotificationItem[] };
  /** `useZoom`: the terminals' zoom factor (1 is 100%). */
  export function zoom(): number;
  /** `usePaneLook`. */
  export function paneLook(): PaneLook;
  /** A host's agents (default `local`), by id and display name, to tell them apart and draw their icons. */
  export function providers(hostId?: string): { id: string; name: string }[];
  /** `startSession`: starts `agent` in `cwd` on `hostId` (no `cwd`: a Quickchat). Rejects with why not. */
  export function startSession(hostId: string, cwd: string | undefined, agent: string): Promise<true>;
  /** `runCommand`: runs a command as its key would. Rejects with why it could not. */
  export function run(id: string, args?: Record<string, unknown>): Promise<true>;
}
