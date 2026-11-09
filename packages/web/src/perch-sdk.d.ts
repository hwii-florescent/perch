/**
 * `@perch/sdk` 1.x: the one public API for Perch screens written as packages. Perch's own stock
 * screens (`stock:<id>`), their clones and community packages import only this module, `react`,
 * `react/jsx-runtime`, `react-dom` and their own files. Everything else in Perch's source is
 * internal and may change in any release. Guide: docs/MOD-SDK.md in the Perch repository.
 *
 * A package's `mod.json` `api` (for example `"^1"`) names the SDK versions it works with; a page
 * whose `version` is outside that range does not load it and says why. Additions keep the major
 * version; a removal or an incompatible change raises it.
 */
declare module "@perch/sdk" {
  import type { CSSProperties, DragEvent, FocusEvent as ReactFocusEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactElement, ReactNode, RefObject } from "react";

  /**
   * This page's SDK version (semver). 1.1 added `assetUrl`, `useInstance` and `useInstanceState`; 1.2 the status
   * bar's data and actions and the shared look (`cn`, `ghostButton`, `menuPanel`, popovers, `Slot`); 1.3 navigation
   * (hosts, projects, workspaces, sessions and their dialogs); 1.4 resources (`useResourceState`, `newId`, the Git
   * review's data and actions, file icons, and the layout, focus and terminal queries); 1.5 files, the native chat,
   * the drawer's browser, the fixed Markdown components and `Layout`; 1.6 durable data (`useModData`),
   * `fetchTerminal`, the confirmation (`ConfirmProps`) and the notifications (`useNotifications`, `iconButton`); 1.7
   * the app's dialogs and menus as screens (their props: `DialogProps`, `SelectProps`, `TabMenuScreenProps`, ...) and
   * `useAgentChoices`, `shortcutFor`, `menuDividerClass`; 1.8 the Settings pages (their props types and parts); 1.9
   * the start screen, the editor menu, the terminal's find bar, the slash popover (`SlashPopover`), Split with
   * session and the phone-size notice (their props types); 1.10 the phone's own screens (`stock:mobile-*`), the shell
   * toolbar, the agent terminal's controls, the dock's tab and group actions and the browser toolbar (their props
   * types), and `glassClass`, `tapButtonClass`, `GearIcon`, `PlusIcon`, `EllipsisIcon`.
   */
  export const version: string;

  /** Where a key binding applies, as Perch's keybind help groups them. */
  export type KeybindGroup =
    | "global"
    | "tabs"
    | "nests"
    | "panes"
    | "terminal"
    | "leader"
    | "resize"
    | "editor"
    | "navigator"
    | "directory"
    /** 1.8: commands a package registered (`useCommand`, legacy `api.command`). */
    | "mods";

  /** One key binding as the person has it now (their overrides applied), in this platform's key names. */
  export interface KeybindEntry {
    keys: string;
    description: string;
    group: KeybindGroup;
  }

  /** A React hook: every key binding, read again when the person changes one in Settings. */
  export function useKeybindings(): KeybindEntry[];

  /** Perch's close (×) icon: `size` px square (default 14), drawn in the current text color. */
  export function CloseIcon(props: { size?: number; className?: string }): ReactElement;

  /**
   * The URL of one of this package's own files (`"art/logo.svg"`, a path from the package folder), for
   * `<img src>`, `new Audio()`, a `FontFace` and the like. It is this revision's copy of the file and
   * works on a paired phone too. CSS needs nothing: every `.css` file of the package is on the page
   * while the package shows, with its `url(...)`s already pointing at its files. Throws for a path
   * that is not a file of the package.
   */
  export function assetUrl(path: string): string;

  /** The copy of the package this component runs in (one per place it is shown). */
  export interface PackageInstance {
    /** Where the copy is: `layout:<layout>:<node>`, `pane:<tab>`, `dock:<panel>`, `stock:<id>`, … */
    readonly key: string;
    /** The package revision this copy runs. */
    readonly revision: string;
    /**
     * Marks work in flight (a send, a save, a confirmed delete) as the copy's: while any is pending a
     * newer revision of the package waits (up to 10 s) before it replaces this one, so the work is not
     * started twice or lost mid-way. Pass the promise, or a function that starts it. Returns the same
     * result.
     */
    trackOperation<T>(work: Promise<T> | (() => Promise<T>)): Promise<T>;
  }

  /** A React hook: the copy this component runs in. */
  export function useInstance(): PackageInstance;

  /**
   * A React hook like `useState`, but the value is held by the copy, not the component: it stays when
   * the package is edited and reloads, and while the copy is hidden (another tab of its stack, a
   * collapsed column). It goes when the copy does (its place leaves the layout, its tab closes).
   * Each copy has its own; `name` tells values of one copy apart.
   */
  export function useInstanceState<T>(name: string, initial: T): [T, (next: T | ((previous: T) => T)) => void];

  /** One stored value of a package's durable data, with its revision (the SHA-256 of the stored JSON). */
  export interface ModDataValue<T = unknown> {
    value: T;
    revision: string;
  }
  export interface ModDataEntry {
    key: string;
    revision: string;
    size: number;
  }
  /** Thrown by `ModData`: `code` `conflict` (another revision is there now; `revision` is it, null for none) or
   * `corrupt` (the stored file is not JSON; write with `{expected: revision}` to replace it, the old bytes are kept). */
  export interface ModDataError extends Error {
    code?: "conflict" | "corrupt";
    revision?: string | null;
  }
  /**
   * A package's durable data (1.6): JSON values by key, kept by the core in its own folder outside the package
   * (`mod-data/<id>`), so they survive reloads, restarts and edits of the code, a clone starts without them and
   * removing the package keeps them. Keys are 1 to 120 letters, digits, `.`, `-`, `_`; a value is at most 1 MiB of
   * JSON, a package keeps at most 1000 keys. Over the relay too.
   */
  export interface ModData {
    /** The value under `key`, or null when there is none. */
    read<T = unknown>(key: string): Promise<ModDataValue<T> | null>;
    /** Stores `value` and returns its revision. `expected`: the revision the key must hold now, or null for a key
     * that must not exist; another one rejects (`conflict`) and nothing is written. Two copies writing at once:
     * give `expected`, and the second gets `conflict` instead of overwriting the first. */
    write(key: string, value: unknown, options?: { expected?: string | null }): Promise<string>;
    /** Deletes `key` (same `expected`); false when there was nothing. */
    remove(key: string, options?: { expected?: string | null }): Promise<boolean>;
    list(): Promise<ModDataEntry[]>;
    /** Calls `changed` with every key when any revision changes: at once for a write from this page, within
     * `every` ms (default 2000) for one from elsewhere. Returns the way to stop. */
    watch(changed: (entries: ModDataEntry[]) => void, every?: number): () => void;
  }

  /** A React hook (1.6): the durable data of the package this component runs in (per package id: every copy of the
   * package shares it, and a clone has its own). Use `useInstanceState` for a copy's own view state instead. */
  export function useModData(): ModData;

  // ---------------------------------------------------------------------------------------------------------------
  // 1.2: the status bar and the look it shares.

  /** The focused session's place (else the active host's and workspace's), as the status bar shows it. */
  export interface StatusLine {
    /** The page's connection to its core. */
    connected: boolean;
    /** `"local"` or a host id; the focused session's host, else the active one. */
    hostId: string;
    /** The host's name from Settings > Hosts, when it has one. */
    hostName?: string;
    /** The core's last word on that host (`"connected"`, `"connecting"`, `"disconnected"`, …); unknown is undefined. */
    hostState?: string;
    sessionId: string | null;
    /** The focused session's folder, else the workspace's; empty when neither is known. */
    cwd: string;
    branch?: string;
    /** The focused agent's context window use, in tokens, when it reports one. */
    contextTokens?: number;
    /** The focused agent's cost so far, in US dollars, when it reports one. */
    costUsd?: number;
  }
  /** A React hook: the status line, kept current. */
  export function useStatusLine(): StatusLine;

  /** One rate-limit window of a provider account. `resetsAt` is an ISO date or Unix seconds. */
  export interface UsageWindow {
    label: string;
    usedPercent: number;
    windowMinutes: number;
    resetsAt?: string | number;
    /** What a narrower limit applies to (a model name); absent for the account-wide window. */
    scope?: string;
  }
  /** One provider login and its windows. `accountId` is what `redeemUsageReset` names. */
  export interface AccountUsage {
    provider: string;
    label?: string;
    plan?: string;
    planMonthlyUsd?: number;
    windows: UsageWindow[];
    /** Banked Codex rate-limit resets still redeemable. */
    resetCredits?: number;
    accountId?: string;
    error?: string;
  }
  export interface SpendShare { name: string; provider?: string; costUsd: number; tokens: number }
  /** API-equivalent spend over the last `days` days, from local agent logs at list prices. */
  export interface SpendPeriod {
    days: number;
    costUsd: number;
    savedUsd: number;
    tokens: number;
    unpriced: number;
    providers: SpendShare[];
    models: SpendShare[];
    projects: SpendShare[];
  }
  export interface SpendSummary {
    periods: SpendPeriod[];
    block?: { start: number; end: number; costUsd: number; tokens: number };
    burnPerHourUsd?: number;
    pricesUpdated: string;
  }
  /** The answer to `redeemUsageReset`: `outcome` is `reset`, `nothingToReset`, `noCredit`, `alreadyRedeemed` or another
   * word with a `message`. */
  export interface UsageRedeemResult { accountId: string; outcome: string; message?: string }
  export interface PlanUsage {
    usage: AccountUsage[];
    /** When the core last fetched it (ms); 0 before the first answer. A refresh is done when this changes. */
    updatedAt: number;
    spend: SpendSummary | null;
    /** The latest reset answer, for any account; cleared when a new reset is asked for. */
    redeemResult: UsageRedeemResult | null;
  }
  /** A React hook: plan usage as last reported. With `keepFresh` it also asks the core on connect and every 3 min while
   * mounted (one component per screen should). */
  export function usePlanUsage(options?: { keepFresh?: boolean }): PlanUsage;
  /** Asks the core for fresh usage now. The answer moves `updatedAt`; none may come (offline), so time out yourself. */
  export function refreshUsage(): void;
  /** Spends one banked rate-limit reset of `accountId`. Send it once; the answer is `redeemResult` with that id. */
  export function redeemUsageReset(accountId: string): void;

  /** A React hook: the tab area's zoom factor (1 is 100%). */
  export function useZoom(): number;
  /** Back to 100% (what Cmd/Ctrl+0 does). */
  export function resetZoom(): void;
  /** A key combination (`"cmd+0"`) in this platform's key names (`"⌘0"`, `"Ctrl+0"`). */
  export function keyLabel(combo: string): string;
  /** Whether this page runs on a Mac. */
  export const isMac: boolean;

  /** Joins class names; a later Tailwind utility wins over an earlier conflicting one. */
  export function cn(...classes: Array<string | false | null | undefined>): string;
  /** Perch's quiet button: no fill until hovered. */
  export const ghostButton: string;
  /** Perch's menu and popover panel. */
  export const menuPanel: string;
  /** A fixed position for a popover under (or over, near the bottom) `anchor`, kept inside the window. */
  export function anchoredPopoverStyle(
    anchor: HTMLElement,
    options?: { minWidth?: number; align?: "left" | "right"; minSpaceAbove?: number },
  ): CSSProperties;
  /** A React hook: while `open`, a mouse-down outside `anchor` and `popover`, or Escape, calls `setOpen(false)`. */
  export function useDismissOnOutsideClick(
    open: boolean,
    setOpen: (open: boolean) => void,
    anchor: RefObject<HTMLElement | null>,
    popover: RefObject<HTMLElement | null>,
  ): void;

  /**
   * A legacy mod's slot: what a single-file mod drew for `name` (`api.slot`), else `children`. `perch mod api` lists the
   * names and their `data`/`actions`. A stock screen keeps its slots so those mods keep working over it.
   */
  export function Slot(props: {
    name: string;
    data: Record<string, unknown>;
    actions: Record<string, (...args: never[]) => void>;
    className?: string;
    isolate?: boolean;
    children: ReactNode;
  }): ReactElement;

  // ---------------------------------------------------------------------------------------------------------------
  // 1.2: tabs, pane chrome and app commands.

  /** Where a tab is: shown with the keyboard (`focused`), shown in a split beside it (`visible`), or not shown. */
  export type TabState = "focused" | "visible" | "hidden";
  /** What an agent is doing, as Perch's status dots say. */
  export type AgentState = "blocked" | "working" | "done" | "idle" | "unknown";

  /** One tab of the shown workspace's strip. `id` is what the `tab.*` and `pane.*` commands take. */
  export interface TabInfo {
    id: string;
    kind: "session" | "file" | "review" | "browser" | "mod";
    /** The name the strip shows. */
    label: string;
    /** A session's own title; a file's path. */
    title: string;
    state: TabState;
    /** A session's agent (`claude`, `codex`, `terminal`, …), for `AgentIcon`. */
    provider?: string;
    /** A session's agent state. */
    activity?: AgentState;
    blocked?: boolean;
    unseen?: boolean;
    /** A file with unsaved changes. */
    dirty: boolean;
    /** A file opened by a single click: the next previewed file replaces it until it is kept (`tab.pin`). */
    preview: boolean;
    /** A session's folder; a file's path; a browser tab's starting address (`blank:…` for a new page). */
    path: string;
    workspaceId?: string;
    /** A browser tab's page address and icon, once it has loaded. */
    url?: string;
    icon?: string;
    /** A browser tab that has not been given an address. */
    blank?: boolean;
    /** A mod tab's mod id. */
    mod?: string;
  }
  export interface WorkspaceTabs {
    /** Where a new session of this strip starts. */
    hostId: string;
    cwd: string | null;
    workspace: { id: string; path: string } | null;
    /** The tab shown with the keyboard. */
    activeId: string | null;
    tabs: TabInfo[];
    /** The person's tab shape (Settings > Appearance). */
    tabShape: "square" | "round";
    /** The tab being dragged off the strip, if any. */
    draggingId: string | null;
  }
  /** A React hook: the shown workspace's tabs, kept current (sessions, files, splits, drag order, unsaved marks). */
  export function useWorkspaceTabs(): WorkspaceTabs;

