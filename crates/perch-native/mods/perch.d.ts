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
    workspaceId?: string;
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
    state: "ready" | "loading" | "idle";
    choices: { id: string; label: string }[];
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
  /** `runCommand`: runs a command as its key would. Rejects with why it could not. */
  export function run(id: string, args?: Record<string, unknown>): Promise<true>;
}