  /**
   * Runs an app command as a key or `perch mod do` would; `perch mod commands` lists them with their arguments. The ones
   * a strip or pane needs take an explicit tab: `tab.select {id}`, `tab.close {id}` (a session closes through the
   * same guard as its ×), `tab.pin {id}`, `tab.rename {id, name}`, `tab.move {id, index}`, `tab.menu {id, x, y}`,
   * `pane.unsplit {id}`, `pane.close {id}`, `pane.focus {pane}`. Throws what the command throws (no such tab, a bad
   * argument); returns whether a command ran.
   */
  export function runCommand(command: string, args?: Record<string, unknown>): boolean;
  /** Starts dragging tab `id` from a pointer-down: dropped on the strip it moves, on a pane's side it splits that pane.
   * The strip's tabs must carry `data-tab-entry={id}` and sit in an element with `data-testid="tab-bar"`. */
  export function beginTabDrag(event: import("react").PointerEvent, id: string, label: string): void;
  /** A React hook: `listener` runs when Perch asks for a new tab (Cmd+T). Pass a stable function. */
  export function useNewTabRequest(listener: () => void): void;
  /** A new session on `hostId` in `cwd` running `agent` (an agent id, `terminal` for a shell). */
  export function startSession(hostId: string, cwd: string | undefined, agent: string): void;
  /** A blank browser tab in the workspace. */
  export function openBrowserTab(workspaceId: string): void;
  /** Opens a file of the workspace as a kept tab. */
  export function openFileTab(workspaceId: string, path: string): void;

  /** The open tab menu (split, zoom, rename, close), drawn by Perch; open it with `tab.menu`. Render it once. */
  export function TabMenu(): ReactElement | null;
  /** Where a dragged tab will land, drawn by Perch while a tab is dragged. Render it once. */
  export function TabDragLayer(): ReactElement | null;
  export interface NewSessionMenuProps {
    hostId: string;
    /** The folder the new session starts in (`~` when null). */
    cwd: string | null;
    /** (1.3) Offer these folders and Quickchat to start in, after choosing the agent, instead of `cwd`. */
    projects?: string[];
    anchorRect: DOMRect;
    onClose(): void;
    onSelect(cwd: string | undefined, agent: string): void;
    /** More rows after the agents (a browser, a file). */
    extras?: { id: string; label: string; icon: ReactNode; onSelect(): void }[];
  }
  /** Perch's agent launcher (keyboard filter, installed agents, Manage agents), anchored at `anchorRect`. */
  export function NewSessionMenu(props: NewSessionMenuProps): ReactElement;
  export interface NewFilePromptProps { workspaceId: string; workspacePath: string; onClose(): void; onOpenFile(path: string): void }
  /** Perch's name prompt for a new file in the workspace's root. */
  export function NewFilePrompt(props: NewFilePromptProps): ReactElement;

  export interface PaneLook {
    headerAt: "top" | "bottom";
    /** `hover`: the header is drawn over the pane only while the pointer is on it. */
    headerReveal: "always" | "hover";
    headerHeight: number;
  }
  /** A React hook: how the shown layout draws pane headers. */
  export function usePaneLook(): PaneLook;

  /** An agent's icon by its id (`claude`, `codex`, `terminal`, …), `size` px square. */
  export function AgentIcon(props: { provider?: string; size?: number }): ReactElement;
  /** A web page's icon, else `fallback`. */
  export function PageIcon(props: { icon: string | undefined; fallback: ReactNode }): ReactElement;
  /** The CSS color of an agent state's dot. */
  export function agentStateColor(state: AgentState): string;
  /** The tab classes for each state (the focused one filled, the rest quiet). */
  export const tabStateClass: Record<TabState, string>;
  /** Perch's segment control classes (a tab, a toggle), `active` filled. */
  export function segmentClass(options?: { active?: boolean }): string;

  // ---------------------------------------------------------------------------------------------------------------
  // 1.3: navigation (`stock:sidebar`): hosts, projects, workspaces and sessions, their states, order and actions.
  //
  // The hooks give what Perch knows, already in Perch's order and with Perch's rules applied (which sessions are
  // listed, what needs you, the chat kept in Done while it is read, Quickchat). How to arrange, group further, fold,
  // drag or style it is the screen's. Actions are typed commands (`runCommand`) that name their target; the ones a
  // navigation screen uses: `session.open {id}`, `session.request_close {id}` (as its ×: the close guard),
  // `session.close {id}` (ends it at once), `session.move {id, target, after, siblings}`, `project.move {id, target,
  // after}`, `project.rename {id, name}`, `project.close {id, confirmed: true}`, `workspace.open {id}`,
  // `workspace.focus {id}`, `workspace.rename {id, name}`, `workspace.pin {id, pinned}`, `workspace.hide {id, hidden}`,
  // `workspace.restore {id}`, `workspace.files {id}`, `workspace.git {id}`, `worktree.remove {id}`, `worktree.cancel
  // {id}`, `worktree.retry {id}`, `worktree.dismiss {id}`, `host.select {id}`, `host.enable {id, enabled}`,
  // `host.refresh {id}`, `folder.select {cwd, host?}`, `quickchat.new`, `sessions.new`, `global.needsYou`,
  // `app.settings`. A missing target throws; a command never acts on another one.

  /** A host's connection: `disabled` is a host turned off in Settings. */
  export type HostState = "connected" | "connecting" | "error" | "disabled";
  export interface HostInfo {
    /** `"local"` for this computer, else the host's id. */
    id: string;
    /** `local (<hostname>)` for this computer, else the name from Settings > Hosts. */
    name: string;
    state: HostState;
    /** Why the last connection failed. */
    error?: string;
    /** A second line: this computer's platform, a host's ssh target or address. */
    detail?: string;
    /** A remote host's address (its direct URL, else `ssh-host:port`). */
    address?: string;
    /** A direct-mode host: no Perch on it; turns run detached over SSH and survive disconnects. */
    direct: boolean;
    /** A remote host's Settings switch; undefined for this computer. */
    enabled?: boolean;
  }
  export interface Hosts {
    /** The host the navigation shows. */
    activeId: string;
    active: HostInfo;
    /** This computer first, then every configured host. */
    list: HostInfo[];
    /** This computer, as its core reports it, and the focused folder and branch. */
    local: { hostname?: string; platform?: string; isSsh?: boolean; cwd?: string; branch?: string };
    /** The page's connection to its core. */
    connected: boolean;
    /** A new session can start on the active host now. */
    canCreate: boolean;
    /** The active host keeps projects and workspaces (`useNavigation`); without, its sessions group by folder
     * (`useSessionFolders`). */
    workspaces: boolean;
  }
  /** A React hook: the hosts and which one is shown. */
  export function useHosts(): Hosts;

  /** Where a chat is, by what it asks of you: an open question or failure, finished and unread (or being read
   * right after it finished), running, or quiet. */
  export type StatusSection = "needs" | "done" | "working" | "idle";
  /** One session (a chat with an agent, or a terminal) as navigation lists it. */
  export interface SessionInfo {
    id: string;
    /** Its own title; empty for a new one. */
    title: string;
    hostId: string;
    cwd: string;
    /** When it started (ms). */
    createdAt: number;
    /** The core's word (`running`, `idle`, …). */
    status: string;
    /** The branch its folder is on, when known. */
    branch?: string;
    projectId?: string;
    /** The owning project's name (`Quickchat` for Quickchat). */
    projectName?: string;
    workspaceId?: string;
    /** The workspace's branch or name, only when its project shows several workspaces. */
    workspaceLabel?: string;
    /** A sub-session's lead (`nestSessions` puts it under its lead). */
    parentId?: string;
    /** Its agent (`claude`, `codex`, `terminal`, …). */
    provider?: string;
    state: AgentState;
    section: StatusSection;
    /** Why it needs you, when `section` is `needs` (the core's reason and how sure it is). */
    needReason?: string;
    blocked: boolean;
    unseen: boolean;
    /** The session this screen shows. */
    active: boolean;
  }
  export interface WorktreeJobInfo {
    /** What `worktree.cancel`, `worktree.retry` and `worktree.dismiss` take. */
    id: string;
    branch: string;
    path: string;
    status: "running" | "cancelling" | "failed";
    /** The step it is at (`Checking out`). */
    phase: string;
    error?: string;
  }
  /** A checkout of a project: its main folder, or a git worktree of it. */
  export interface WorkspaceInfo {
    id: string;
    projectId: string;
    /** Its name, else its folder's name. */
    name: string;
    path: string;
    branch?: string;
    /** Uncommitted changes. */
    dirty: boolean;
    pinned: boolean;
    sleeping: boolean;
    /** A linked git worktree (not the project's main checkout); only these can be hidden or deleted. */
    linked: boolean;
    /** The one this screen shows. */
    active: boolean;
    /** The key that jumps here, only while the person holds the workspace keys' modifiers. */
    shortcut?: string;
    /** Its listed sessions, in its tab strip's order. */
    sessions: SessionInfo[];
    /** Worktrees made from this worktree. */
    children: WorkspaceInfo[];
  }
  export interface ProjectInfo {
    id: string;
    hostId: string;
    /** Its name, else its folder's name; `Quickchat` for Quickchat. */
    name: string;
    path: string;
    /** The git repository, for a project that is one (worktrees, the + menu). */
    repoPath?: string;
    favorite: boolean;
    quickchat: boolean;
    /** Its shown workspaces as a tree (worktrees of worktrees under them), in order. */
    workspaces: WorkspaceInfo[];
    /** Worktrees Perch found but did not make, or that were hidden. */
    hidden: WorkspaceInfo[];
    /** Worktrees being made. */
    jobs: WorktreeJobInfo[];
    /** Every listed session of every workspace, workspace by workspace in strip order. */
    sessions: SessionInfo[];
    /** Whether any listed session belongs to it. */
    hasChats: boolean;
    /** Its most urgent section; null when nothing is known (no session, or the host is not reachable). */
    top: StatusSection | null;
    /** The project's instructions and memory can be edited here (`InstructionsDialog`, `MemoryDialog`). */
    instructions: boolean;
    memory: boolean;
  }
  /** One section of a view by status, its sessions split by project in the projects' order (Quickchat last, then
   * `other`). Offline, one `offline` section says what was last known. */
  export interface StatusGroup {
    key: StatusSection | "offline";
    title: string;
    /** Why it is offline. */
    note?: string;
    sessions: SessionInfo[];
    projects: { id: string; name: string; project: ProjectInfo | null; sessions: SessionInfo[] }[];
  }
  export interface Navigation {
    hostId: string;
    /** The host is connected, so states are known; otherwise say nothing about them. */
    reachable: boolean;
    /** The host's projects are still coming, or could not be loaded (`host.refresh` asks again). */
    loading: boolean;
    error?: string;
    /** `project.move` and `session.move` keep an order here (the core keeps it for every screen). */
    reorderable: boolean;
    /** The projects, favourites first, then the order the core keeps (or by attention, when asked). Not Quickchat. */
    projects: ProjectInfo[];
    quickchat: ProjectInfo | null;
    /** Every listed session of the host, newest first. */
    sessions: SessionInfo[];
    /** The listed sessions by status, newest first in each, empty sections left out. */
    status: StatusGroup[];
    /** How many sessions need you (0 while the host is not reachable). */
    needsYou: number;
    activeWorkspaceId: string | null;
    activeSessionId: string | null;
    /** The person holds the workspace keys' modifiers: `WorkspaceInfo.shortcut` is set. */
    shortcuts: boolean;
  }
  /**
   * A React hook: the active host's projects, workspaces and sessions. A plain terminal (no agent) is listed only
   * with `showTerminals`; Quickchat lists every session. `sortByAttention` orders projects (favourites still first)
   * and workspaces (pinned first) by their most urgent section, and turns reordering off.
   */
  export function useNavigation(options?: { showTerminals?: boolean; sortByAttention?: boolean }): Navigation;
  /** `list` with each sub-session straight after its lead when both are in it (`nested`), else as given. */
  export function nestSessions(list: SessionInfo[]): { session: SessionInfo; nested: boolean }[];

  /** The sessions of one folder, on a host without projects. */
  export interface SessionFolder {
    /** `<host>:<cwd>`. */
    key: string;
    cwd: string;
    /** The folder `folder.select` showed. */
    active: boolean;
    /** The most urgent state of its sessions. */
    state: AgentState;
    /** Newest first. */
    sessions: SessionInfo[];
    git?: { branch: string; ahead: number; behind: number };
    /** A registered project has this folder as its repository (its worktree menu is there). */
    registered: boolean;
    /** The workspace whose review `workspace.git` opens, when the host can show one. */
    reviewWorkspaceId?: string;
  }
  /** A React hook: the active host's sessions by folder, newest first, for a host without projects. */
  export function useSessionFolders(): { hostId: string; folders: SessionFolder[] };

  export interface AddProject {
    /** The last request: `pending` until the core answers. */
    status: "idle" | "pending" | "error" | "success";
    error?: string;
    /** The host it was added on. */
    hostId?: string;
    /** Registers `path` as a project on `hostId` (default: the active one). Ignored while one is pending. */
    add(path: string, name?: string, hostId?: string): void;
    /** Forget the answer (after showing it). */
    clear(): void;
  }
  /** A React hook: register a folder as a project, and how that went. */
  export function useAddProject(): AddProject;
  /** A React hook: `listener` runs when Perch asks for the Add project dialog (its key, the home screen). Pass a
   * stable function. A request made just before the screen mounted still reaches it. */
  export function useAddProjectRequest(listener: () => void): void;
  /** The desktop app's folder dialog: the chosen folder, or null when cancelled. Null where there is none. */
  export const pickFolder: ((title: string) => Promise<string | null>) | null;

  /** A session's mark: its agent's icon in a ring of its state's color (`plain`: no ring). */
  export function SessionDot(props: { id: string; plain?: boolean; className?: string }): ReactElement | null;
  /** A host's connection as a small colored dot; its title carries the error. */
  export function HostStateDot(props: { state: HostState; error?: string }): ReactElement;
  export interface SessionMenuProps {
    /** The session. */
    id: string;
    x: number;
    y: number;
    /** Rows after Perch's own (move, …). */
    extraItems?: { label: string; testId: string; onSelect(): void }[];
    onClose(): void;
  }
  /** A session's menu (split, zoom, rename, close, its message choices), as its tab's, for any session, shown or not;
   * drawn by Perch. It never selects the session. */
  export function SessionMenu(props: SessionMenuProps): ReactElement | null;
  /** A git project's worktree menu (new worktree, open, delete), with its + button; drawn by Perch. */
  export function WorktreeMenu(props: { hostId: string; path: string; className?: string }): ReactElement;
  /** The instructions of a project or workspace (what every new session there starts with); drawn by Perch. */
  export function InstructionsDialog(props: { scope: "project" | "workspace"; id: string; name: string; onClose(): void }): ReactElement;
  /** A project's memory files; drawn by Perch. */
  export function MemoryDialog(props: { projectId: string; name: string; onClose(): void }): ReactElement;
  /** Perch's folder browser on `hostId` (typed path or browse); `onUseFolder` gets the chosen folder. */
  export function FolderBrowser(props: { hostId: string; onUseFolder(path: string): void }): ReactElement;
  /** What a modal is given (`Dialog`, and the `stock:dialog` screen or a package chosen in its place). */
  export interface DialogProps { title: string; onClose(): void; children: ReactNode; testId?: string }
  /** A modal: dimmed page, one panel, Escape or a click outside closes it. It is the `stock:dialog` screen, or the
   * person's package chosen for it (1.7). */
  export function Dialog(props: DialogProps): ReactElement;
  /** A confirmation before something that cannot be undone. `busy`: it is running and can no longer be cancelled. */
  /** What a confirmation is given (`ConfirmDialog`, and the `stock:confirm` screen or a package chosen in its place). */
  export interface ConfirmProps {
    message: string;
    /** Default "Delete". */
    confirmLabel?: string;
    /** Default "Cancel". */
    cancelLabel?: string;
    /** Runs the caller's action; the caller closes the dialog (or sets `busy` while it runs). */
    onConfirm(): void;
    onCancel(): void;
    /** A confirmed action is in flight: neither button nor key may start or cancel it again. */
    busy?: boolean;
    /** Extra content under the message (an option to tick). */
    children?: ReactNode;
  }
  /** One notification as Perch has it (1.6): what happened (`heading`) and to what (`detail`), already worded. */
  export interface NotificationItem {
    id: string;
    /** `done` (a session finished), `blocked` (one needs you), `usage` (a plan alert or a mod's `notify`). */
    kind: "done" | "blocked" | "usage";
    /** A mod's notification: how serious it looks. */
    level?: "info" | "warning" | "error";
    title: string;
    body?: string;
    /** A mod's notification: a short mark (an emoji or a letter). */
    icon?: string;
    heading: string;
    detail: string;
    sessionId: string;
    sessionTitle?: string;
    /** The notification is about a session this page knows (draw its `SessionDot`). */
    hasSession: boolean;
    /** How long it stays, ms, unless paused (Perch pauses it on hover or focus). */
    timeout: number;
  }
  export interface Notifications {
    /** Oldest first. */
    items: NotificationItem[];
    /** What a click does: the notification's command, or its session; then it goes. */
    open(id: string): void;
    dismiss(id: string): void;
  }
  /** A React hook (1.6): the in-app notifications (`stock:toast` shows them; a package chosen in its place gets the
   * same list and actions). Perch makes them (a session finishing, needing you, usage, a mod's `notify`). */
  export function useNotifications(): Notifications;
  /** The class of Perch's small square icon button (the notification's ×). */
  export const iconButton: string;

  /** Asks before a destructive action. It is the `stock:confirm` screen, or the person's package chosen for it
   * (`perch mod use stock:confirm <id>`): every confirmation in Perch and in packages opens the same one (1.6). */
  export function ConfirmDialog(props: ConfirmProps): ReactElement;
  /** One choice of a `Select`. `text` is the plain text type-ahead matches (default: a string label, else the value). */
  export interface SelectOption { value: string; label: ReactNode; text?: string; disabled?: boolean }
  export interface SelectProps {
    value: string;
    onChange(value: string): void;
    options: SelectOption[];
    ariaLabel?: string;
    testId?: string;
    id?: string;
    className?: string;
    title?: string;
    disabled?: boolean;
    /** Shown while `value` matches no option. */
    placeholder?: string;
    /** (1.4) The field is a text input: any text is a value and the options are suggestions. */
    freeText?: boolean;
    /** (1.7) Keys the field does not use itself (with `freeText`, Enter before an option was picked). */
    onKeyDown?(event: import("react").KeyboardEvent<HTMLElement>): void;
  }
  /** Perch's select: a field with a popup list, keyboard and type-ahead. It is the `stock:select` screen, or the
   * person's package chosen for it (1.7); Settings > Mods always uses Perch's own. */
  export function Select(props: SelectProps): ReactElement;
  /** A list reorder in progress (`beginReorderDrag`). */
  export interface ReorderDrag {
    /** Where the dragged item started, and the slot last applied (`from` when it has not moved or is off the list). */
    readonly from: number;
    readonly to: number;
    /** The slot under the pointer. */
    slot(event: PointerEvent): number;
    /** Slide the other items aside and move the dragged one to the pointer. */
    apply(to: number, event: PointerEvent): void;
    /** Everything back in place (the pointer left the list). */
    rest(): void;
  }
  export interface ReorderDragOptions {
    axis: "x" | "y";
    /** The list's items in their order, read when the press becomes a drag. */
    items(): HTMLElement[];
    /** The dragged item's index in them (-1: nothing slides). */
    from(items: HTMLElement[]): number;
    /** When the press becomes a drag; the returned function runs when it ends. */
    onStart?(): (() => void) | void;
    /** Each pointer move: `drag.apply(drag.slot(event), event)`, or `drag.rest()`. */
    onMove(event: PointerEvent, drag: ReorderDrag): void;
    /** After every style is restored; `apply` is false for Escape, blur or a lost pointer. Write the order here. */
    onEnd(apply: boolean, drag: ReorderDrag): void;
  }
  /** Call from `onPointerDown` (main button): after a few pixels the item follows the pointer and the others slide
   * aside, as Perch's sidebar and tab strip do; a click never reorders. The click that ends a drag is swallowed. */
  export function beginReorderDrag(event: import("react").PointerEvent, options: ReorderDragOptions): void;
  /** A menu row's classes (`danger` red). */
  export function menuItemClass(options?: { danger?: boolean }): string;
  /** A glyph button at the end of a list row (⋯, +, ×), shown on hover of its `group/ph` (`project`) or `group/row`
   * (`session`) row, on focus and on touch; `always` always. */
  export function rowActionClass(options?: { reveal?: "always" | "project" | "session"; tone?: "default" | "danger"; className?: string }): string;
  /** Perch's text button. */
  export function buttonClass(options?: {
    variant?: "ghost" | "soft" | "primary";
    size?: "xs" | "sm" | "md" | "lg";
    tone?: "default" | "danger" | "warn";
    className?: string;
  }): string;

  // -------------------------------------------------------------------------------------------------------------
  // 1.4: resources.

  /**
   * A React hook shaped like `useState`, whose value Perch keeps under `key` for the resource, not for this copy:
   * every copy of every screen that names the same key shares it, and it survives this code being edited, reloaded
   * or swapped for a clone, a hidden copy being released and the phone/desktop layouts trading places. Use it for
   * what a person must not lose (unsent text, a prepared operation and its id, a send in flight). Name the key
   * after the resource (`review:<workspaceId>:commit`). Kept in memory: a page reload starts empty. `initial` counts
   * only while nothing is kept under `key`.
   */
  export function useResourceState<T>(key: string, initial: T): [T, (next: T | ((previous: T) => T)) => void];
  /** A new random id (an operation id a retry must reuse, a request id). */
  export function newId(): string;

  /** A file's icon by its name (`main.rs`, `package.json`); `directory`/`open` for folders. */
  export function FileIcon(props: { name: string; directory?: boolean; open?: boolean }): ReactElement;
  /** A file's Git state as Perch marks it (M, A, D, U, …), from its status entry; nothing without one. */
  export function GitMarker(props: { decoration?: { entry?: GitStatusEntry; containsChanges?: boolean; conflicted?: boolean }; directory?: boolean }): ReactElement | null;

  /** What Perch can send an agent with Ask agent (Context Bridge): a file, editor lines, a diff hunk or terminal text. */
  export type ContextSource =
    | { kind: "file"; path: string }
    | { kind: "editor"; path: string; text: string; startLine: number; endLine: number; dirty: boolean }
    | { kind: "diff"; path: string; text: string; revision: string; comparison: string }
    | { kind: "terminal"; sessionId: string; text: string };

  // The Git and review models are the core's own (Rust `git.rs`, `review.rs`); a screen shows them, never derives
  // paths, line numbers, revisions or anchors of its own.
  export type GitFileState = "unmodified" | "modified" | "added" | "deleted" | "renamed" | "copied" | "typeChanged" | "untracked" | "ignored" | "conflicted" | { unknown: string };
  export interface GitStatusEntry { path: string; originalPath?: string; index: GitFileState; worktree: GitFileState; staged: boolean; unstaged: boolean }
  export interface GitStatusSnapshot {
    workspaceId: string;
    root: string;
    branch?: string;
    head?: string;
    upstream?: string;
    ahead?: number;
    behind?: number;
    entries: GitStatusEntry[];
    dirty: boolean;
    conflicted: boolean;
  }
  /** What a diff compares: the working tree with the index, the index with HEAD, HEAD's own commit, or two refs. */
  export type GitDiffTarget = { kind: "workingTree" } | { kind: "staged" } | { kind: "head" } | { kind: "compare"; base: string; head?: string };
  export interface GitDiffLine { kind: "context" | "addition" | "deletion"; content: string; oldLine?: number; newLine?: number }
  export interface GitDiffHunk { oldStart: number; oldCount: number; newStart: number; newCount: number; header: string; lines: GitDiffLine[] }
  export interface GitDiffFile { oldPath?: string; newPath?: string; status: "added" | "modified" | "deleted" | "renamed" | "copied" | "typeChanged" | "binary"; hunks: GitDiffHunk[]; isBinary: boolean }
  export interface GitDiffSnapshot {
    workspaceId: string;
    target: GitDiffTarget;
    files: GitDiffFile[];
    hunkCount: number;
    truncated: boolean;
    /** The core's revision of what was diffed: a comment's anchor is checked against exactly these bytes. */
    sourceRevision?: string;
    sourceRevisions?: Record<string, string>;
  }
  /** A discard or commit the core prepared and will run only with this `previewId`, before it expires. */
  export interface GitPreviewReceipt { previewId: string; operation: string; workspaceId: string; paths: string[]; status: Omit<GitStatusSnapshot, "dirty" | "conflicted">; message?: string; expiresAt: number }
  export type ReviewSide = "old" | "new" | "file";
  export interface ReviewLineRange { start: number; end: number }
  export interface ReviewAnchor { path: string; side: ReviewSide; base: GitDiffTarget; baseRevision: string; range: ReviewLineRange; before: string[]; selected: string[]; after: string[] }
  /** A line comment. `version` is the core's: an edit, resolve or delete names it and fails if it moved on. */
  export interface ReviewComment {
    id: string;
    workspaceId: string;
    sessionId?: string;
    agentId?: string;
    path: string;
    base: GitDiffTarget;
    baseRevision: string;
    side: ReviewSide;
    range: ReviewLineRange;
    body: string;
    anchor: ReviewAnchor;
    status: "unresolved" | "resolved" | "stale" | "orphaned";
    anchorConfidence: "none" | "low" | "medium" | "high" | "exact";
    createdAt: number;
    updatedAt: number;
    version: number;
  }
  export interface ReviewPacketComment { commentId: string; version: number; path: string; side: ReviewSide; range: ReviewLineRange; body: string; snippetBefore: string[]; snippet: string[]; snippetAfter: string[]; anchorConfidence: ReviewComment["anchorConfidence"] }
  /** A prepared review packet: sent once, by `packetId` and the `sendOperationId` it was prepared with. */
  export interface ReviewBatchPreview { packetId: string; idempotencyKey: string; sendOperationId: string; workspaceId: string; targetSessionId?: string; targetAgentId?: string; currentRevision: string; comments: ReviewPacketComment[]; markdown: string }
  export interface ReviewBatchDelivery { packetId: string; sendOperationId: string; delivery: "queued" | "claimed" | "delivered" | "unconfirmed"; targetSessionId?: string; targetAgentId?: string }
  export interface ReviewTargetSession { id: string; title: string; agent?: string }
  /** An agent turn whose start and end Perch recorded, offered as a diff base. */
  export interface AgentTurnSummary { snapshotId: string; sessionId: string; agent: string; beforeRef: string; afterRef?: string; changedPaths: string[]; changedPathCount?: number; completedAt?: number; state?: "running" | "complete" | "unavailable" }
  /** Every Git and review action of a workspace. A request id comes back where there is one (null: not sent). */
  export interface WorkspaceGitReviewActions {
    refreshStatus(): string | null;
    selectAgentSession(sessionId?: string): void;
    loadDiff(target: GitDiffTarget, path?: string, options?: { includeUntracked: boolean; ignoreWhitespace: boolean; contextLines: number }): string | null;
    stage(paths: string[]): void;
    unstage(paths: string[]): void;
    /** Discard and commit run in two steps: the preview, then the action named by its `previewId`. */
    discardPreview(mode: "worktree" | "staged" | "all", paths: string[]): Promise<GitPreviewReceipt | null>;
    discard(previewId: string): void;
    commitPreview(message: string): Promise<GitPreviewReceipt | null>;
    commit(previewId: string, message: string): void;
    listComments(): string | null;
    listRefs(): string | null;
    createComment(input: { path: string; side: ReviewSide; start: number; end: number; body: string }): void;
    updateComment(commentId: string, body: string, expectedVersion: number): void;
    resolveComment(commentId: string, resolved: boolean, expectedVersion: number): void;
    deleteComment(commentId: string, expectedVersion: number): void;
    /** Prepare a packet; reuse the same `sendOperationId` for a retry of the same packet. */
    previewBatch(input: { sendOperationId: string; targetSessionId?: string; targetAgentId?: string; currentRevision: string; instruction: string }): Promise<ReviewBatchPreview | null>;
    sendBatch(packetId: string, sendOperationId: string): Promise<ReviewBatchDelivery | null>;
  }
  /** A workspace's review as Perch keeps it: one per workspace, shared by every screen that shows it. */
  export interface GitReview {
    /** False until the workspace's host offers Git (after a reload the offer can come late). */
    ready: boolean;
    workspaceName?: string;
    /** The ref Perch recorded when the workspace started, offered as a diff base. */
    startSnapshot?: string;
    lastAgentTurn?: AgentTurnSummary;
    /** The session whose latest turn is offered; absent: the newest across the workspace. */
    agentSessionId?: string;
    status: GitStatusSnapshot | null;
    statusState: "idle" | "loading" | "ready" | "error";
    statusError?: string;
    actionError?: string;
    diff: GitDiffSnapshot | null;
    diffState: "idle" | "loading" | "ready" | "error";
    diffError?: string;
    comments: ReviewComment[];
    refs: { name: string; target: string; upstream?: string; remote: boolean }[];
    batchDelivery: ReviewBatchDelivery | null;
    /** The workspace's sessions, as review packet targets. */
    sessions: ReviewTargetSession[];
    currentRevision?: string;
    actions: WorkspaceGitReviewActions;
    /** Context Bridge's Ask agent for a selection (it opens Perch's own preview and explicit send); absent where
     * the host offers none (another computer's workspace, an older core). */
    askAgent?: (source: ContextSource) => void;
  }
  /** A React hook: workspace `workspaceId`'s review. */
  export function useGitReview(workspaceId: string): GitReview;

  /** One session's terminal (an agent, a sub-session or a shell) as this page knows it. */
  export interface TerminalRecord {
    /** `<host>/<session>`: names it to `readTerminal`/`sendToTerminal` without ambiguity across computers. */
    target: string;
    hostId: string;
    sessionId: string;
    kind: "agent" | "terminal";
    /** The agent running (`claude`, `codex`, …), `terminal` for a shell. */
    provider: string;
    title: string;
    cwd: string;
    workspaceId?: string;
    /** The lead this is a sub-session of. */
    parentSessionId?: string;
    /** The terminal this page types into for it; null while this page has none open. */
    terminalId: string | null;
    /** Drawn on this screen now (read when asked; not a reason to re-render). */
    shown: boolean;
    /** Open on this page, shown or kept off screen: its text reads and it takes input without being shown. */
    open: boolean;
    /** Pinned on this device (`runCommand("terminal.pin", …)`); not shared with other devices. */
    pinned: boolean;
    /** 1.5: its place in the order set on this device (`runCommand("terminal.order", {ids})`), 0 first; null when not in
     * it. For a package's own list: Perch's views do not order by it. */
    order: number | null;
    focused: boolean;
    /** What this page knows: `unknown` is no evidence (never read it as exited), `host-unavailable` a computer this
     * page cannot reach now. Perch never restarts or runs anything locally because of either. */
    state: "running" | "exited" | "unknown" | "host-unavailable";
  }
  /** Every session's terminal on every computer this page knows, agents, sub-sessions and hidden ones included. */
  export function terminals(): TerminalRecord[];
  /** A React hook: `terminals()`, again whenever sessions, terminals, hosts, focus, a pin or this device's order change (1.10.1: pins and order too). */
  export function useTerminals(): TerminalRecord[];
  /** The last `lines` (default 50) lines of a terminal's text, screen and scrollback. `target` is a `<host>/<session>`
   * target (a bare session id works while only one computer has it). It need not be on screen: a terminal this page
   * keeps off screen reads too. Throws, saying why, for one this page has not opened. */
  export function readTerminal(target: string, lines?: number): string;
  /** `readTerminal`, also for a terminal this page never opened (1.6): the core reads the terminal daemon's own
   * screen, starting, attaching and resizing nothing. A session on another computer that this page has not opened,
   * or a read over the relay, rejects saying so (read it on that computer). */
  export function fetchTerminal(target: string, lines?: number): Promise<string>;
  /** Types `text` into a terminal as the person would (`"\r"` is Enter), on screen or not. Throws for an unknown,
   * ambiguous, unopened or exited terminal; it never starts one. */
  export function sendToTerminal(target: string, text: string): void;
  /** One node of the shown layout. */
  export interface LayoutTreeNode {
    /** Child indexes from the root (`""` is the root, `"0.1"` its first child's second child). */
    path: string;
    id?: string;
    type: "row" | "column" | "block" | "stack";
    /** A block's content: `sidebar`, `tabs`, `canvas`, `mod:<id>`, `terminal:<session>`, … */
    content?: string;
    title?: string;
    /** Hidden by the layout or by the person (`layout.toggle`). */
    hidden: boolean;
    /** A stack's shown child (its id). */
    active?: string;
    children?: LayoutTreeNode[];
  }
  /** The shown layout (`name` its id) as a tree, the person's hides and stack choices applied; `root` is null for
   * Perch as shipped. */
  export function layoutTree(): { name: string | null; root: LayoutTreeNode | null };
  /** 1.5: a layout node for `Layout`, the window layout's shape (layouts/*.json) without its looks: rows, columns and
   * stacks of blocks. A block's `content` is `mod:<id>` (with `props`), `terminal:<session>` (its shell),
   * `session:<session>` (the session's own view: its agent's terminal or chat), `agent:focused`, `files`, `git`, … */
  export type LayoutNode =
    | { type: "row" | "column"; id?: string; title?: string; hidden?: boolean; size?: { px?: number; weight?: number; min?: number; max?: number }; gap?: number; children: LayoutNode[] }
    | { type: "stack"; id?: string; title?: string; hidden?: boolean; size?: { px?: number; weight?: number; min?: number; max?: number }; active?: string; header?: "tabs"; children: LayoutNode[] }
    | { type: "block"; id?: string; title?: string; hidden?: boolean; size?: { px?: number; weight?: number; min?: number; max?: number }; content: string; props?: Record<string, unknown> };
  /**
   * 1.5: layout content inside your own view, so a live terminal can sit beside your UI. Terminals here are Perch's
   * (the same engine, connection, input and size owner): one already on screen moves in, and goes back when this
   * unmounts. Unmounting never stops a process, and nothing here starts an agent. An invalid node shows why.
   */
  export function Layout(props: { node: LayoutNode }): ReactElement;

  // -------------------------------------------------------------------------------------------------------------
  // 1.5: the drawer's browser. The pages and their addresses are Perch's (kept across reloads); each page is a
  // native webview in the desktop app, drawn by `BrowserPage`. A screen lists, opens, switches and closes pages.

  export interface BrowserPageInfo { id: string; url: string; title: string; icon?: string }
  export interface BrowserPages {
    /** The workspace's drawer pages, oldest first. */
    pages: BrowserPageInfo[];
    /** The page shown (the one selected, else the newest); null when there is none. */
    shownId: string | null;
    /** The workspace's browser tabs in the canvas, which `closeAll` also closes. */
    tabCount: number;
    /** Opens a new empty page and shows it; returns its id. */
    open(): string | null;
    select(id: string): void;
    /** Closes a page: its webview goes, and its memory with it. */
    close(id: string): void;
    /** Closes every drawer page and every browser tab of the workspace. */
    closeAll(): void;
    /** Keeps the address a page reached (pass to `BrowserPage`'s `onUrl`). */
    setUrl(id: string, url: string): void;
  }
  /** A React hook: workspace `workspaceId`'s drawer pages. */
  export function useBrowserPages(workspaceId: string): BrowserPages;
  /** One drawer page: address bar, navigation and the page itself (a native webview in the desktop app). Key it by
   * the page id. `active` lets it take the keyboard when it opens; leave it unset for a page that shows by itself. */
  export function BrowserPage(props: { pageId: string; initialUrl: string; active?: boolean; onUrl?: (url: string) => void }): ReactElement;
  /** What has focus, host-qualified: the host, workspace and session, the focused session's terminal on this page,
   * and the panes on screen (the shown tab, or its tiles when split). */
  export function focus(): {
    hostId: string;
    workspaceId: string | null;
    sessionId: string | null;
    terminalId: string | null;
    panes: { id: string; kind: string; title: string; mod?: string; focused: boolean }[];
  };

  // -------------------------------------------------------------------------------------------------------------
  // 1.5: files. The listings, drafts and saves are Perch's (`filesystemStore`): a screen shows them and asks for
  // actions; it never writes a file or keeps a draft of its own.

  export type FileEntryKind = "directory" | "file" | "symlink" | "other";
  /** One entry of a folder listing or a search, as the core reports it. */
  export interface DirectoryEntry { name: string; path: string; kind: FileEntryKind; size: number; modifiedAtMs?: number; readonly: boolean; executable: boolean; mediaType?: string }
  export interface FileMetadata { path: string; name: string; size: number; modifiedAtMs?: number; readonly: boolean; executable: boolean; kind: FileEntryKind; mediaType?: string }
  /** One folder's listing (`path` "" is the workspace root). */
  export interface WorkspaceTreeState { workspaceId: string; path: string; entries: DirectoryEntry[]; truncated: boolean; state: "idle" | "loading" | "ready" | "error"; error?: string }
  /**
   * One open file. `content` is the draft the editor shows, `savedContent` what the last read or save returned (they
   * differ: unsaved). The core keeps the draft (`bufferState`), so it survives a reload of this page or of the core;
   * `conflict` is a change on disk the draft has not seen. `reloadEpoch` changes when the person discards the draft.
   */
  export interface WorkspaceDocumentState {
    workspaceId: string;
    path: string;
    metadata?: FileMetadata;
    content: string;
    savedContent: string;
    version?: string;
    reloadEpoch?: number;
    bufferState?: "idle" | "loading" | "saving" | "ready" | "conflict" | "error";
    state: "idle" | "loading" | "ready" | "saving" | "conflict" | "error";
    error?: string;
    conflict?: { message: string; expectedVersion?: string; actualVersion?: string; current?: FileMetadata };
  }
  /** A read-only preview of a file (bounded: `truncated` says the core cut it). HTML previews only in a sandbox. */
  export interface WorkspacePreviewState {
    workspaceId: string;
    path: string;
    metadata?: FileMetadata;
    version?: string;
    kind?: "text" | "markdown" | "json" | "html" | "image" | "binary" | "tooLarge";
    content?: string;
    mediaType?: string;
    requiresSandbox: boolean;
    truncated: boolean;
    message?: string;
    state: "idle" | "loading" | "ready" | "error";
    error?: string;
  }
  export interface WorkspaceSearchState { query: string; entries: DirectoryEntry[]; truncated: boolean; state: "loading" | "ready" | "error"; error?: string }
  /** A file's or folder's Git mark (`GitMarker`). */
  export interface GitDecoration { entry?: GitStatusEntry; containsChanges?: boolean; conflicted?: boolean }
  /** The workspace's file actions; each answers through the state above (the returned id names the request, null:
   * nothing was sent). */
  export interface WorkspaceFileActions {
    requestTree(path?: string): string | null;
    searchFiles(query: string): string | null;
    /** Open `path` into a draft buffer (`force`: read it again even if open). */
    openFile(path: string, force?: boolean): string | null;
    /** Throw the draft away and read the file from disk. */
    reloadFile(path: string): string | null;
    requestPreview(path: string): string | null;
    /** The editor's new text; the core keeps it as the draft. */
    updateDraft(path: string, content: string): void;
    /** Save against the version the draft was opened at; a change on disk becomes a conflict, never an overwrite. */
    saveFile(path: string): string | null;
    /** After a conflict, and only on the person's say: write the draft over the disk's version. */
    overwriteFile(path: string): string | null;
    /** Word wrap in every editor (a preference, not one view's). */
    setWrap(wrap: boolean): void;
  }
  /** Ask agent from the files screen; an editor selection's unsaved state is filled in by Perch. */
  export type FilesContextSource =
    | { kind: "file"; path: string }
    | { kind: "editor"; path: string; text: string; startLine: number; endLine: number };
  export interface WorkspaceFiles {
    /** null: the workspace is gone (or not known on this page). */
    workspace: { id: string; name: string; path: string; hostId: string } | null;
    connected: boolean;
    /** Folder listings by path, open files and previews by path, the last search. */
    trees: Record<string, WorkspaceTreeState>;
    documents: Record<string, WorkspaceDocumentState>;
    previews: Record<string, WorkspacePreviewState>;
    search?: WorkspaceSearchState;
    wrap: boolean;
    /** With `{ git: true }`: whether it is a Git checkout, whether its host offers Git, and each path's mark. */
    git: { isGit: boolean; ready: boolean; statusState: "idle" | "loading" | "ready" | "error"; statusError?: string; decorations: Map<string, GitDecoration> };
    actions: WorkspaceFileActions;
    /** Context Bridge's Ask agent (its preview and explicit send); absent where the host offers none. */
    askAgent?: (source: FilesContextSource) => void;
  }
  /** A React hook: workspace `workspaceId`'s files. `git` adds its Git marks (and refreshes Git's snapshot when the
   * root listing arrives). */
  export function useWorkspaceFiles(workspaceId: string, options?: { git?: boolean }): WorkspaceFiles;

  /** What a mounted `CodeEditor` can be asked to do (`ref`). */
  export interface CodeEditorHandle { openGoto(): void; focus(): void; askAgent(): void }
  /**
   * Perch's code editor (CodeMirror): an engine a screen places, not source to copy. It loads with the first file
   * opened, so put it under a `<Suspense>`. `value` is the draft; edits come back through `onChange` (pass them to
   * `updateDraft`). `docKey` names the document so its undo history and selection outlive this view.
   */
  export const CodeEditor: (props: {
    value: string;
    onChange(value: string): void;
    onSave(): void;
    onCaret(caret: { line: number; col: number }): void;
    readOnly: boolean;
    wrap: boolean;
    label: string;
    path: string;
    docKey: string;
    onAskAgent?: (text: string, startLine: number, endLine: number) => void;
    ref?: import("react").Ref<CodeEditorHandle>;
  }) => ReactElement;
  /** Perch's viewer for a media file, a PDF or an archive (streamed from the core, confined to the workspace). */
  export function FileAsset(props: { workspaceId: string; metadata: FileMetadata }): ReactElement;
  /** A Markdown draft rendered through Perch's fixed sanitizer (scripts, handlers and unsafe URLs never reach the
   * page); relative images load from the workspace on this computer. */
  export function MarkdownPreview(props: { workspaceId: string; path: string; content: string; local: boolean }): ReactElement;
  export interface FileEntryMenuProps {
    workspaceId: string;
    workspacePath: string;
    /** The entry right-clicked, or null for the workspace root. */
    target: DirectoryEntry | null;
    x: number;
    y: number;
    onClose(): void;
    onOpenFile(path: string): void;
    /** Show this folder's children (something was just made there). */
    onExpand(path: string): void;
    onRefresh(): void;
    /** Open straight at the new-file or new-folder prompt. */
    initialStage?: "newFile" | "newFolder";
  }
  /** Perch's file menu (open, reveal, new, cut/copy/paste, rename, delete, copy path, Ask agent) and its prompts; every
   * change goes through the core and never overwrites an existing file. */
  export function FileEntryMenu(props: FileEntryMenuProps): ReactElement;
  /** The disclosure arrow Perch draws on folders and collapsible headers. */
  export function Chevron(props: { open: boolean; size?: number; className?: string }): ReactElement;
  /** Which viewer a media type opens in (`FileAsset`), or undefined for text. */
  export function assetKind(mediaType: string | undefined): "image" | "video" | "audio" | "pdf" | "archive" | undefined;
  /** The key a person has bound to a command (`editor.save`), as Perch shows it; null when none. */
  export function shortcutLabel(command: string): string | null;

  // -------------------------------------------------------------------------------------------------------------
  // 1.5: the native chat. The transcript is the core's projection of the CLI's own history (Rust `native_ui`); the
  // chat's state and actions are Perch's (`useNativeChat`). These shapes are the core's (`@perch/shared`).

  /** Context use from the last model response. Never a cost or a quota. */
  export interface NativeUiContext {
    usedTokens: number;
    windowTokens: number;
    /** The window size is a guess from the model name (Claude does not report it). */
    estimated?: boolean;
  }
  /** One unified-diff hunk; `lines` keep their leading `+`, `-` or space. */
  export interface NativeUiEditHunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: string[];
  }
  export interface NativeUiEditPatch {
    filePath?: string;
    hunks: NativeUiEditHunk[];
  }
  export interface NativeUiTool {
    name: string;
    input: string;
    /** The provider's id for this call; its result names it in `toolCallId`. */
    id?: string;
    /** What the provider says about the call; absent when it says nothing. */
    state?: "running" | "completed" | "failed";
  }
  export interface NativeUiMessage {
    id: string;
    role: string;
    text: string;
    thinking: string;
    tools: NativeUiTool[];
    toolName?: string;
    model?: string;
    error?: string;
    /** On a `toolResult`: the `NativeUiTool.id` it answers. */
    toolCallId?: string;
    /** On a `toolResult`: the tool reported failure. */
    isError?: boolean;
    /** On a `toolResult` of a file edit: the provider's resolved hunks (Claude's `structuredPatch`). */
    editPatch?: NativeUiEditPatch;
  }
  export interface NativeUiPickerChoice {
    value: string;
    label: string;
    description?: string;
  }
  /** One option the chat can change: `model`, `effort` or `mode` (`native_ui/option_pickers.rs`). */
  export interface NativeUiPicker {
    id: string;
    label: string;
    /** The choice value the CLI was last seen running with, never what was merely sent. */
    current?: string;
    choices: NativeUiPickerChoice[];
    /** False while a turn runs or the CLI waits on a person. */
    settable: boolean;
    /** A consequence worth knowing before choosing. */
    note?: string;
  }
  /** Display text for the toolbar (`native_ui/session_options.rs`); never an instruction to change anything. */
  export interface NativeUiOptions {
    /** "Haiku 4.5". */
    model?: string;
    /** "High". */
    effort?: string;
    /** "Accept edits". */
    permissionMode?: string;
    /** What the chat may change in the running CLI, each with the value last read back from it. */
    pickers?: NativeUiPicker[];
  }
  export interface NativeUiRequestOption {
    key: string;
    label: string;
    detail?: string;
  }
  /** A permission prompt or question, answered by `agent.ui.answer` with an option key. */
  export interface NativeUiRequest {
    /** Fingerprint of the prompt text; an answer only applies to this exact prompt. */
    id: string;
    title: string;
    detail: string;
    options: NativeUiRequestOption[];
  }
  export interface NativeUiSubagent {
    id: string;
    label: string;
    agentType?: string;
    /** The lead's spawn call, which places the row in the transcript. */
    toolUseId?: string;
    /** `working`, `completed` or `unverifiable`. */
    state: string;
    startedAt?: number;
    settledAt?: number;
  }
  /** A user row that is a banner Perch delivered; the chat draws a card from it instead of the row's text
   * (`agent_mail.rs::parse_envelope`). `sender`: `session` (another agent: `provider`, `label`, `session`),
   * `person` (the person, through the family strip) or `perch` (a roster of status notes). */
  export interface NativeUiEnvelope {
    kind: "message" | "steer" | "note" | "status";
    sender: "session" | "person" | "perch";
    provider?: string;
    label?: string;
    session?: string;
    /** The header's `HH:MM UTC`. */
    at: string;
    /** The text that was sent, unquoted; for a body that went to a file, its preview. */
    body: string;
    fullTextPath?: string;
    chars?: number;
    messageId?: string;
  }
  /** A removed row has no `newLineNumber`, an added one no `oldLineNumber`; a gap carries neither nor text. */
  export interface NativeUiEditLine {
    kind: "context" | "add" | "del" | "gap";
    text: string;
    oldLineNumber?: number;
    newLineNumber?: number;
  }
  export interface NativeUiEditFile {
    path: string;
    /** Set only when the change moved the file. */
    oldPath?: string;
    changeKind: "added" | "deleted" | "edited" | "renamed";
    lines: NativeUiEditLine[];
    added: number;
    removed: number;
    /** False when positions are snippet-relative: the rows then carry no numbers. */
    lineNumbersKnown: boolean;
    truncated?: boolean;
  }
  export interface NativeUiStep {
    id: string;
    kind: "thinking" | "tool" | "result";
    label: string;
    body: string;
    tool?: {
      category: string;
      state: "running" | "completed" | "failed" | "unfinished";
      output?: string;
      /** What a landed file edit changed, one card per file (`native_ui/edits.rs`). */
      edit?: NativeUiEditFile[];
    };
  }
  export type NativeUiBlock =
    /** `id` is the `NativeUiMessage` it draws. */
    | { kind: "message"; id: string; turn: string; live?: boolean; sender?: NativeUiEnvelope }
    | { kind: "run"; id: string; turn: string; live?: boolean; summary: string; calls: number; failed: number; steps: NativeUiStep[] };
  export interface NativeUiSubagentRow {
    id: string;
    label: string;
    state: string;
    stateLabel: string;
    agentType?: string;
  }
  /** One spawning turn's roster (`native_ui/subagents.rs`). */
  export interface NativeUiSubagentGroup {
    /** The user message that opened the spawning turn; empty when its spawn call is not in the loaded history. */
    turn: string;
    /** The block this is drawn after. */
    after: string;
    working: boolean;
    /** "Kicked off 2 subagents" while any child works, else "Ran 2 subagents". */
    headline: string;
    verdictState: string;
    verdict: string;
    /** An adverse outcome already recorded while siblings still work. */
    alertState?: string;
    alert?: string;
    /** How long the settled group ran. */
    durationMs?: number;
    agents: NativeUiSubagentRow[];
  }
  export interface NativeUiTask {
    content: string;
    status: "pending" | "in_progress" | "completed";
    /** Present-tense phrasing; shown only while the task is in progress. */
    activeForm?: string;
  }
  export interface NativeUiTaskList {
    tasks: NativeUiTask[];
    explanation?: string;
  }
  export interface NativeUiTurnDiffFile {
    path: string;
    added: number;
    removed: number;
    truncated?: boolean;
    /** In the order the edits ran: the step that holds each card, and which of its cards. */
    edits: { step: string; fileIndex: number }[];
  }
  export interface NativeUiTurnDiff {
    /** The user message that opened the turn. */
    turn: string;
    /** The block this is drawn after: the last one of the turn. */
    after: string;
    files: NativeUiTurnDiffFile[];
    added: number;
    removed: number;
    truncated?: boolean;
  }
  /** What the chat draws, derived in Rust from `NativeUiSnapshot.messages` (`native_ui/transcript.rs`). */
  export interface NativeUiTranscript {
    blocks: NativeUiBlock[];
    /** The live activity line while a turn runs and nothing waits on the person. */
    working?: string;
    /** The agent's own to-do list as of its latest plan call, docked above the composer; absent without one. */
    tasks?: NativeUiTaskList;
    /** What each turn's landed edits changed, once per file; drawn after the block named in `after`. */
    turnDiffs?: NativeUiTurnDiff[];
    /** The subagents each spawning turn started, one roster per turn, drawn after the block named in `after`. */
    subagents?: NativeUiSubagentGroup[];
  }
  export interface NativeUiSnapshot {
    version: number;
    revision: number;
    pid: number;
    /** Empty on OpenCode's home view until the native TUI creates a conversation. */
    providerSessionId: string;
    cwd: string;
    model: string | null;
    /** The reasoning effort the provider reports, as it writes it (`high`). Codex only. */
    effort?: string;
    /** `ask`, `accept-edits`, `auto`, `full-access` or `plan`: Claude's last hook event, Codex's thread settings. */
    permissionMode?: string;
    running: boolean;
    /** The turn is paused on a human: a permission prompt or a question. Implies `running`. */
    blocked?: boolean;
    /** The numbered choices the CLI is waiting on, when its screen shows them. */
    request?: NativeUiRequest;
    /** How full the model's context is, when the provider reports it. */
    context?: NativeUiContext;
    messages: NativeUiMessage[];
    truncated: boolean;
    /** Older messages than `messages` hold can be loaded (`agent.ui.older`). Absent from older cores. */
    canLoadOlder?: boolean;
    /** Absent from older cores. */
    transcript?: NativeUiTranscript;
    /** The model, effort and mode worded for the toolbar, read-only. Absent from older cores. */
    options?: NativeUiOptions;
    /** The subagents the session started (raw; the transcript groups and words them). Claude only. */
    subagents?: NativeUiSubagent[];
  }
  export interface CrewActionState {
    ok: boolean;
    /** Why it is not available; absent when it is. */
    reason?: string;
  }
  /** The four family-strip actions on a child and whether each is available now. */
  export interface CrewActions {
    message: CrewActionState;
    steer: CrewActionState;
    interrupt: CrewActionState;
    stop: CrewActionState;
  }
  /** The newest message between the two, with its receipt (`queued`, `delivering`, `delivered`,
   * `unconfirmed`, `undelivered` and, when it waits or failed, why). */
  export interface CrewLatest {
    /** `to` when the asked-about session sent it, `from` when it received it. */
    direction: string;
    preview: string;
    at: number;
    receipt: string;
    reason: string;
    /** How a delivered message reached the agent: `queued_in_agent` (in its CLI's follow-up queue) or
     * `steered`; absent when it started a turn, and from an older core. */
    handoff?: string;
    /** `message` or `steer`; absent from an older core, which means `message`. */
    kind?: string;
  }
  export interface CrewNeedsYou {
    preview: string;
    at: number;
  }
  /** An agent's own claim, never proof. `source` is `report` (its `perch report`) or `last-message`
   * (a fallback: the start of its last message). */
  export interface CrewReport {
    text: string;
    /** `report` (its own), `summary` (a cheap model's, named in `model`) or `last-message`. */
    source: string;
    at: number;
    model?: string;
  }
  /** One member of a session's run for the family strip. What it is doing is four records, never one
   * status word: `lifecycle` (Perch's runtime), `needsYou` (a pending approval or question),
   * `latest.receipt` (the delivery state of the last message) and `report` (the agent's own claim). */
  export interface CrewRow {
    sessionId: string;
    /** `manager`, `worker` or `peer`: how it relates to the session asked about. */
    role: string;
    title: string;
    provider: string;
    /** `working`, `idle`, `done`, `blocked`, `exited`, … or `unknown` (not idle). */
    lifecycle: string;
    /** A child's dispatch record: `running`, `stopped`, `exited`, `start_unknown`, … */
    dispatch?: string;
    /** What a child was asked to do. */
    task?: string;
    needsYou?: CrewNeedsYou;
    report?: CrewReport;
    latest?: CrewLatest;
    /** A message to it would be accepted now. */
    canMessage: boolean;
    /** What a person may do to this child from the strip, each with the reason it is not offered
     * (capability `crew.actions.v1`). Only a lead's `worker` rows have it. */
    actions?: CrewActions;
  }
  /** A message another session sent that this session's person has not answered. `text` is cut to a preview
   * when the message was long (`truncated`). */
  export interface HeldMessage {
    id: string;
    fromSessionId: string;
    fromProvider: string;
    fromLabel: string;
    text: string;
    truncated?: boolean;
    at: number;
  }
  /** One task of a suggested-task card. `state` is `pending`, `starting`, `started` (then `childSessionId` and
   * `dispatch` say where its sub-session is), `handed` or `dismissed`; `reason` is why Start did not start it. */
  export interface SuggestionItem {
    id: string;
    task: string;
    agent: string;
    model?: string;
    worktree: boolean;
    state: string;
    childSessionId?: string;
    dispatch?: string;
    reason?: string;
  }
  /** The tasks one `perch suggest` put in front of the person. */
  export interface SuggestionCard {
    id: string;
    items: SuggestionItem[];
  }
  /** What a `suggestion.act` did to one task: `started`, `refused`, `handed` or `dismissed`. */
  export interface SuggestionResult {
    suggestionId: string;
    outcome: string;
    reason?: string;
    childSessionId?: string;
  }

  /** A file staged for the next message (on this computer); `file` is the picked file, for a thumbnail. */
  export interface ComposerImage { path: string; name: string; id: string; file?: File }
  /** An answered request, shown under the transcript until the CLI moves on. */
  export interface ChatReceipt { id: string; title: string; label: string }
  /** The send in flight or just made. `unconfirmed`: Perch cannot tell whether the CLI got it; it never resends it. */
  export interface ChatOutbox { operationId: string; text: string; phase: "sending" | "delivered" | "unconfirmed" }
  /** Loading older history a page at a time (put `sentinelRef` on the list's first row). */
  export interface OlderHistory { sentinelRef: (node: HTMLElement | null) => void; loading: boolean; auto: boolean; loadNow(): void }
  export interface ComposerMenuItem { key: string; label: string; detail?: string }
  /** What a family-strip action came to, in the core's words. */
  export interface ActOutcome { outcome: string; reason?: string }
  export type InboundModeName = "accept" | "hold" | "refuse";
  export interface InboundState { mode: InboundModeName; held: HeldMessage[] }
  export interface InboundOutcome { outcome: string; reason?: string; count?: number }
  export type InboundClick = { action: "set_mode"; mode: InboundModeName } | { action: "deliver" | "discard"; messageId: string } | { action: "deliver_all" | "discard_all" };
  export interface SuggestionAction { sessionId: string; cardId: string; action: "start" | "start_all" | "handed" | "dismiss"; suggestionId?: string; generation: number; agent?: string; model?: string; worktree?: boolean }
  export interface SuggestionOutcome { outcome: string; reason?: string; results?: SuggestionResult[] }

  /** One chat as Perch runs it. Actions that type into the CLI need this view to hold its input (`controlling`). */
  export interface NativeChat {
    connected: boolean;
    /** This view holds the CLI's input (the person can type and act). */
    controlling: boolean;
    /** Another view holds the input now. */
    inputElsewhere: boolean;
    canTakeControl: boolean;
    takingControl: boolean;
    takeControl(): Promise<void>;
    exited: boolean;
    /** The transcript and the CLI's state; null until the CLI answers (or after it exited). */
    snapshot: NativeUiSnapshot | null;
    /** The one error line: this view's, else the chat's last failed send. */
    error: string | null;
    setError(message: string | null): void;
    /** Subscribe again after the transcript could not be read. Never restarts the CLI. */
    reconnect(): void;
    hostId: string;
    workspaceId?: string;
    folder: { path: string; name: string } | null;
    /** Where the CLI's file links resolve (pass to `Markdown`); absent where the host cannot resolve them. */
    fileLinks?: { workspaceId: string; hostId: string };
    /** What Enter does while a turn runs (`steer` or `queue`); Alt/Option+Enter does the other. */
    whileWorking: "steer" | "queue";
    /** The unsent message, kept by Perch for the chat (it survives a reload, a remount and a clone). */
    draft: { text: string; images: ComposerImage[] };
    outbox: ChatOutbox | null;
    receipts: ChatReceipt[];
    uploading: boolean;
    /** The person changed the draft (a changed draft is a new message: it gets a new operation id). */
    edit(text: string, images?: ComposerImage[]): void;
    /** Send the draft, once: refused while a send is in flight; a retry of the same draft reuses its operation id. */
    send(alt?: boolean): Promise<void>;
    /** Stage files (this computer's sessions only). */
    attach(files: File[]): Promise<void>;
    /** Put an unconfirmed message back in the composer as a new message; false when there is none. */
    restoreUnconfirmed(): boolean;
    dismissOutbox(operationId?: string): void;
    /** A built-in slash command the CLI ran in its terminal (no transcript entry). */
    ranCommand: string | null;
    dismissRanCommand(): void;
    /** Answer the request on screen with one of its option keys. */
    answer(key: string): Promise<void>;
    answering: boolean;
    stop(): Promise<void>;
    stopping: boolean;
    /** Change the CLI's model, effort or mode (absent where the host cannot). */
    options?: { changing: boolean; change(option: string, value: string): Promise<void> };
    /** The composer's autocomplete for the caret given to `useNativeChat` (`/` commands, `@` files). */
    menu: { open: boolean; items: ComposerMenuItem[]; active: number; label: string; setActive(index: number): void; dismiss(): void; move(step: 1 | -1): void; pick(index: number): { text: string; caret: number } | null; slashCommands: boolean };
    family: { rows: CrewRow[]; refresh(): void; act?: (childSessionId: string, action: "message" | "steer" | "interrupt" | "stop", text: string | undefined, onProgress: (result: ActOutcome) => void) => Promise<ActOutcome> };
    suggestions: { cards: SuggestionCard[]; act(cardId: string, click: Omit<SuggestionAction, "sessionId" | "generation" | "cardId">): Promise<SuggestionOutcome>; sendHere(task: string): Promise<{ ok: boolean; reason?: string }> };
    inbound: { state: InboundState; act(click: InboundClick): Promise<InboundOutcome> };
    /** The files the last settled turn changed (Git), and one file's diff of that turn. */
    lastTurn: AgentTurnSummary | null;
    loadTurnDiff(path: string): Promise<GitDiffFile[]>;
    older: OlderHistory;
    /** Blocks matching the `find` query given to `useNativeChat`, in order. */
    findHits: string[];
    openSession(id: string): void;
  }
  /**
   * A React hook: the native chat of `sessionId` with agent `providerId` (`terminalProviderId`: what owns its terminal,
   * when that differs). Call it once per chat view: it holds the CLI's terminal binding while mounted. `caret` drives
   * the autocomplete, `listRef` the older-history loader, `find` the transcript search.
   */
  export function useNativeChat(options: { sessionId: string; providerId: string; terminalProviderId?: string; caret?: number; listRef?: RefObject<HTMLElement | null>; find?: string | null }): NativeChat;
  /**
   * An agent's Markdown through Perch's fixed sanitizer: scripts, event handlers, `javascript:`/`data:` links and
   * SVG/iframe payloads never reach the page; `perch-ui` blocks draw as plain text; code is highlighted. A click on
   * a link never navigates Perch: a web link opens outside it, a file link (with `fileLinks`) opens the file.
   */
  export function Markdown(props: { text: string; streaming?: boolean; fileLinks?: { workspaceId: string; hostId: string } }): ReactElement;
  /** A button that copies `text` to the clipboard and says so. */
  export function CopyButton(props: { text: string; className?: string; label?: string; testId?: string }): ReactElement;

  // -------------------------------------------------------------------------------------------------------------
  // 1.7: the app's dialogs and menus as screens. Perch opens each where it always did and gives it the props below:
  // its data and Perch's own actions (the same services, guards and confirmations as before). A package chosen for
  // `stock:<name>` gets the same props. The SDK components above (`Dialog`, `Select`, `TabMenu`, `SessionMenu`,
  // `NewSessionMenu`, `NewFilePrompt`, `FileEntryMenu`, `FolderBrowser`, `WorktreeMenu`, `InstructionsDialog`,
  // `MemoryDialog`, `TabDragLayer`, `ConfirmDialog`) open the chosen screen too, so a copy of an outer screen uses the
  // person's choice for every screen it contains.

  /** The agents a host can start in a pane, as the launchers offer them (1.7). */
  export interface AgentChoices {
    connected: boolean;
    /** The host lists its agents (manifests); without, Claude and Codex are offered. */
    discovery: boolean;
    /** The host's list: wait while `loading`, say `error`. */
    state: "idle" | "loading" | "ready" | "error";
    error?: string;
    choices: { id: string; label: string; isDefault?: boolean }[];
    /** The person's last pick (`claude` or `codex`). */
    lastChoice: string;
    /** Remembers a pick as the next default (only Claude and Codex are remembered). */
    rememberChoice(id: string): void;
    /** Opens Settings' agent catalog. */
    manage(): void;
  }
  /** A React hook (1.7): `hostId`'s agents, fetched when first asked for while connected. */
  export function useAgentChoices(hostId: string): AgentChoices;
  /** Where keyboard focus is, for `shortcutFor` (1.7). */
  export type ShortcutScope = "global" | "terminal" | "leader" | "resize" | "editor" | "navigator" | "directory";
  export interface ShortcutMatch { id: string; scope: string }
  /** The key binding `event` triggers in `scope` (default: worked out from the event's target), with the person's
   * own bindings; null for none and while an input method is composing (1.7). */
  export function shortcutFor(event: KeyboardEvent, scope?: ShortcutScope): ShortcutMatch | null;
  /** The class of a menu's divider line (1.7). */
  export const menuDividerClass: string;

  /** `stock:instructions`: a project's or workspace's Instructions. `load`/`save` resolve null when the core does
   * not answer, `error` when it refuses (too long, a folder that is not absolute). */
  export interface InstructionsState { scope: string; id: string; text: string; folders: string[]; revision: number; maxChars: number; error?: string }
  export interface InstructionsScreenProps {
    scope: "project" | "workspace";
    id: string;
    name: string;
    onClose(): void;
    load(): Promise<InstructionsState | null>;
    save(text: string, folders: string[]): Promise<InstructionsState | null>;
  }

  /** `stock:memory`: a project's memory files. Every write names the revision it is based on; a stale one comes back
   * with `conflict` and nothing saved. Null: the core did not answer. */
  export interface MemoryEntry { name: string; size: number; revision: string; author: { kind: "person" | "agent" | "mod" | "outside"; session?: string; label: string }; updatedAt: number; summary: string }
  export interface MemoryState { projectId: string; files: MemoryEntry[]; maxFiles: number; maxChars: number; name?: string; conflict?: boolean; error?: string }
  export interface MemoryScreenProps {
    projectId: string;
    name: string;
    onClose(): void;
    list(): Promise<MemoryState | null>;
    get(file: string): Promise<{ file?: { entry: MemoryEntry; text: string }; error?: string } | null>;
    /** `baseRevision`: absent for a new file. */
    save(file: string, text: string, baseRevision?: string): Promise<MemoryState | null>;
    remove(file: string, revision: string): Promise<MemoryState | null>;
  }

  /** `stock:close-guard`: closing an agent's tab stops it for everyone. */
  export interface CloseGuardProps {
    sessionId: string;
    label: string;
    /** Stops the session; `never` also turns this warning off. */
    onStop(never: boolean): void;
    /** Dismisses this view of it; the session keeps running. */
    onKeepRunning(): void;
    onCancel(): void;
  }

  export interface DragBox { left: number; top: number; width: number; height: number }
  /** `stock:tab-drag`: the tab drag in flight (Perch tracks the pointer and makes the drop). */
  export interface TabDragProps {
    drag: {
      id: string;
      label: string;
      x: number;
      y: number;
      /** On the strip the tab itself follows the pointer; this screen draws only off it. */
      overStrip: boolean;
      /** The tab's own markup (ids removed) and where it was grabbed, for a ghost off the strip. */
      look: { html: string; width: number; height: number; dx: number; dy: number } | null;
      /** The pane under the pointer, the half a split would take (`zone`, null: that pane cannot take the tab) and
       * the box to highlight. */
      drop: { pane: DragBox; zone: "left" | "right" | "up" | "down" | null; box: DragBox } | null;
    };
  }

  /** `stock:onboarding`: the first-run welcome. */
  export interface OnboardingProps { onDismiss(): void; openSettings(): void }

  /** A folder `FolderBrowser` lists (`isGitRepo`: it holds a `.git`). */
  export interface FolderEntry { name: string; path: string; isGitRepo: boolean }
  /** `stock:folder-browser`: `browse` lists a folder on `hostId` (absent: the last one, else home). */
  export interface FolderBrowserProps {
    hostId: string;
    onUseFolder(path: string): void;
    browse(path?: string): Promise<{ path: string; parent?: string; entries: FolderEntry[] }>;
  }

  /** `stock:tab-menu`: tab `id`'s actions, at `x`,`y`. Each action is Perch's own; the menu closes itself after. */
  export interface TabMenuScreenProps {
    id: string;
    x: number;
    y: number;
    onClose(): void;
    self: { id: string; kind: "session" | "resource"; label: string; title?: string };
    /** A new terminal can be split in (the tab has a workspace) and the split has room. */
    canSplitNew: boolean;
    canSplitMore: boolean;
    /** Open tabs that can be shown beside this one. */
    offered: { id: string; label: string }[];
    /** The tab is in a split now. */
    inSplit: boolean;
    canStopAgent: boolean;
    /** The opener's own rows (a session's message choices, the sidebar's moves). */
    extraItems: { label: string; testId: string; onSelect(): void }[];
    actions: {
      rename(name: string): void;
      splitNew(direction: "right" | "below"): void;
      showBeside(otherId: string): void;
      showFull(): void;
      separateAll(): void;
      stopAgent(): void;
      /** Closes the tab (an agent's goes through the close guard). */
      close(): void;
    };
  }

  /** `stock:pane-menu`: a docked pane's actions, for the pane it was opened on. */
  export interface PaneMenuScreenProps {
    panelId: string;
    title: string;
    x: number;
    y: number;
    sessionId?: string;
    canClose: boolean;
    maximized: boolean;
    canStopAgent: boolean;
    onClose(): void;
    actions: {
      splitNew(direction: "right" | "below"): void;
      /** Opens the "Split with session" picker. */
      splitSession(): void;
      /** Opens the session's tab menu at `left`,`top` (Show beside an open tab). */
      showBesideTab(left: number, top: number): void;
      toggleZoom(): void;
      rename(name: string): void;
      stopAgent(): void;
      close(): void;
    };
  }

  /** `stock:file-menu`: the explorer's entry menu (`target`, or null for the root) and its prompts. */
  export interface FileMenuScreenProps extends FileEntryMenuProps {
    /** A cut or copied entry of this workspace, ready to paste. */
    held: { path: string; cut: boolean } | null;
    /** The desktop app can open and reveal this workspace's files. */
    nativeAvailable: boolean;
    /** Ask agent (Context Bridge) is offered here. */
    canAsk: boolean;
    actions: {
      /** `fs.mutate`; rejects with the reason (it never overwrites anything). */
      mutate(op: "createFile" | "createDir" | "rename" | "copy" | "delete", path: string, to?: string): Promise<void>;
      hold(path: string, cut: boolean): void;
      /** `name`, or `name 2`, ... free in folder `dir`. */
      freeName(name: string, dir: string): string;
      openInDefaultApp(absolutePath: string): Promise<void>;
      reveal(absolutePath: string): void;
      askAgent(path: string): void;
    };
  }

  /** A project in the launcher, with the workspace a new tab lands in (none: it has no workspace on screen). */
  export interface LauncherProject { id: string; name: string; path: string; workspace: { id: string; path: string } | null }
  /** `stock:launcher`: the New session picker. */
  export interface LauncherProps {
    hostId: string;
    projects: LauncherProject[];
    activeProjectId: string | null;
    onClose(): void;
    actions: {
      /** Starts `agent` (an id of `useAgentChoices`) in `cwd` ("~": a Quickchat). */
      start(cwd: string, agent: string): void;
      openBrowser(workspaceId: string): void;
      focusWorkspace(workspaceId: string): void;
      openFile(workspaceId: string, path: string): void;
      addProject(): void;
    };
  }

  /** `stock:new-session`: the agent launcher at a button (`NewSessionMenu`'s props as Perch resolves them). */
  export interface NewSessionScreenProps {
    hostId: string;
    /** Unscoped: these folders, then Quickchat. */
    projectCwds: string[];
    /** Scoped: only the agent is chosen, for this folder. */
    fixedCwd?: string;
    anchorRect: DOMRect;
    onClose(): void;
    onSelect(cwd: string | undefined, agent: string): void;
    extras?: { id: string; label: string; icon: ReactNode; onSelect(): void }[];
  }

  export interface NavigatorSession { id: string; title: string; cwd: string; hostId?: string; createdAt: number; state: AgentState }
  /** `stock:navigator`: the command palette. */
  export interface NavigatorScreenProps {
    open: boolean;
    onClose(): void;
    sessions: NavigatorSession[];
    currentSessionId: string | null;
    connected: boolean;
    /** The focused workspace (file search and `>` commands run there). */
    workspace: { id: string; path: string } | null;
    supportsSearch: boolean;
    supportsRun: boolean;
    /** The workspace's last file search (`actions.searchFiles`). */
    search?: WorkspaceSearchState;
    /** Agents the host can start, in `agentCwd`. */
    agents: { id: string; label: string }[];
    agentCwd: string | null;
    /** A new terminal splits in beside the focused session, in this folder. */
    terminalCwd: string | null;
    actions: {
      switchTo(sessionId: string): void;
      searchFiles(query: string): void;
      openFile(path: string): void;
      newTerminal(): void;
      startAgent(agent: string): void;
      manageAgents(): void;
      /** Runs `command` in a new terminal of the workspace (ask first); rejects with the reason. */
      run(workspaceId: string, command: string): Promise<void>;
    };
  }

  /** One worktree of a repo (`isPrimary`: the main checkout, never removable). */
  export interface WorktreeEntry { path: string; branch?: string; head?: string; isPrimary: boolean; isDirty: boolean }
  /** A branch a delete kept because git could not prove it merged: review `commits`, then `deleteBranch`. */
  export interface WorktreePreservedBranch { name: string; head: string; commits: string[]; unmerged: number }
  /** `stock:worktree`: a git project's worktrees. Answers carry `error` when the core refused. */
  export interface WorktreeScreenProps {
    hostId: string;
    /** The repository. */
    cwd: string;
    projectKey: string;
    className?: string;
    worktrees?: { worktrees: WorktreeEntry[]; defaultRoot: string; baseRef?: string; refs?: string[] };
    /** Creates run in the background (progress shows in the sidebar). */
    background: boolean;
    /** Task name and start-from (newer hosts); else branch and "new branch". */
    startFromSupported: boolean;
    /** Delete removes the checkout and its branch (a branch with unmerged work is kept for review). */
    deleteSupported: boolean;
    parentChoices: { id: string; name: string; path: string }[];
    /** Settings' "Empty workspace opens". */
    emptyAgent?: string;
    /** Perch asks this menu to open (a key): on the create form, or on a removal's question. Take it once. */
    request: { create?: boolean; remove?: { path: string; branch?: string } } | null;
    actions: {
      list(): Promise<{ error?: string }>;
      create(options: { branch: string; newBranch: boolean; path?: string; extra?: { name?: string; startFrom?: string; parentWorkspaceId?: string }; agent?: string }): Promise<{ error?: string; background?: boolean }>;
      /** Without `force` a dirty checkout comes back `dirty` with git's message: ask again before forcing. */
      remove(path: string, force: boolean): Promise<{ error?: string; dirty?: boolean; preservedBranch?: WorktreePreservedBranch }>;
      deleteBranch(branch: string, head: string): Promise<{ error?: string }>;
      /** A new session in that checkout. */
      open(path: string): void;
      takeRequest(): void;
    };
  }

  /** What Context Bridge prepared: the packet (its Markdown, and the digest a send must name) and the workspace's
   * agents (`canSend`: a direct send is possible; else copy only, `reason`). */
  export interface ContextPreview {
    packet: { workspaceId: string; markdown: string; digest: string };
    agents: { sessionId: string; title: string; providerId: string; canSend: boolean; reason: string }[];
  }
  /** `stock:context-bridge`: Ask agent (docs/CONTEXT-BRIDGE.md). Nothing is sent but by `actions.send`, once. */
  export interface ContextBridgeScreenProps {
    /** The terminal selection's menu. */
    menu: { x: number; y: number; workspaceId: string; sessionId?: string; selection?: string } | null;
    /** What is being asked about (`id`: this capture). */
    capture: { id: string; workspaceId: string; source: ContextSource } | null;
    connected: boolean;
    /** This capture's send, as Perch has it: `sent` holds what was sent (a copy shown later shows it). */
    sendState: { attempted: boolean; sending: boolean; delivered: boolean; error?: string; sent?: { instruction: string; preview: ContextPreview; targetSessionId: string } };
    actions: {
      /** From the menu: open the dialog on the selection. */
      ask(): void;
      closeMenu(): void;
      preview(instruction: string): Promise<ContextPreview>;
      /** The one send of this capture: rejects if already attempted, or when the agent did not confirm delivery
       * (never retried: inspect the agent before asking again). */
      send(request: { instruction: string; preview: ContextPreview; targetSessionId: string }): Promise<void>;
      /** Shows the agent's tab; false if it is gone. */
      openAgent(sessionId: string): boolean;
      /** Closes the dialog (not while a send is in flight). */
      close(): void;
    };
  }

  // 1.8 settings: BEGIN (the Settings pages as screens; `sdkSettings.ts`)
  // Every Settings page except Mods is a screen. Perch's Settings frame (the section list, the search box, the close
  // button) and Settings > Mods stay Perch's, so a broken copy can always be put back. Each page gets the data it
  // shows as props and each action as a function in `actions`; saving, permission checks, socket traffic and the ssh
  // probe stay Perch's, and so does what each action means. A text field's unsent text belongs in `useResourceState`
  // (Perch keeps it while a copy is swapped), not in `useState`. On a phone Perch keeps its own pages.

  /** (1.8) The Settings search text ("" when not searching). A group whose title matches clears it for its rows. */
  export function useSettingsQuery(): string;
  /** (1.8) A Settings block: a quiet heading above one rounded card. It is Perch's own, so the Settings search
   * filters a copy's rows (and hides a group with none). */
  export function SettingsGroup(props: { title?: string; children: ReactNode; testId?: string; ariaLabel?: string }): ReactElement;
  /** (1.8) One setting in a card: label and description on the left, the control on the right. While the person
   * searches Settings it renders only if its `title` or a text `description` matches. */
  export function SettingRow(props: { title: string; description?: ReactNode; children?: ReactNode; testId?: string }): ReactElement | null;
  /** (1.8) Perch's on/off switch (a checkbox with `role="switch"`). */
  export function Switch(props: { checked: boolean; onChange(checked: boolean): void; testId?: string; label: string }): ReactElement;
  /** (1.8) Perch's UI / CLI switch. */
  export function ModeSwitch(props: { mode: "ui" | "cli"; onChange(mode: "ui" | "cli"): void; testId?: string; disabled?: boolean }): ReactElement;
  /** (1.8) A QR code for `text`, black on white with a quiet zone whatever the theme (scanners need it). */
  export function QrCode(props: { text: string }): ReactElement;
  /** (1.8) The class strings the Settings pages style their controls with. Read them while rendering. */
  export const settingsClass: {
    select: string; selectHost: string; input: string; inputPort: string; inputWide: string; addRow: string;
    list: string; hostRow: string; name: string; addr: string; muted: string; empty: string;
    primary: string; danger: string; catalogToggle: string;
  };

  /** (1.8) The settings the pages read, as the core keeps them. Fields Perch adds later arrive as `unknown`. */
  export interface PerchSettings {
    theme?: string;
    chatMode?: "ui" | "cli";
    warnCloseAgent?: boolean;
    previewTabs?: boolean;
    emptyWorkspaceAgent?: string;
    browserSearchEngine?: string;
    browserSearchSuggestions?: boolean;
    /** null: no default (the server's folder). */
    defaultCwd?: string | null;
    tabShape?: "square" | "round";
    terminalScrollback?: number;
    terminalLoginShell?: boolean;
    droppedPathDoubleQuotes?: boolean;
    soundEnabled?: boolean;
    toastDelivery?: "off" | "app" | "system";
    usageLimitAlert?: number;
    usageDailyBudgetUsd?: number;
    leadsStartWithoutAsking?: boolean;
    reporterEnabled?: boolean;
    reporterClaudeModel?: string;
    reporterCodexModel?: string;
    reporterPiModel?: string;
    reporterOmpModel?: string;
    maxLiveSubSessions?: number;
    maxSubSessions?: number;
    maxMessagesPerRun?: number;
    maxLeadWakesPerRun?: number;
    maxInterruptsPerSubSession?: number;
    maxWaitingSuggestions?: number;
    /** Shortcut overrides: command id to key combo, "" for none. */
    keybindings?: Record<string, string>;
    phoneAccess?: boolean;
    /** The relay address phones use on any network; "" or absent: none. */
    relayUrl?: string;
    [key: string]: unknown;
  }
  /** (1.8) A change to settings: only the fields named change. `defaultCwd: null` clears it. */
  export type SettingsChange = Partial<PerchSettings>;

  /** `stock:settings-general`: the chat mode, interface and browser rows, and the default working directory. */
  export interface GeneralSettingsProps {
    settings: PerchSettings | null;
    /** A phone-width screen: the preview-tabs row and the Interface group do not apply. */
    isMobile: boolean;
    /** The agents a click on an empty workspace can start. */
    agentChoices: { id: string; label: string }[];
    searchEngines: { id: string; label: string }[];
    /** Show the active agent on the chat pane's tab (kept on this device). */
    paneLabels: boolean;
    actions: {
      updateSettings(change: SettingsChange): void;
      setPaneLabels(on: boolean): void;
      clearBrowsingHistory(): void;
    };
  }

  /** `stock:settings-appearance`: the theme, the chat's text and the tab shape. */
  export interface AppearanceSettingsProps {
    settings: PerchSettings | null;
    /** Every theme the person can pick, built in and their own. */
    themes: string[];
    /** Chat text sizes (kept on this device) and the one in use. */
    chatTextSizes: { value: string; label: string }[];
    chatTextSize: string;
    /** What Enter does while the agent works (kept on this device). */
    sendWhileWorking: "steer" | "queue";
    actions: {
      /** Shows the theme at once, then saves it. */
      setTheme(name: string): void;
      setChatTextSize(value: string): void;
      setSendWhileWorking(mode: "steer" | "queue"): void;
      updateSettings(change: SettingsChange): void;
    };
  }

  /** One agent of a host's catalog, as Settings lists it. */
  export interface SettingsAgent {
    id: string;
    displayName: string;
    available: boolean;
    /** Absent: enabled. */
    enabled?: boolean;
    isDefault?: boolean;
    launchCommand?: string;
    executable?: string;
    homepageUrl?: string;
  }
  /** `stock:settings-agents`: the agents of `hostId`. `agents` is the list Perch offers there, installed or not. */
  export interface AgentsSettingsProps {
    connected: boolean;
    /** The host whose agents show: "local" is this computer. */
    hostId: string;
    /** The other computers (this one is always offered first). */
    hosts: { id: string; name: string }[];
    hostName: string;
    /** Where the host's list stands; absent before the first answer. */
    catalog?: { state: "idle" | "loading" | "ready" | "error"; error?: string };
    agents: SettingsAgent[];
    /** The host lets the person enable, disable and pick a default. */
    configurable: boolean;
    /** The host lists its agents at all. */
    discoverable: boolean;
    actions: {
      selectHost(hostId: string): void;
      /** Asks the host again. */
      refresh(): void;
      setEnabled(agentId: string, enabled: boolean): void;
      setDefault(agentId: string): void;
      /** Opens an https link outside Perch. */
      openExternal(url: string): void;
    };
  }

  /** One shortcut row of Settings > Keyboard. `keys` is the key as written on this platform, "" for none. */
  export interface KeyboardSettingsRow {
    id: string;
    description: string;
    keys: string;
    /** The person changed it from the default. */
    edited: boolean;
    /** A command a package registered asked for a key it could not have (`keys` is then ""): why not. */
    conflict?: string;
  }
  export interface KeyboardSettingsGroup { id: string; title: string; rows: KeyboardSettingsRow[] }
  /** What became of a key press while recording: saved (`note` says which commands lost the key), or refused. */
  export type KeyRecordResult = { kind: "saved"; note?: string } | { kind: "error"; text: string };
  /** `stock:settings-keyboard`: every command with its key. The groups include "Package commands" (id `mods`) while
   * packages have registered any. */
  export interface KeyboardSettingsProps {
    groups: KeyboardSettingsGroup[];
    /** Some key is changed from its default. */
    hasOverrides: boolean;
    actions: {
      /** Gives `id` the key `event` pressed: null for a modifier alone (keep waiting); otherwise it was saved (taking
       * the key from other commands) or refused. The page handles Escape itself. */
      record(id: string, event: KeyboardEvent): KeyRecordResult | null;
      /** No key. */
      clear(id: string): void;
      /** The built-in key. */
      reset(id: string): void;
      resetAll(): void;
    };
  }

  /** `stock:settings-terminal`: scrollback, the login shell and dropped paths. */
  export interface TerminalSettingsProps {
    settings: PerchSettings | null;
    /** The lines of scrollback Perch honours. */
    scrollback: { min: number; max: number };
    actions: { updateSettings(change: SettingsChange): void };
  }

  /** What the system says about notification permission (`native`: the desktop app, whose macOS settings can be opened). */
  export interface SystemNotificationStatus {
    permission: "granted" | "denied" | "default" | "provisional" | "unsupported" | "unknown";
    alerts?: boolean;
    alertStyle?: "none" | "banner" | "alert" | "unknown";
  }
  /** `stock:settings-notifications`: delivery, permission, usage alerts, sub-session limits and summary models. */
  export interface NotificationsSettingsProps {
    settings: PerchSettings | null;
    native: boolean;
    /** Null until a check answers (or when it failed: see `error`). */
    permission: SystemNotificationStatus | null;
    /** A permission action is running; start no other. */
    pending: boolean;
    error: string | null;
    /** What the last test notification said. */
    testResult: string | null;
    /** The models each installed harness offers, by harness id (`claude`, `codex`, `pi`, `omp`). */
    models: Record<string, { id: string; label: string }[]>;
    actions: {
      updateSettings(change: SettingsChange): void;
      /** Saves the delivery; choosing "system" also asks for permission. */
      setToastDelivery(delivery: "off" | "app" | "system"): void;
      notification(action: "refresh" | "request" | "settings" | "test"): void;
    };
  }

  /** A computer of Settings > SSH hosts. */
  export interface SshHostEntry {
    id: string;
    name: string;
    sshHost: string;
    remotePort: number;
    enabled: boolean;
    /** Absent: "perch". */
    mode?: "perch" | "direct";
    directUrl?: string;
    remoteCmd?: string;
  }
  /** What a look at a computer over ssh found. */
  export interface MachineProbe {
    os: "linux" | "macos";
    arch: "x86_64" | "aarch64";
    home: string;
    tmux: boolean;
    corePath?: string;
    coreVersion?: string;
  }
  /** The last answer about a computer (`sshHost` is the one asked about). `error.kind` "needs_login": ssh wants a
   * person; `loginArgv` is the command to run in a terminal. */
  export interface MachineCheckResult {
    sshHost: string;
    probe?: MachineProbe;
    installedPath?: string;
    error?: { kind: "needs_login" | "unreachable" | "failed"; message: string; hint: string };
    loginArgv?: string[];
  }
  /** The new-host form as typed (strings, trimmed by Perch). */
  export interface NewHostForm { name: string; sshHost: string; port: string; mode: "perch" | "direct"; directUrl: string; remoteCmd: string }
  /** `stock:settings-hosts`: the configured computers and the form that adds one. */
  export interface HostsSettingsProps {
    hosts: SshHostEntry[];
    /** Each host's connection by id; absent for one not yet reported. */
    hostStates: Record<string, { state: HostState; error?: string }>;
    machine: {
      /** The host names `~/.ssh/config` offers for the SSH host field. */
      sshConfigHosts: string[];
      /** A check or install is running. */
      pending: "check" | "install" | null;
      result: MachineCheckResult | null;
    };
    actions: {
      /** Adds the host if the form has a name and an ssh host; false when it did not. */
      addHost(form: NewHostForm): boolean;
      /** Saves a change to a host (its mode, its switch). */
      upsertHost(host: SshHostEntry): void;
      deleteHost(id: string): void;
      /** Looks at `sshHost` over ssh. `onCore` runs if perch-core is found there. */
      checkMachine(sshHost: string, onCore?: () => void): void;
      /** Puts perch-core on `sshHost`. `onCore` runs once it is found there. */
      installCore(sshHost: string, onCore?: () => void): void;
      /** Runs ssh in a terminal tab so a person can log in. */
      logIn(argv: string[]): void;
    };
  }

  /** Where a phone can reach this computer: `lan` (same Wi-Fi), `tailscale` or `relay` (its link carries a key). */
  export interface PhoneAddress { kind: "lan" | "tailscale" | "relay"; url: string }
  /** Whether phones can reach this computer, and how. `alwaysOn`: a headless core, with no switch. */
  export interface PhoneAccessStatus {
    enabled: boolean;
    alwaysOn: boolean;
    addresses: PhoneAddress[];
    tailscale?: "missing" | "needsLogin" | "stopped" | "running";
    relay?: { state: "connecting" | "online" | "error"; message?: string };
    /** The relay this build offers behind one switch. */
    defaultRelay?: string;
    error?: string;
  }
  /** `stock:settings-devices`: phone access, pairing, and the paired devices. */
  export interface DevicesSettingsProps {
    settings: PerchSettings | null;
    /** A phone-width screen: no Phone access group (a phone must not switch off its own way in). */
    isMobile: boolean;
    /** Null until the computer answers. */
    phone: PhoneAccessStatus | null;
    devices: { id: string; name: string; createdAt: number; lastSeenAt: number }[];
    /** The pairing code on offer and when it ends (ms since the epoch); null when none. Perch drops it at the end. */
    pairing: { code: string; expiresAt: number } | null;
    actions: {
      updateSettings(change: SettingsChange): void;
      /** Offers a new pairing code. */
      pairStart(): void;
      /** Takes the code back. */
      pairCancel(): void;
      /** Takes a device's access back. */
      revoke(deviceId: string): void;
      /** What the QR carries for `address` (an address's url) and `code`. */
      pairLink(address: string, code: string): string;
      openExternal(url: string): void;
    };
  }

  export type MacPermissionState = "granted" | "notGranted" | "unknown";
  export interface MacPermissionCheck { id: string; title: string; description: string; state: MacPermissionState }
  export interface MacPermissionSnapshot { pid: number; checks: MacPermissionCheck[] }
  /** What macOS says about Perch (`app`), its terminal host (`daemon`) and a shell run through it (`terminal`).
   * `host.attribution` "severed": an update replaced the file the terminal host runs from. */
  export interface MacPermissionReport {
    supported: boolean;
    host?: { pid: number; attribution: "intact" | "severed" | "unknown"; liveSessions: number } | null;
    app: MacPermissionSnapshot;
    daemon: MacPermissionSnapshot | null;
    terminal: MacPermissionSnapshot | null;
    comparison: "match" | "different" | "unknown";
    note: string | null;
  }
  /** `stock:settings-permissions`: macOS permissions. `pending` names the running request (a check's id, or
   * `permissions_status`, `permissions_verify`, `permissions_restart_host`); only one runs at a time. */
  export interface PermissionsSettingsProps {
    report: MacPermissionReport | null;
    pending: string | null;
    error: string | null;
    actions: {
      refresh(): void;
      /** Runs a short read-only shell through the terminal host and compares it with the app. */
      verify(): void;
      /** Opens System Settings for that check. Opening it is not a grant. */
      allow(checkId: string): void;
      /** Restarts the terminal host (ending its terminals); true if it did. Ask the person first. */
      restartHost(): Promise<boolean>;
    };
  }
  // 1.8 settings: END

  // -------------------------------------------------------------------------------------------------------------
  // 1.9: the last desktop screens. The start screen, the editor's right-click menu, the terminal's find bar, the
  // composer's slash popover, a docked pane group's Split with session picker and the phone-size notice are stock
  // screens with the props below. What each action does
  // stays Perch's: a session starts through Perch, an editor edit is a CodeMirror transaction on Perch's editor, a find
  // runs in Perch's terminal (a screen never writes to the terminal), a slash pick only rewrites the composer's text,
  // and taking the size back is Perch's lease. On a phone Perch keeps its own.

  /** Where a new session can start: `key` is the folder it starts in (`~` is Quickchat); the rest is display. */
  export interface StartTarget { key: string; label: string; name: string; path: string }
  /** `stock:start`: what the main area shows with nothing open (1.9). `kind` says which: `connecting` (the
   * connection is down; nothing can start), `home` (no workspace focused), `workspace` (the focused workspace's start
   * picker) or `cli` (CLI mode, before this session has a place to run). */
  export interface StartScreenProps {
    kind: "connecting" | "home" | "workspace" | "cli";
    hostId: string;
    /** Perch's logo, for the home screen. */
    logo: string;
    /** `home`: the projects New session offers (with Quickchat). */
    projectCwds: string[];
    /** `workspace` and `cli`: where a session can start, and the one chosen (`targetKey`). */
    targets: StartTarget[];
    targetKey: string;
    /** The agents that can start here, the host's default first. */
    choices: { id: string; label: string }[];
    /** `cli`: the host's agent list is still `loading`, failed (`error`), or lists no CLI agent (`empty`); null
     * otherwise. `hostLabel` names the host ("this host"). */
    discovery: { state: "loading" | "error" | "empty"; error?: string; hostLabel: string } | null;
    /** No agent can start yet (the host's list is not in). */
    disabled: boolean;
    /** The host lists its agents, so the catalog can manage them. */
    canManageAgents: boolean;
    actions: {
      /** Chooses a target by key. */
      choose(key: string): void;
      /** The sidebar's Add project flow; from a picker, the project it creates becomes the target. */
      addProject(): void;
      /** Starts `agent` in the chosen target (or resumes this session there, `cli`). */
      start(agent: string): void;
      /** `home`: starts `agent` in `cwd` on `hostId` (New session's menu). */
      startIn(cwd: string | undefined, agent: string): void;
      /** Asks the host for its agents again. */
      retry(): void;
      manageAgents(): void;
      openSettings(): void;
    };
  }

  /** `stock:editor-menu`: the file editor's right-click menu at `x`,`y` (1.9). Each action runs on Perch's editor,
   * closes the menu and gives the editor focus back; `askAgent` is there only where Context Bridge is. */
  export interface EditorMenuProps {
    x: number;
    y: number;
    readOnly: boolean;
    canUndo: boolean;
    canRedo: boolean;
    hasSelection: boolean;
    onClose(): void;
    actions: {
      undo(): void;
      redo(): void;
      cut(): void;
      copy(): void;
      paste(): void;
      selectAll(): void;
      find(): void;
      replace(): void;
      gotoLine(): void;
      askAgent?: () => void;
    };
  }

  /** `stock:terminal-search`: the terminal's find bar, shown while open (1.9). Finding is Perch's (the terminal's
   * search); `close` clears the highlight and gives the terminal its focus back. The bar never writes to the terminal. */
  export interface TerminalSearchProps {
    query: string;
    setQuery(query: string): void;
    findNext(): void;
    findPrevious(): void;
    close(): void;
  }

  /** The composer's autocomplete rows (1.9): `stock:slash-popover`, above the composer. Focus stays in the composer,
   * which owns the arrow, Enter, Tab and Escape keys and points at the active row by `optionId(index)`; a row's mouse
   * press must not take focus from it. Picking a row rewrites the composer's text only; nothing is sent. */
  export interface SlashPopoverProps {
    items: ComposerMenuItem[];
    active: number;
    /** The list's accessible name. */
    label: string;
    /** The element id of row `index`, which the composer names as its active descendant. */
    optionId(index: number): string;
    onPick(index: number): void;
    onHover(index: number): void;
  }
  /** The composer's autocomplete list (1.9): the person's chosen `stock:slash-popover`, or Perch's own. */
  export function SlashPopover(props: SlashPopoverProps): ReactElement;

  /** `stock:session-split`: a docked pane group's Split with session picker at `x`,`y` (1.9). `onPick` splits that
   * session in to the right of the group it was opened from (an open one, `open`, is shown again, not duplicated);
   * `beginDrag` puts the session on a row's drag so a drop on any pane edge splits it there. */
  export interface SessionSplitProps {
    sessions: { id: string; title: string; cwd: string; open: boolean }[];
    x: number;
    y: number;
    onPick(sessionId: string): void;
    beginDrag(event: DragEvent<HTMLElement>, sessionId: string): void;
    onClose(): void;
  }

  /** `stock:phone-size`: over a desktop terminal whose size a phone holds (1.9). `generation` changes with each new
   * phone; `pending` while a take-back is in flight. */
  export interface PhoneSizeProps {
    generation: number;
    pending: boolean;
    /** Takes this tab's size back. */
    onThisTab(): void;
    /** Takes back every terminal a phone holds. */
    onAllTabs(): void;
  }
  // -------------------------------------------------------------------------------------------------------------
  // 1.10: the phone's screens and the terminal, dock and browser chrome.

  /** Floating chrome's surface (the phone's header, bar and keys; chips over a terminal): translucent, blurred and
   * rounded like the panes. */
  export const glassClass: string;
  /** After `ghostButton` on floating chrome: a finger leaves no hover, so a press fills instead. */
  export const tapButtonClass: string;
  /** Perch's Settings cog, `size` px square (default 16), in the current text color. */
  export function GearIcon(props: { size?: number; className?: string }): ReactElement;
  /** A plus in the current text color (default 14 px). */
  export function PlusIcon(props: { size?: number; className?: string }): ReactElement;
  /** Three dots, a menu's mark, in the current text color (default 14 px). */
  export function EllipsisIcon(props: { size?: number; className?: string }): ReactElement;

  /** `stock:mobile-header`, the phone's top row (1.10). A phone screen: a person's copy runs only on a phone that
   * turned that on. */
  export interface MobileHeaderProps {
    /** The shown session's status dot, as Perch draws it (null with no session). */
    dot: ReactNode;
    sessionId: string | null;
    /** The session's title, or "New session". */
    title: string;
    /** `project · branch`, as the stock row shows it under the title. */
    place: string;
    project: string;
    branch: string | null;
    /** The working directory the place stands for (a tooltip). */
    cwd: string;
    connected: boolean;
    /** Sessions that need the person. */
    needsYou: number;
    onOpenSwitcher(): void;
    onOpenSettings(): void;
  }

  /** `stock:mobile-switcher`, the phone's sidebar while open (1.10). */
  export interface MobileSwitcherProps {
    /** The sidebar's own list as Perch draws it on a phone; choosing in it closes the switcher. A copy may draw its
     * own from `useNavigation` and `runCommand`, then call `onPicked`. */
    body: ReactNode;
    /** The plan-usage line (the phone has no status bar). */
    usage: ReactNode;
    onClose(): void;
    /** A session or workspace was chosen: closes the switcher and shows the session pane. */
    onPicked(): void;
  }

  /** The phone's panes. */
  export type MobilePaneKind = "chat" | "files" | "gitReview";
  /** `stock:mobile-panes`, the phone's canvas (1.10): one pane over a bottom bar. */
  export interface MobilePanesProps {
    /** The panes this workspace has (Git only for a git checkout), in order. */
    panes: { kind: MobilePaneKind; label: string }[];
    shown: MobilePaneKind;
    /** The shown pane, mounted by Perch (the only one mounted); null when it needs a workspace and none is picked. */
    content: ReactNode;
    workspaceId: string | null;
    /** Shows a pane: drops a stale Files/Git request and uncovers the session, as the stock bar does. */
    onSelect(kind: MobilePaneKind): void;
  }

  /** `stock:mobile-files`, the phone's Files pane (1.10). */
  export interface MobileFilesProps {
    workspaceId: string;
    /** The open file's path, or null for the explorer. */
    openPath: string | null;
    /** The explorer as Perch draws it (a tap opens a file as a click does on the desktop); null while a file is open. */
    explorer: ReactNode;
    /** The open file's editor (its draft, save and conflicts are Perch's); null with no file open. */
    editor: ReactNode;
    /** Back to the explorer; the file's tab stays open. */
    onBack(): void;
  }

  /** `stock:mobile-keys`, the phone's key bar under an agent terminal while it takes typing (1.10). */
  export interface MobileKeysProps {
    /** Types `data` into the terminal through its own input. */
    send(data: string): void;
    /** Pastes the clipboard's text into the terminal (refused without a secure page). */
    paste(): void;
    /** Whether the terminal's cursor keys are in application mode (DECCKM): arrows are `ESC O x`, else `ESC [ x`. */
    appCursor(): boolean;
  }

  /** `stock:terminal-toolbar`, the row over a shell pane (1.10). Opening, closing and attaching shells is Perch's. */
  export interface TerminalToolbarProps {
    /** The pane's shells, as `Select` options (value: the shell's pane id). */
    shells: { value: string; label: string; disabled?: boolean }[];
    /** The shown shell's pane id, "" for none. */
    selected: string;
    connected: boolean;
    /** A close is in flight. */
    closing: boolean;
    /** The shown shell runs. */
    running: boolean;
    /** There is a shown shell to close. */
    canClose: boolean;
    onSelect(paneId: string): void;
    /** Opens a new shell: a new tab in a docked group, else a new shell in this pane. */
    onNew(): void;
    /** Closes the shown shell (its process ends). */
    onClose(): void;
  }

  /** `stock:agent-control`, over an agent's terminal (1.10), drawn in two places: `top` (the chip) and `bottom` (the
   * error line and the ended banner). Each action moves the terminal's lease or starts or closes the agent, through
   * Perch. */
  export interface AgentControlProps {
    part: "top" | "bottom";
    /** The agent's id (claude, codex, terminal, ...). */
    agent: string;
    /** The chip's text, or null for no chip ("Viewing agent", "Reconnecting…", ...). */
    label: string | null;
    connected: boolean;
    /** A take-over is in flight. */
    pending: boolean;
    /** Start the CLI again after it could not start; null when not offered. */
    onRetry: (() => void) | null;
    /** Take control (moves typing and size here) or Fit here (size only, shared typing); null when not offered. */
    control: { label: string; disabled: boolean; onClick(): void } | null;
    /** The agent's error, or null. */
    error: string | null;
    /** The agent's process ended (`sleeping`: hibernated, its conversation kept); null while it runs. */
    ended: { sleeping: boolean; exitCode: number | null; onRestart(): void; onClose: (() => void) | null } | null;
    /** How this view stands, for a copy that words the chip itself. */
    state: { controlling: boolean; shared: boolean; writable: boolean; phone: boolean };
  }

  /** `stock:dock-tab`, one tab of a docked pane group (1.10). The strip, drag and drop are dockview's. */
  export interface DockTabProps {
    /** The panel's id (`chat`, a shell's, `session-chat-<id>`, `mod:<id>`). */
    id: string;
    title: string;
    /** The agent running in the chat tab, when pane labels are on; else null. */
    agent: string | null;
    /** Dockview's own title and close button for this tab. */
    defaultTab: ReactNode;
    /** Closes the panel (a shell panel's process ends with it). */
    onClose(): void;
    /** Opens the pane menu at the pointer. */
    onMenu(x: number, y: number): void;
  }

  /** `stock:dock-actions`, the buttons at the end of a docked group's tab strip (1.10). A null action is not offered
   * in this group. */
  export interface DockActionsProps {
    /** Adds a shell tab to this group of shells. */
    onAddTerminal: (() => void) | null;
    /** Opens the Split with session picker at `x`,`y`. */
    onSplitSession: ((x: number, y: number) => void) | null;
    /** Opens the pane menu at `x`,`y`. */
    onMenu: ((x: number, y: number) => void) | null;
  }

  /** One row under the browser's address (1.10): go to typed text, search for it, an engine suggestion, or a page. */
  export interface AddressRow {
    kind: "go" | "search" | "suggest" | "page";
    url: string;
    title: string;
  }
  /** `stock:browser-toolbar`, the row over a browser page (1.10). The page and the address draft are Perch's. */
  export interface BrowserToolbarProps {
    /** The desktop's native webview (Back and Forward work), not a sandboxed frame. */
    native: boolean;
    /** A page is shown (an address was entered). */
    started: boolean;
    /** The page's favicon URL. */
    icon: string | undefined;
    address: {
      /** Give Perch the address box (it focuses it and keeps a draft across a swap). */
      ref(element: HTMLInputElement | null): void;
      value: string;
      rows: AddressRow[];
      /** The highlighted row, -1 for none. */
      picked: number;
      onChange(value: string): void;
      onFocus(event: ReactFocusEvent<HTMLInputElement>): void;
      onMouseUp(event: ReactMouseEvent<HTMLInputElement>): void;
      onBlur(): void;
      /** Perch's keys: arrows walk the rows, Enter goes, Escape closes the list or restores the address. */
      onKeyDown(event: ReactKeyboardEvent<HTMLInputElement>): void;
    };
    onChoose(row: AddressRow): void;
    /** Forgets a remembered page. */
    onRemove(row: AddressRow): void;
    onBack(): void;
    onForward(): void;
    onReload(): void;
    onOpenExternal(): void;
  }
}
